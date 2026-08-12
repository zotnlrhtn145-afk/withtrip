import { NextResponse } from "next/server"

import { distanceMeters, type LatLng } from "@/lib/geo"
import {
  buildPlacePhotoProxyUrl,
  resolveCoverImageUrl,
  resolveRequestOrigin,
} from "@/lib/place-cover-image"

export const runtime = "nodejs"

type SuggestedAttraction = {
  name: string
  localName: string
  reason: string
  address: string
  imageUrl: string
  rating?: number
  reviewCount?: number
  lat: number
  lng: number
  distanceKm?: number
}

type GoogleTextSearchItem = {
  name?: string
  formatted_address?: string
  rating?: number
  user_ratings_total?: number
  photos?: { photo_reference?: string }[]
  geometry?: { location?: { lat?: number; lng?: number } }
}

/** 이름 비교용 정규화 — 공백·구두점 제거, 소문자화. "마리나 베이"와 "마리나베이"를 같게 본다. */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s·・‧,.()[\]{}'"!?~\-–—_/]/g, "")
    .trim()
}

function getPlacesApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  ).trim()
}

/**
 * 가벼운 그라운딩 — Text Search 1회만 호출한다(장소당 최대 8곳의 상세정보를
 * 추가로 부르는 /api/places/search를 거치면 지연이 커져 타임아웃 위험이 있다).
 */
async function groundAttraction(
  name: string,
  city: string,
  apiKey: string,
  origin: string
): Promise<Omit<SuggestedAttraction, "reason" | "distanceKm"> | null> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json")
    url.searchParams.set("query", `${name} ${city}`)
    url.searchParams.set("key", apiKey)
    url.searchParams.set("language", "ko")

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)
    let res: Response
    try {
      res = await fetch(url.toString(), { cache: "no-store", signal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }
    if (!res.ok) return null
    const json = (await res.json()) as { results?: GoogleTextSearchItem[] }
    const top = json.results?.[0]
    const lat = top?.geometry?.location?.lat
    const lng = top?.geometry?.location?.lng
    if (typeof lat !== "number" || typeof lng !== "number") return null

    const placeName = String(top?.name ?? name).trim()
    const photoRef = top?.photos?.[0]?.photo_reference
    const photoUrl = photoRef ? buildPlacePhotoProxyUrl(photoRef, 1200, origin) : ""
    const imageUrl =
      photoUrl ||
      resolveCoverImageUrl({ imageUrl: "", kind: "attraction", category: "관광지" })

    return {
      name: placeName,
      localName: placeName,
      address: String(top?.formatted_address ?? "").trim(),
      imageUrl,
      rating: typeof top?.rating === "number" ? top.rating : undefined,
      reviewCount:
        typeof top?.user_ratings_total === "number" ? top.user_ratings_total : undefined,
      lat,
      lng,
    }
  } catch {
    return null
  }
}

/**
 * AI(Gemini)로 여행지의 유명 관광명소를 추천받고, 각 결과를 Google Places
 * Text Search로 실제 좌표·사진·평점에 그라운딩한다.
 * 숙소 좌표가 있으면 가까운 순으로 정렬한다.
 */
