import type { SupabaseClient } from "@supabase/supabase-js"

export type MichelinDetail = { url: string; name: string; distinction: string | null; award_year: number | null; google_place_id: string | null; lat: number; lng: number }
export type MichelinPlace = { name: string; googlePlaceId?: string | null; lat?: number | null; lng?: number | null }
const columns = "url,name,distinction,award_year,google_place_id,lat,lng"
const normalize = (name: string) => name.toLowerCase().replace(/[\s·・.,'"()\[\]-]/g, "")
/** ID first; otherwise require BOTH nearby coordinates and a matching name. Never infer an award from a review. */
export function matchMichelinDetail(place: MichelinPlace, rows: MichelinDetail[]): MichelinDetail | null {
  const byId = place.googlePlaceId ? rows.find(row => row.google_place_id === place.googlePlaceId) : null
  if (byId) return byId
  if (place.lat == null || place.lng == null || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return null
  const name = normalize(place.name)
  if (!name) return null
  const matches = rows.filter(row => {
    if (Math.abs(row.lat - place.lat!) > 0.0012 || Math.abs(row.lng - place.lng!) > 0.0015) return false
    const other = normalize(row.name)
    return other === name || (Math.min(name.length, other.length) >= 4 && (other.includes(name) || name.includes(other)))
  })
  // Two similarly named restaurants in one building must not be guessed.
  return matches.length === 1 ? matches[0] : null
}
export async function fetchMichelinDetail(client: SupabaseClient, place: MichelinPlace): Promise<MichelinDetail | null> {
  if (place.googlePlaceId) {
    const { data, error } = await client.from("michelin_places").select(columns).eq("google_place_id", place.googlePlaceId).limit(2)
    if (error) throw error
    if (data?.length === 1) return data[0] as MichelinDetail
  }
  if (place.lat == null || place.lng == null || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return null
  const { data, error } = await client.from("michelin_places").select(columns)
    .gte("lat", place.lat - 0.0012).lte("lat", place.lat + 0.0012)
    .gte("lng", place.lng - 0.0015).lte("lng", place.lng + 0.0015).limit(100)
  if (error) throw error
  return matchMichelinDetail(place, (data ?? []) as MichelinDetail[])
}
