import { NextResponse } from "next/server"
import { WORLD_BEST, worldBestFor } from "@/shared/world-best"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
/** 공용 장소 캐시만 재사용. 토글/지도 이동이 Google·AI 일괄 호출을 만들지 않습니다. */
export async function GET() {
  const db = getSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "장소를 불러오지 못했어요." }, { status: 503 })
  const ids = WORLD_BEST.flatMap(r => r.googlePlaceId ? [r.googlePlaceId] : [])
  const { data, error } = await db.from("places").select("google_place_id,name,address,lat,lng").in("google_place_id", ids).eq("is_closed", false).gte("last_refreshed_at", new Date(Date.now() - 30 * 86400000).toISOString()).limit(500)
  if (error) return NextResponse.json({ error: "장소를 불러오지 못했어요." }, { status: 503 })
  const places = (data ?? []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)).flatMap(p => worldBestFor(p.name, p.address, p.google_place_id).map(award => ({ ...p, award })))
  return NextResponse.json({ places, total: WORLD_BEST.length, located: places.length, year: 2025 }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" } })
}
