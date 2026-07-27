import type { SearchableOption } from "@/components/searchable-select"
import { searchGooglePlaces, type PlaceSearchResult } from "@/lib/places-search"

/**
 * Hotel search helpers — Google Places Text Search (global, type=lodging).
 * Local Paris/city mock lists have been removed.
 */
export type HotelPreset = {
  id: string
  name: string
  address: string
  phone: string
  city: string
  country: string
  imageUrl?: string
}

/** @deprecated Mock hotel list removed — always empty. Prefer `searchHotelsExternal`. */
export const HOTEL_PRESETS: HotelPreset[] = []

/** @deprecated Always empty — use remote Google Places search. */
export const HOTEL_SEARCH_OPTIONS: SearchableOption[] = []

export function hotelToSearchOption(hotel: HotelPreset): SearchableOption {
  return {
    value: hotel.name,
    label: hotel.name,
    description: [hotel.city, hotel.address].filter(Boolean).join(" · "),
  }
}

export function placeResultToHotelPreset(place: PlaceSearchResult): HotelPreset {
  return {
    id: place.id,
    name: place.placeName,
    address: place.address,
    phone: place.phoneNumber,
    city: "",
    country: "",
    imageUrl: place.imageUrl || place.image,
  }
}

export function placeResultToSearchOption(place: PlaceSearchResult): SearchableOption {
  return {
    id: place.id,
    value: place.placeName,
    label: place.placeName,
    description: place.address || undefined,
  }
}

/** Legacy name lookup — presets removed; returns undefined. */
export function findHotelPresetByName(_name: string): HotelPreset | undefined {
  return undefined
}

/**
 * Global Google Places lodging search (no city bias / restriction).
 * Empty query → no results (do not return a default city list).
 */
export async function searchHotelsExternal(query: string): Promise<HotelPreset[]> {
  const q = String(query ?? "").trim()
  if (!q) return []

  const { results } = await searchGooglePlaces(q, "stay")
  return results.map(placeResultToHotelPreset)
}