export async function POST(request: Request) {
  try {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (!geminiKey) {
      return NextResponse.json(
        { results: [], error: "GEMINI_API_KEY가 설정되어 있지 않아요." },
        { status: 200 }
      )
    }
    const placesKey = getPlacesApiKey()
    if (!placesKey) {
      return NextResponse.json(
        { results: [], error: "GOOGLE_PLACES_API_KEY가 설정되어 있지 않아요." },
        { status: 200 }
      )
    }

    const body = (await request.json()) as {
      city?: string
      country?: string
      existingNames?: string[]
      accommodation?: LatLng | null
    }

    const city = String(body.city ?? "").trim()
    if (!city) {
      return NextResponse.json({ results: [], error: "여행지 정보가 없어요." }, { status: 200 })
    }
    const country = String(body.country ?? "").trim()
    const destination = country ? `${city}, ${country}` : city
    const existingNames = Array.isArray(body.existingNames)
      ? body.existingNames.map((name) => String(name ?? "").trim()).filter(Boolean)
      : []
    const accommodation: LatLng | null =
      body.accommodation &&
      typeof body.accommodation.lat === "number" &&
      typeof body.accommodation.lng === "number"
        ? body.accommodation
        : null

    const promptText =
      `${destination} 여행을 계획 중이다. 현지인과 여행 인플루언서들 사이에서 유명한 랜드마크, ` +
      `인스타그램에서 인기 있는 포토스팟, 꼭 가봐야 하는 관광명소를 12곳 추천해줘.\n` +
      `단, 서로 겹치지 않는 완전히 다른 장소여야 한다. 같은 랜드마크의 다른 이름/표기(예: "마리나베이", ` +
      `"마리나 베이 샌즈", "마리나베이 야경")나 같은 건물·구역 안의 세부 스팟은 하나로만 추천하고, ` +
      `서로 다른 지역에 골고루 분포된 대표 명소들로 골라줘.\n` +
      (existingNames.length > 0
        ? `이미 일정/저장 목록에 있어서 제외해야 하는 곳: ${existingNames.join(", ")}\n`
        : "") +
      `각 장소마다 왜 추천하는지 한국어로 아주 짧게(15자 내외) 이유를 함께 알려줘.\n` +
      `반드시 다음 JSON 형태로만 응답해: {"attractions": [{"name": "지도 검색이 가능한 정확한 장소명", "reason": "짧은 추천 이유"}]}`

    // 모델 목록 조회(GET /v1beta/models)는 왕복 하나를 더 태워 지연만 키우므로 생략하고,
    // 알려진 빠른 모델을 고정 순서로 바로 시도한다. 시도당 12초 타임아웃으로 느린
    // 모델에서 전체가 멈추지 않게 한다.
    const allModelsToTry = [
      "gemini-flash-latest",
      "gemini-2.0-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
    ]

    let attractions: { name: string; reason: string }[] = []
    for (const model of allModelsToTry) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 12_000)
        let response: Response
        try {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
              body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { responseMimeType: "application/json" },
              }),
              signal: controller.signal,
            }
          )
        } finally {
          clearTimeout(timeout)
        }
        if (!response.ok) continue

        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!rawText) continue
        rawText = rawText.replace(/```json|```/g, "").trim()
        const parsed = JSON.parse(rawText) as {
          attractions?: Array<{ name?: string; reason?: string }>
        }
        attractions = (parsed.attractions ?? [])
          .map((item) => ({
            name: String(item.name ?? "").trim(),
            reason: String(item.reason ?? "").trim(),
          }))
          .filter((item) => item.name)
        if (attractions.length > 0) break
      } catch {
        continue
      }
    }

    if (attractions.length === 0) {
      return NextResponse.json(
        { results: [], error: "추천 결과를 만들지 못했어요. 잠시 후 다시 시도해 주세요." },
        { status: 200 }
      )
    }

    // 각 추천을 Google Places Text Search로 그라운딩(실제 좌표/사진/평점 확보).
    const origin = resolveRequestOrigin(request.url)
    const grounded = await Promise.all(
      attractions.slice(0, 12).map(async (item) => {
        const base = await groundAttraction(item.name, city, placesKey, origin)
        if (!base) return null
        const distanceKm = accommodation
          ? Math.round(distanceMeters(accommodation, { lat: base.lat, lng: base.lng }) / 100) / 10
          : undefined
        const result: SuggestedAttraction = { ...base, reason: item.reason, distanceKm }
        return result
      })
    )

    const filtered = grounded
      .filter((item): item is SuggestedAttraction => Boolean(item))
      // 이미 저장/일정에 있는 곳과 겹치면 제외.
      .filter((item) => {
        const itemNorm = normalizeName(item.name)
        return !existingNames.some((existing) => {
          const exNorm = normalizeName(existing)
          if (!exNorm) return false
          return itemNorm.includes(exNorm) || exNorm.includes(itemNorm)
        })
      })

    // 숙소가 있으면 가까운 순으로 먼저 정렬 → 아래 중복 제거에서 클러스터의 가장 가까운 곳을 남긴다.
    if (accommodation) {
      filtered.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    }

    // 추천끼리의 중복 제거: 이름이 같거나 포함관계이거나, 좌표가 매우 가까우면(같은 장소가
    // 다른 이름으로 그라운딩된 경우) 하나만 남긴다. "마리나베이"류 중복 방지.
    const results: SuggestedAttraction[] = []
    for (const item of filtered) {
      const norm = normalizeName(item.name)
      if (!norm) continue
      const overlaps = results.some((kept) => {
        const keptNorm = normalizeName(kept.name)
        if (norm === keptNorm) return true
        if (norm.length >= 3 && (norm.includes(keptNorm) || keptNorm.includes(norm))) return true
        return (
          distanceMeters({ lat: item.lat, lng: item.lng }, { lat: kept.lat, lng: kept.lng }) < 120
        )
      })
      if (!overlaps) results.push(item)
    }

    return NextResponse.json({ results: results.slice(0, 8) })
  } catch (error) {
    console.error("[suggest-attractions] error:", error)
    return NextResponse.json(
      { results: [], error: "관광지 추천 중 오류가 발생했어요." },
      { status: 200 }
    )
  }
}
