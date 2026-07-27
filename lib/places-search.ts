import {
  michelinPlaceToSearchResult,
  searchMichelinPlaces,
  type MichelinPlaceKind,
} from "@/lib/data/michelin-places"
import type { WishlistKind } from "@/lib/trip-itinerary"

export type PlaceSearchResult = {
  id: string
  source: "michelin" | "google"
  kind?: WishlistKind
  placeName: string
  localName: string
  subCategory: string
  guideBadge: string
  priceRange: string
  address: string
  phoneNumber: string
  rating?: number
  reviewCount?: number
  imageUrl?: string
  image?: string
  imageAlt?: string
}

type PlacesSearchApiResponse = {
  results?: PlaceSearchResult[]
  warning?: string
  error?: string
}

/** Local Michelin / curated spots (instant bonus matches). Hotels rely on Google. */
export function searchCuratedPlaces(
  query: string,
  kind?: WishlistKind | null
): PlaceSearchResult[] {
  if (kind === "stay") return []
  const curatedKind: MichelinPlaceKind | null =
    kind === "restaurant" || kind === "bar" ? kind : null
  return searchMichelinPlaces(query, curatedKind).map(michelinPlaceToSearchResult)
}

export type GooglePlacesSearchResponse = {
  results: PlaceSearchResult[]
  warning?: string
  error?: string
}

/**
 * Fetch Google Places via `/api/places/search` (Text Search + Details).
 * Works for restaurants, bars, and hotels (숙소).
 */
export async function searchGooglePlaces(
  query: string,
  kind?: WishlistKind | null
): Promise<GooglePlacesSearchResponse> {
  const q = String(query ?? "").trim()
  if (q.length < 1) return { results: [] }

  try {
    const params = new URLSearchParams({ q })
    if (kind) params.set("kind", kind)
    const res = await fetch(`/api/places/search?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    const json = (await res.json()) as PlacesSearchApiResponse
    const results = (json.results ?? [])
      .map((item) => {
        const imageUrl = String(item.imageUrl ?? item.image ?? "").trim()
        return {
          ...item,
          source: (item.source ?? "google") as PlaceSearchResult["source"],
          placeName: String(item.placeName ?? "").trim(),
          localName: String(item.localName ?? "").trim(),
          subCategory: String(item.subCategory ?? "").trim(),
          guideBadge: String(item.guideBadge ?? "").trim(),
          priceRange: String(item.priceRange ?? "").trim(),
          address: String(item.address ?? "").trim(),
          phoneNumber: String(item.phoneNumber ?? "").trim(),
          imageUrl,
          image: imageUrl || item.image,
        }
      })
      .filter((item) => Boolean(item.placeName))

    return {
      results,
      warning: json.warning,
      error: json.error,
    }
  } catch (err) {
    console.error("[searchGooglePlaces] failed:", err)
    return {
      results: [],
      error: "CLIENT_FETCH",
      warning: "장소 검색 요청에 실패했어요.",
    }
  }
}

/**
 * Merge Google (primary) + curated Michelin (bonus).
 * Google results come first so real-world queries like 정식당 appear.
 */
export function mergePlaceSearchResults(
  google: PlaceSearchResult[],
  curated: PlaceSearchResult[],
  limit = 10
): PlaceSearchResult[] {
  const seen = new Set<string>()
  const merged: PlaceSearchResult[] = []

  for (const item of [...google, ...curated]) {
    const key = item.placeName.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(item)
    if (merged.length >= limit) break
  }

  return merged
}
