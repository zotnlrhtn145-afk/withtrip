import { NextResponse } from "next/server"

import { buildGooglePlacePhotoUrl, resolveCoverImageUrl } from "@/lib/place-cover-image"
import { guessSubCategory } from "@/lib/place-subcategories"

export const runtime = "nodejs"

type GoogleGeometry = {
  location?: { lat?: number; lng?: number }
}

type GoogleTextSearchItem = {
  place_id?: string
  name?: string
  formatted_address?: string
  vicinity?: string
  rating?: number
  user_ratings_total?: number
  price_level?: number
  types?: string[]
  photos?: { photo_reference?: string }[]
  geometry?: GoogleGeometry
}

type GoogleTextSearchResponse = {
  status?: string
  error_message?: string
  results?: GoogleTextSearchItem[]
}

type GoogleDetailsResult = {
  place_id?: string
  name?: string
  formatted_address?: string
  formatted_phone_number?: string
  international_phone_number?: string
  price_level?: number
  rating?: number
  user_ratings_total?: number
  types?: string[]
  editorial_summary?: { overview?: string }
  photos?: { photo_reference?: string }[]
  geometry?: GoogleGeometry
}

type GoogleDetailsResponse = {
  status?: string
  error_message?: string
  result?: GoogleDetailsResult
}

export type PlaceSearchApiItem = {
  id: string
  source: "google"
  placeName: string
  localName: string
  subCategory: string
  guideBadge: string
  priceRange: string
  address: string
  phoneNumber: string
  rating?: number
  reviewCount?: number
  kind: "restaurant" | "bar" | "stay"
  imageUrl: string
  image: string
  imageAlt: string
  /** 대표 이미지 후보(최대 4장) — AI가 실내/음식 사진을 골라내는 데 쓰인다. */
  photoUrls?: string[]
  photoReferences?: string[]
  lat?: number
  lng?: number
}

function getApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  ).trim()
}

function inferKind(
  types: string[] | undefined,
  preferred?: string
): "restaurant" | "bar" | "stay" {
  const joined = (types ?? []).join(" ").toLowerCase()
  if (/lodging|hotel|resort|motel|guest_house|hostel/.test(joined) || preferred === "stay") {
    return "stay"
  }
  if (/bar|night_club|lounge/.test(joined) || preferred === "bar") return "bar"
  if (/restaurant|food|meal|cafe|bakery/.test(joined) || preferred === "restaurant") {
    return "restaurant"
  }
  if (preferred === "stay") return "stay"
  if (preferred === "bar") return "bar"
  return "restaurant"
}

function mapPriceLevel(level: number | undefined | null): string {
  if (level == null || !Number.isFinite(Number(level))) return ""
  const n = Math.min(4, Math.max(0, Math.round(Number(level))))
  return (["¥", "¥¥", "¥¥", "¥¥¥", "¥¥¥¥"] as const)[n]
}

function mapGuideBadge(rating: number | undefined, name: string): string {
  const hay = name.toLowerCase()
  if (/michelin|미슐랭/.test(hay)) return "Michelin Starred"
  if (typeof rating === "number" && rating >= 4.5) return `★ ${rating.toFixed(1)} · Top Rated`
  if (typeof rating === "number" && rating >= 4.0) return `평점 ${rating.toFixed(1)}`
  return ""
}

function buildPlaceName(name: string) {
  return String(name ?? "").trim()
}

function buildLocalName(name: string, address: string) {
  const n = String(name ?? "").trim()
  const addr = String(address ?? "")
  const cityMatch = addr.match(
    /(서울|Seoul|부산|Busan|오사카|Osaka|교토|Kyoto|도쿄|Tokyo|강남)/i
  )
  if (cityMatch) return `${n} · ${cityMatch[1]}`
  return n
}

function buildPhotoUrls(
  photos: { photo_reference?: string }[] | undefined,
  apiKey: string,
  limit = 4
): string[] {
  return (photos ?? [])
    .slice(0, limit)
    .map((photo) => (photo.photo_reference ? buildGooglePlacePhotoUrl(photo.photo_reference, apiKey, 1200) : ""))
    .filter(Boolean)
}

function pickFallbackImageUrl(
  photoUrls: string[],
  kind: "restaurant" | "bar" | "stay",
  subCategory: string
) {
  const category =
    kind === "stay" ? "숙소" : kind === "bar" ? "라운지 & 바" : "레스토랑"
  return resolveCoverImageUrl({
    imageUrl: photoUrls[0] ?? "",
    kind,
    subCategory,
    category,
  })
}

