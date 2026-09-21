import { NextResponse } from "next/server"
import { WORLD_BEST } from "@/shared/world-best"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { buildPlacePhotoProxyUrl } from "@/lib/place-cover-image"
/** Only verified IDs and fresh shared cache. No paid requests on filter toggles/panning. */
export async function GET(request: Request) {
  const db = getSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "장소를 불러오지 못했어요." }, { status: 503 })
  const ids = [...new Set(WORLD_BEST.flatMap(r => r.googlePlaceId ? [r.googlePlaceId] : []))]
  // Keep ID filters small: a growing catalogue can exceed PostgREST URL/row limits.
  const data: {google_place_id:string;name:string;address:string|null;lat:number;lng:number;rating:number|null;rating_count:number|null;cover_photo_reference:string|null;photo_references:string[]|null}[] = []
  const freshAfter = new Date(Date.now() - 30 * 86400000).toISOString()
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = await db.from("places").select("google_place_id,name,address,lat,lng,rating,rating_count,cover_photo_reference,photo_references").in("google_place_id", ids.slice(offset,offset+100)).eq("is_closed", false).gte("last_refreshed_at", freshAfter).limit(100)
    if (batch.error) return NextResponse.json({ error: "장소를 불러오지 못했어요." }, { status: 503 })
    data.push(...(batch.data ?? []))
  }
  const origin = new URL(request.url).origin
  const byId = new Map((data ?? []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map(p => [p.google_place_id,p]))
  const places = WORLD_BEST.flatMap(award => {
    const p = award.googlePlaceId ? byId.get(award.googlePlaceId) : undefined
    if (!p) return []
    const ref = p.cover_photo_reference || p.photo_references?.[0]
    return [{ google_place_id:p.google_place_id,name:award.name,address:p.address??"",lat:p.lat,lng:p.lng,rating:p.rating,rating_count:p.rating_count,photo:ref?buildPlacePhotoProxyUrl(ref,640,origin):undefined,award }]
  })
  const unlocated = WORLD_BEST.filter(r => !r.googlePlaceId || !byId.has(r.googlePlaceId)).map(({kind,scope,city,year,name})=>({kind,scope,city,year,name}))
  return NextResponse.json({ places, unlocated, total: WORLD_BEST.length, located: places.length }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" } })
}
