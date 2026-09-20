import { NextResponse } from "next/server"
import { WORLD_BEST } from "@/shared/world-best"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { buildPlacePhotoProxyUrl } from "@/lib/place-cover-image"
/** Only verified IDs and fresh shared cache. No paid requests on filter toggles/panning. */
export async function GET(request: Request) {
  const db = getSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "장소를 불러오지 못했어요." }, { status: 503 })
  const ids = [...new Set(WORLD_BEST.flatMap(r => r.googlePlaceId ? [r.googlePlaceId] : []))]
  const { data, error } = await db.from("places").select("google_place_id,name,address,lat,lng,rating,rating_count,cover_photo_reference,photo_references").in("google_place_id", ids).eq("is_closed", false).gte("last_refreshed_at", new Date(Date.now() - 30 * 86400000).toISOString()).limit(1000)
  if (error) return NextResponse.json({ error: "장소를 불러오지 못했어요." }, { status: 503 })
  const origin = new URL(request.url).origin
  const byId = new Map((data ?? []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map(p => [p.google_place_id,p]))
  const places = WORLD_BEST.flatMap(award => {
    const p = award.googlePlaceId ? byId.get(award.googlePlaceId) : undefined
    if (!p) return []
    const ref = p.cover_photo_reference || p.photo_references?.[0]
    return [{ google_place_id:p.google_place_id,name:p.name,address:p.address??"",lat:p.lat,lng:p.lng,rating:p.rating,rating_count:p.rating_count,photo:ref?buildPlacePhotoProxyUrl(ref,640,origin):undefined,award }]
  })
  const unlocated = WORLD_BEST.filter(r => !r.googlePlaceId || !byId.has(r.googlePlaceId)).map(({kind,scope,city,year,name})=>({kind,scope,city,year,name}))
  return NextResponse.json({ places, unlocated, total: WORLD_BEST.length, located: places.length }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" } })
}
