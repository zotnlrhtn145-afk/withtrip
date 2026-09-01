import { NextResponse } from "next/server"

import { buildPlacePhotoProxyUrl, resolveRequestOrigin } from "@/lib/place-cover-image"
import {
  findCachedPlaceIdByName,
  inferCategoryFromTypes,
  writePlaces,
} from "@/lib/places-cache"
import { guessSubCategory } from "@/lib/place-subcategories"

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
/*
  ⚠️ `periods` 를 같이 받는다 — **추가 비용이 0원**이다. `opening_hours` 를
     이미 요청하고 있고, 구글은 한 응답에 글자와 숫자를 함께 준다.
     지금까지는 숫자를 버리고 글자만 썼다.
*/
type OpeningPeriod = {
  open?: { day?: number; time?: string }
  close?: { day?: number; time?: string }
}
type OpeningHours = { open_now?: boolean; weekday_text?: string[]; periods?: OpeningPeriod[] }
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
  /**
   * 그 장소의 UTC 시차(분). 현지 시각으로 영업 여부를 재려면 반드시 필요하다.
   * ⚠️ 응답에 오는 이름이 두 가지다 — 둘 다 받는다.
   */
  utc_offset?: number
  utc_offset_minutes?: number
  photos?: Photo[]
  geometry?: { location?: { lat?: number; lng?: number } }
}

/** 두 이름 중 있는 쪽을 쓴다 */
function utcOffsetOf(r: DetailsResult): number | null {
  if (typeof r.utc_offset_minutes === "number") return r.utc_offset_minutes
  if (typeof r.utc_offset === "number") return r.utc_offset
  return null
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
      /*
        도쿄 가게가 열었는지를 한국 시각으로 재면 틀린다.
        ⚠️ **웹 서비스에서는 이름이 `utc_offset` 이다.** `utc_offset_minutes` 는
           자바스크립트 라이브러리 쪽 이름이라, 여기 적으면 요청이 통째로
           INVALID_REQUEST 가 되어 **상세가 전부 빈 값으로 돌아온다**(실측).
      */
      "utc_offset",
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
      // 1순위: 캐시에서 place_id를 찾는다 (Text Search 호출 절약)
      placeId =
        (await findCachedPlaceIdByName(
          q,
          lat ? Number(lat) : undefined,
          lng ? Number(lng) : undefined
        )) ?? ""
      // 2순위: 캐시에 없으면 기존대로 구글에 물어본다
      if (!placeId) placeId = (await findPlaceId(apiKey, q, lat, lng)) ?? ""
    }
    if (!placeId) return NextResponse.json({ detail: null })

    // ⚠️ 상세는 영업시간/영업중 여부(open_now)를 보여주므로 캐시로 대체하지 않는다.
    //    (실시간 정보를 캐시하면 "영업중"이 틀리게 표시됨 + 구글 정책상으로도 부적절)
    //    대신 받아온 결과를 캐시에 써넣어서 검색 API가 재활용하게 한다.
    const r = await fetchDetails(apiKey, placeId)
    if (!r) return NextResponse.json({ detail: null })

    const photos = (r.photos ?? [])
      .slice(0, 4)
      .map((p) =>
        p.photo_reference
          ? buildPlacePhotoProxyUrl(p.photo_reference, 720, resolveRequestOrigin(request.url))
          : ""
      )
      .filter(Boolean)

    // 캐시에 써넣기 (검색 API가 재활용 → Details 호출 감소). 실패해도 응답엔 영향 없음.
    const cLat = r.geometry?.location?.lat ?? (lat ? Number(lat) : undefined)
    const cLng = r.geometry?.location?.lng ?? (lng ? Number(lng) : undefined)
    if (r.name && typeof cLat === "number" && typeof cLng === "number") {
      const category = inferCategoryFromTypes(r.types)
      await writePlaces([
        {
          googlePlaceId: r.place_id ?? placeId,
          name: r.name,
          address: r.formatted_address ?? null,
          lat: cLat,
          lng: cLng,
          rating: typeof r.rating === "number" ? r.rating : null,
          ratingCount: typeof r.user_ratings_total === "number" ? r.user_ratings_total : null,
          category,
          subCategory: guessSubCategory({
            kind: category as "restaurant" | "bar" | "stay",
            name: r.name,
            types: r.types,
          }),
          priceLevel: typeof r.price_level === "number" ? r.price_level : null,
          googleTypes: r.types ?? null,
          photoReferences: (r.photos ?? [])
            .slice(0, 4)
            .map((p) => p.photo_reference ?? "")
            .filter(Boolean),
          phone: r.formatted_phone_number ?? null,
          /*
            ⚠️ 여기서 담아 두는 게 이 변경의 핵심이다. 찜 목록에서 곳마다 구글에
               다시 물으면 1000회당 $17 라 못 한다 — 상세를 한 번 열 때 받아 둔다.
          */
          openingPeriods: r.opening_hours?.periods ?? null,
          hoursText: r.opening_hours?.weekday_text ?? null,
          utcOffsetMin: utcOffsetOf(r),
        },
      ])
    }

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
        /* 앱·웹이 현지 시각으로 직접 판단할 수 있게 숫자도 같이 준다 */
        periods: r.opening_hours?.periods ?? [],
        utcOffsetMin: utcOffsetOf(r),
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
