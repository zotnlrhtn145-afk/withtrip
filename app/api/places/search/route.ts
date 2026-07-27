import { NextResponse } from "next/server"

import { buildGooglePlacePhotoUrl, resolveCoverImageUrl } from "@/lib/place-cover-image"

export const runtime = "nodejs"

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

function mapSubCategory(
  types: string[] | undefined,
  kind: "restaurant" | "bar" | "stay"
): string {
  const set = new Set((types ?? []).map((t) => t.toLowerCase()))
  if (kind === "stay") {
    if (set.has("resort_hotel") || set.has("spa")) return "리조트 · 스파"
    if (set.has("lodging") || set.has("hotel")) return "호텔 · 숙박"
    return "호텔 · 숙소"
  }
  if (set.has("korean_restaurant")) return "모던 한식 · 코스 요리"
  if (set.has("japanese_restaurant") || set.has("sushi_restaurant")) return "일식 · 코스"
  if (set.has("french_restaurant")) return "프렌치 · 코스"
  if (set.has("italian_restaurant")) return "이탈리안"
  if (set.has("chinese_restaurant")) return "중식"
  if (set.has("cafe") || set.has("coffee_shop")) return "카페"
  if (set.has("bar") || set.has("night_club")) return "라운지 · 바"
  if (kind === "bar") return "라운지 · 바"
  return "레스토랑 · 다이닝"
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

function pickPhotoUrl(
  photos: { photo_reference?: string }[] | undefined,
  apiKey: string,
  kind: "restaurant" | "bar" | "stay",
  subCategory: string
) {
  const ref = photos?.[0]?.photo_reference
  const googleUrl = ref ? buildGooglePlacePhotoUrl(ref, apiKey, 1200) : ""
  const category =
    kind === "stay" ? "숙소" : kind === "bar" ? "라운지 & 바" : "레스토랑"
  return resolveCoverImageUrl({
    imageUrl: googleUrl,
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
  const subCategory = mapSubCategory(details.types, kind)
  const imageUrl = pickPhotoUrl(details.photos, apiKey, kind, subCategory)

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
