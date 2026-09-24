import "server-only"
import { unstable_cache } from "next/cache"
import { readNearbyCachedPlaces } from "@/lib/places-cache"
import { distanceMeters } from "@/lib/geo"

export type NearbyVisitPlace = { id: string; name: string; address: string; lat: number; lng: number }

async function requestNearby(lat: number, lng: number): Promise<NearbyVisitPlace[]> {
  const key = (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim()
  if (!key) throw new Error("NEARBY_UNAVAILABLE")
  // Same Places API already used by /places/search; no new Google service activation.
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json")
  url.search = new URLSearchParams({ location: `${lat},${lng}`, radius: "300", language: "ko", key }).toString()
  const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" })
  if (!response.ok) throw new Error("NEARBY_UNAVAILABLE")
  const data = await response.json() as { status?: string; results?: { place_id?: string; name?: string; vicinity?: string; geometry?: { location?: { lat?: number; lng?: number } }; business_status?: string; types?: string[] }[] }
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") throw new Error("NEARBY_UNAVAILABLE")
  return (data.results ?? []).flatMap(p => p.place_id && p.name && p.geometry?.location?.lat != null && p.geometry.location.lng != null && p.business_status !== "CLOSED_PERMANENTLY" && !p.types?.includes("political")
    ? [{ id: p.place_id, name: p.name, address: p.vicinity ?? "", lat: p.geometry.location.lat, lng: p.geometry.location.lng }] : [])
}

// Shared public-place result cache, not a person's route. Rounded cells prevent GPS jitter billing.
// Empty results are cached too. Existing places rows/photos are never overwritten by sparse responses.
const cachedNearby = unstable_cache(requestNearby, ["trip-visit-nearby-v1"], { revalidate: 86400 })
export async function visitCandidates(lat: number, lng: number): Promise<NearbyVisitPlace[]> {
  let places = await readNearbyCachedPlaces(lat, lng)
  if (places.length === 0) places = await cachedNearby(Number(lat.toFixed(3)), Number(lng.toFixed(3)))
  const unique = new Map(places.map(p => [p.id, p]))
  return [...unique.values()].filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && distanceMeters({ lat, lng }, p) <= 200)
    .sort((a, b) => distanceMeters({ lat, lng }, a) - distanceMeters({ lat, lng }, b)).slice(0, 7)
}
