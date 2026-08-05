import { NextResponse } from "next/server"

import { buildGooglePlacePhotoUrl } from "@/lib/place-cover-image"

export const runtime = "nodejs"

function getApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  ).trim()
}

type Photo = { photo_reference?: string }
type OpeningHours = { open_now?: boolean; weekday_text?: string[] }
type DetailsResult = {
  place_id?: string
  name?: string
  formatted_address?: string
  formatted_phone_number?: string
  rating?: number
  user_ratings_total?: number
  price_level?: number
  types?: string[]
  editorial_summary?: { overview?: string }
  opening_hours?: OpeningHours
  photos?: Photo[]
  geometry?: { location?: { lat?: number; lng?: number } }
}

async function findPlaceId(apiKey: string, q: string, lat?: string, lng?: string): Promise<string | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json")
  url.searchParams.set("query", q)
  url.searchParams.set("language", "ko")
  url.searchParams.set("key", apiKey)
  if (lat && lng) {
    url.searchParams.set("location", `${lat},${lng}`)
    url.searchParams.set("radius", "3000")
  }
  const res = await fetch(url.toString(), { cache: "no-store" })
  if (!res.ok) return null
  const json = (await res.json()) as { results?: { place_id?: string }[] }
  return json.results?.[0]?.place_id ?? null
}

async function fetchDetails(apiKey: string, placeId: string): Promise<DetailsResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json")
  url.searchParams.set("place_id", placeId)
  url.searchParams.set(
    "fields",
    [
      "place_id",
      "name",
      "formatted_address",
      "formatted_phone_number",
      "rating",
      "user_ratings_total",
      "price_level",
      "types",
      "editorial_summary",
      "opening_hours",
      "photos",
      "geometry",
    ].join(",")
  )
  url.searchParams.set("language", "ko")
  url.searchParams.set("key", apiKey)
  const res = await fetch(url.toString(), { cache: "no-store" })
  if (!res.ok) return null
  const json = (await res.json()) as { status?: string; result?: DetailsResult }
  if (json.status !== "OK" || !json.result) return null
  return json.result
}

/**
 * GET /api/places/details?q=<장소명>&lat=&lng=&placeId=
 * 장소 상세: 대표 사진(최대 4)·영업시간·영업중 여부·카테고리·설명 등.
 */
export async function GET(request: Request) {
  const apiKey = getApiKey()
  if (!apiKey) return NextResponse.json({ error: "Google API 키가 설정되지 않았습니다." }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") ?? "").trim()
  const lat = searchParams.get("lat") ?? undefined
  const lng = searchParams.get("lng") ?? undefined
  let placeId = (searchParams.get("placeId") ?? "").trim()

  try {
    if (!placeId) {
      if (!q) return NextResponse.json({ error: "q 또는 placeId가 필요합니다." }, { status: 400 })
      placeId = (await findPlaceId(apiKey, q, lat, lng)) ?? ""
    }
    if (!placeId) return NextResponse.json({ detail: null })

    const r = await fetchDetails(apiKey, placeId)
    if (!r) return NextResponse.json({ detail: null })

    const photos = (r.photos ?? [])
      .slice(0, 4)
      .map((p) => (p.photo_reference ? buildGooglePlacePhotoUrl(p.photo_reference, apiKey, 720) : ""))
      .filter(Boolean)

    return NextResponse.json(
      {
      detail: {
        placeId: r.place_id ?? placeId,
        name: r.name ?? q,
        address: r.formatted_address ?? "",
        phone: r.formatted_phone_number ?? "",
        rating: r.rating ?? null,
        reviewCount: r.user_ratings_total ?? null,
        priceLevel: typeof r.price_level === "number" ? r.price_level : null,
        types: r.types ?? [],
        summary: r.editorial_summary?.overview ?? "",
        openNow: typeof r.opening_hours?.open_now === "boolean" ? r.opening_hours.open_now : null,
        hours: r.opening_hours?.weekday_text ?? [],
        lat: r.geometry?.location?.lat ?? (lat ? Number(lat) : null),
        lng: r.geometry?.location?.lng ?? (lng ? Number(lng) : null),
        photos,
      },
      },
      { headers: { "Cache-Control": "public, s-maxage=86400, max-age=3600, stale-while-revalidate=604800" } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "장소 상세 조회 실패"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