function toApiItem(
  details: GoogleDetailsResult,
  apiKey: string,
  preferredKind?: string
): PlaceSearchApiItem {
  const kind = inferKind(details.types, preferredKind)
  const placeName = buildPlaceName(details.name ?? "")
  const address = String(details.formatted_address ?? "").trim()
  const phone = String(
    details.formatted_phone_number ?? details.international_phone_number ?? ""
  ).trim()
  const rating = typeof details.rating === "number" ? details.rating : undefined
  const reviewCount =
    typeof details.user_ratings_total === "number" ? details.user_ratings_total : undefined
  const subCategory = guessSubCategory({ kind, name: details.name, types: details.types })
  const photoUrls = buildPhotoUrls(details.photos, apiKey)
  const photoReferences = (details.photos ?? [])
    .slice(0, 4)
    .map((photo) => photo.photo_reference ?? "")
    .filter(Boolean)
  const imageUrl = pickFallbackImageUrl(photoUrls, kind, subCategory)
  const lat = details.geometry?.location?.lat
  const lng = details.geometry?.location?.lng

  return {
    id: `google:${details.place_id ?? placeName}`,
    source: "google",
    placeName,
    localName: buildLocalName(placeName, address),
    subCategory,
    guideBadge: mapGuideBadge(rating, placeName),
    priceRange: mapPriceLevel(details.price_level),
    address,
    phoneNumber: phone,
    rating,
    reviewCount,
    kind,
    imageUrl,
    image: imageUrl,
    imageAlt: placeName || "장소",
    photoUrls,
    photoReferences,
    ...(typeof lat === "number" ? { lat } : {}),
    ...(typeof lng === "number" ? { lng } : {}),
  }
}

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<GoogleDetailsResult | null> {
  const id = String(placeId ?? "").trim()
  if (!id) return null

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json")
  url.searchParams.set("place_id", id)
  url.searchParams.set(
    "fields",
    [
      "place_id",
      "name",
      "formatted_address",
      "formatted_phone_number",
      "international_phone_number",
      "price_level",
      "rating",
      "user_ratings_total",
      "types",
      "editorial_summary",
      "photos",
      "geometry",
    ].join(",")
  )
  url.searchParams.set("key", apiKey)
  url.searchParams.set("language", "ko")

  const res = await fetch(url.toString(), { cache: "no-store" })
  if (!res.ok) return null
  const json = (await res.json()) as GoogleDetailsResponse
  if (json.status !== "OK" || !json.result) {
    console.error("[api/places/search] details status:", json.status, json.error_message)
    return null
  }
  return json.result
}

/**
 * GET /api/places/search?q=정식당&kind=restaurant
 * Google Places Text Search + Place Details (+ photo URL)
 */
export async function GET(request: Request) {
  const apiKey = getApiKey()
  if (!apiKey) {
    return NextResponse.json(
      {
        results: [],
        error: "MISSING_API_KEY",
        warning:
          "GOOGLE_PLACES_API_KEY가 없습니다. .env.local에 키를 추가한 뒤 개발 서버를 재시작하세요.",
      },
      { status: 200 }
    )
  }

  const { searchParams } = new URL(request.url)
  const q = String(searchParams.get("q") ?? "").trim()
  const kind = String(searchParams.get("kind") ?? "").trim()
  if (q.length < 1) {
    return NextResponse.json({ results: [] })
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json")
    // Bias lodging search when user selected 숙소; keep query free-form otherwise.
    const searchQuery =
      kind === "stay" && !/\b(hotel|숙소|리조트|료칸|resort)\b/i.test(q)
        ? `${q} hotel`
        : q
    url.searchParams.set("query", searchQuery)
    url.searchParams.set("key", apiKey)
    url.searchParams.set("language", "ko")
    if (kind === "stay") {
      url.searchParams.set("type", "lodging")
    }

    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) {
      console.error("[api/places/search] upstream status:", res.status)
      return NextResponse.json(
        { results: [], error: "UPSTREAM_HTTP", warning: `Google HTTP ${res.status}` },
        { status: 200 }
      )
    }

    const json = (await res.json()) as GoogleTextSearchResponse
    if (json.status && json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      console.error("[api/places/search] google status:", json.status, json.error_message)
      return NextResponse.json(
        {
          results: [],
          error: json.status,
          warning: json.error_message || `Google Places status: ${json.status}`,
        },
        { status: 200 }
      )
    }

    const top = (json.results ?? []).slice(0, 8)
    const detailed = await Promise.all(
      top.map(async (item) => {
        const basePhotos = item.photos
        if (!item.place_id) {
          return toApiItem(
            {
              name: item.name,
              formatted_address: item.formatted_address ?? item.vicinity,
              rating: item.rating,
              user_ratings_total: item.user_ratings_total,
              price_level: item.price_level,
              types: item.types,
              photos: basePhotos,
              geometry: item.geometry,
            },
            apiKey,
            kind
          )
        }
        const details = await fetchPlaceDetails(item.place_id, apiKey)
        if (details) {
          return toApiItem(
            {
              ...details,
              place_id: item.place_id,
              photos: details.photos?.length ? details.photos : basePhotos,
              user_ratings_total: details.user_ratings_total ?? item.user_ratings_total,
            },
            apiKey,
            kind
          )
        }
        return toApiItem(
          {
            place_id: item.place_id,
            name: item.name,
            formatted_address: item.formatted_address ?? item.vicinity,
            rating: item.rating,
            user_ratings_total: item.user_ratings_total,
            price_level: item.price_level,
            types: item.types,
            photos: basePhotos,
            geometry: item.geometry,
          },
          apiKey,
          kind
        )
      })
    )

    return NextResponse.json({
      results: detailed.filter((item) => Boolean(item.placeName)),
    })
  } catch (err) {
    console.error("[api/places/search] unexpected:", err)
    return NextResponse.json(
      { results: [], error: "UNEXPECTED", warning: "장소 검색 중 오류가 발생했어요." },
      { status: 200 }
    )
  }
}
