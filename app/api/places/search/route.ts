import { NextResponse } from "next/server"

import {
  buildPlacePhotoProxyUrl,
  resolveCoverImageUrl,
  resolveRequestOrigin,
  toAbsolutePhotoUrl,
} from "@/lib/place-cover-image"
import { guessSubCategory } from "@/lib/place-subcategories"
import {
  getCachedSearch,
  putCachedSearch,
  readPlacesByGoogleIds,
  searchCacheKey,
  writePlaces,
  type CachedPlace,
  type PlaceCacheInput,
} from "@/lib/places-cache"

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
  limit = 4
): string[] {
  // 키가 박힌 구글 URL이 아니라 우리 프록시 URL을 내보낸다 (키 노출 방지).
  return (photos ?? [])
    .slice(0, limit)
    .map((photo) => (photo.photo_reference ? buildPlacePhotoProxyUrl(photo.photo_reference, 1200) : ""))
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
  const photoUrls = buildPhotoUrls(details.photos)
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

/** 캐시 행을 구글 Details 응답 모양으로 되돌린다 (toApiItem을 그대로 재사용하기 위함). */
function cachedToDetails(row: CachedPlace): GoogleDetailsResult {
  return {
    place_id: row.google_place_id,
    name: row.name,
    formatted_address: row.address ?? undefined,
    international_phone_number: row.phone ?? undefined,
    price_level: row.price_level ?? undefined,
    rating: row.rating ?? undefined,
    user_ratings_total: row.rating_count ?? undefined,
    types: row.google_types ?? undefined,
    photos: (row.photo_references ?? []).map((ref) => ({ photo_reference: ref })),
    geometry: { location: { lat: row.lat, lng: row.lng } },
  }
}

/** 구글 Details 응답을 캐시 저장용 형태로 변환한다. 좌표가 없으면 저장하지 않는다(null). */
function detailsToCacheInput(
  details: GoogleDetailsResult,
  placeId: string,
  kind: string
): PlaceCacheInput | null {
  const lat = details.geometry?.location?.lat
  const lng = details.geometry?.location?.lng
  const name = String(details.name ?? "").trim()
  if (!placeId || !name || typeof lat !== "number" || typeof lng !== "number") return null

  return {
    googlePlaceId: placeId,
    name,
    address: String(details.formatted_address ?? "").trim() || null,
    lat,
    lng,
    rating: typeof details.rating === "number" ? details.rating : null,
    ratingCount:
      typeof details.user_ratings_total === "number" ? details.user_ratings_total : null,
    category: kind,
    subCategory: guessSubCategory({
      kind: kind as "restaurant" | "bar" | "stay",
      name: details.name,
      types: details.types,
    }),
    priceLevel: typeof details.price_level === "number" ? details.price_level : null,
    googleTypes: details.types ?? null,
    photoReferences: (details.photos ?? [])
      .slice(0, 4)
      .map((p) => p.photo_reference ?? "")
      .filter(Boolean),
    phone:
      String(
        details.formatted_phone_number ?? details.international_phone_number ?? ""
      ).trim() || null,
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
    /*
      ⚠️ Text Search 는 Places 요금 중 **제일 비싸다**(1000회당 $32).
         같은 검색어는 사람마다 계속 되풀이되므로, 한 번 받아 두면
         두 번째부터는 구글을 아예 안 부른다.
         캐시에 담는 건 place_id 목록뿐이고, 이름·평점은 `places` 표가
         자기 수명(30일)을 따로 지킨다 — 그래서 오래된 정보가 나가지 않는다.
    */
    const cacheKey = searchCacheKey(q, kind)
    const cachedIds = await getCachedSearch(cacheKey)

    let top: GoogleTextSearchItem[]

    if (cachedIds) {
      // place_id 만 아는 상태로 넘어간다. 아래 Details 캐시가 나머지를 채운다.
      top = cachedIds.slice(0, 8).map((id) => ({ place_id: id }) as GoogleTextSearchItem)
    } else {
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

      top = (json.results ?? []).slice(0, 8)

      /*
        ⚠️ 결과가 없을 때는 캐시하지 않는다. 오타로 한 번 빈손이 나온 검색어가
           보름 동안 계속 빈손으로 굳어 버린다.

        ⚠️ **`void` 로 던져 두면 안 된다.** 서버리스는 응답을 돌려주는 순간
           인스턴스를 멈춘다 — 아직 안 끝난 쓰기는 그대로 죽는다.
           실제로 그렇게 뒀다가 운영에서 캐시가 한 줄도 안 쌓였다.
           (로컬에서는 프로세스가 살아 있어서 멀쩡히 통과했다)
      */
      const ids = top.map((t) => t.place_id ?? "").filter(Boolean)
      if (ids.length > 0) await putCachedSearch(cacheKey, ids)
    }

    // 캐시 우선: 이미 아는 place_id는 구글 Place Details를 호출하지 않는다.
    // (검색 1회당 Details 최대 8회가 비용의 대부분이었음)
    const cache = await readPlacesByGoogleIds(
      top.map((item) => item.place_id ?? "").filter(Boolean)
    )
    const toCache: PlaceCacheInput[] = []
    let cacheHits = 0

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
            kind
          )
        }
        // 캐시 적중 → 구글 호출 0회
        const cached = cache.get(item.place_id)
        if (cached) {
          cacheHits += 1
          return toApiItem(cachedToDetails(cached), kind)
        }

        const details = await fetchPlaceDetails(item.place_id, apiKey)
        if (details) {
          const merged = {
            ...details,
            place_id: item.place_id,
            photos: details.photos?.length ? details.photos : basePhotos,
            user_ratings_total: details.user_ratings_total ?? item.user_ratings_total,
          }
          const cacheInput = detailsToCacheInput(merged, item.place_id, kind)
          if (cacheInput) toCache.push(cacheInput)
          return toApiItem(merged, kind)
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
          kind
        )
      })
    )

    // 사진 URL을 절대 URL로 (DB에 저장되고 네이티브 앱이 그대로 쓰기 때문)
    const origin = resolveRequestOrigin(request.url)
    const withAbsoluteUrls = detailed.map((item) => ({
      ...item,
      imageUrl: toAbsolutePhotoUrl(item.imageUrl, origin),
      image: toAbsolutePhotoUrl(item.image, origin),
      photoUrls: (item.photoUrls ?? []).map((u) => toAbsolutePhotoUrl(u, origin)),
    }))

    // 새로 받아온 것만 캐시에 기록 (실패해도 응답에는 영향 없음)
    if (toCache.length) await writePlaces(toCache)

    const googleDetailCalls = top.filter((i) => i.place_id).length - cacheHits
    console.log(
      `[api/places/search] q="${q}" 검색캐시=${cachedIds ? "적중" : "미스"} / Details 캐시적중 ${cacheHits}건 / Details 호출 ${googleDetailCalls}건`
    )

    return NextResponse.json({
      results: withAbsoluteUrls.filter((item) => Boolean(item.placeName)),
    })
  } catch (err) {
    console.error("[api/places/search] unexpected:", err)
    return NextResponse.json(
      { results: [], error: "UNEXPECTED", warning: "장소 검색 중 오류가 발생했어요." },
      { status: 200 }
    )
  }
}
