import { NextResponse } from "next/server"

import { distanceMeters, type LatLng } from "@/lib/geo"

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

type PlaceSearchResultItem = {
  placeName?: string
  localName?: string
  address?: string
  imageUrl?: string
  rating?: number
  reviewCount?: number
  lat?: number
  lng?: number
}

/**
 * AI(Gemini)로 여행지의 유명 관광명소를 추천받고, 각 결과를 기존 Google Places
 * 검색(/api/places/search)으로 실제 좌표·사진·평점에 그라운딩한다.
 * 숙소 좌표가 있으면 가까운 순으로 정렬한다.
 */
export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { results: [], error: "GEMINI_API_KEY가 설정되어 있지 않아요." },
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
      `인스타그램에서 인기 있는 포토스팟, 꼭 가봐야 하는 관광명소를 8~10곳 추천해줘.\n` +
      (existingNames.length > 0
        ? `이미 일정/저장 목록에 있어서 제외해야 하는 곳: ${existingNames.join(", ")}\n`
        : "") +
      `각 장소마다 왜 추천하는지 한국어로 아주 짧게(15자 내외) 이유를 함께 알려줘.\n` +
      `반드시 다음 JSON 형태로만 응답해: {"attractions": [{"name": "지도 검색이 가능한 정확한 장소명", "reason": "짧은 추천 이유"}]}`

    const preferredFirst = ["gemini-flash-latest"]
    let candidateModels: string[] = []
    try {
      const modelsResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models",
        { headers: { "x-goog-api-key": apiKey } }
      )
      if (modelsResponse.ok) {
        const modelsData = (await modelsResponse.json()) as {
          models?: { name?: string; supportedGenerationMethods?: string[] }[]
        }
        candidateModels = (modelsData.models || [])
          .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m) => String(m.name ?? "").replace(/^models\//, ""))
          .filter((m) => Boolean(m) && !/tts|image/i.test(m))
      }
    } catch {
      // best-effort; fall back to the pinned defaults below
    }
    const allModelsToTry = Array.from(
      new Set([...preferredFirst, ...candidateModels, "gemini-1.5-flash-latest", "gemini-1.5-flash"])
    )

    let attractions: { name: string; reason: string }[] = []
    for (const model of allModelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
          }
        )
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

    // 각 추천을 기존 Google Places 검색 라우트로 그라운딩(실제 좌표/사진/평점 확보).
    const origin = new URL(request.url).origin
    const grounded = await Promise.all(
      attractions.slice(0, 10).map(async (item) => {
        try {
          const searchUrl = `${origin}/api/places/search?q=${encodeURIComponent(`${item.name} ${city}`)}`
          const res = await fetch(searchUrl, { cache: "no-store" })
          if (!res.ok) return null
          const json = (await res.json()) as { results?: PlaceSearchResultItem[] }
          const top = json.results?.[0]
          if (!top || typeof top.lat !== "number" || typeof top.lng !== "number") return null

          const distanceKm = accommodation
            ? Math.round(distanceMeters(accommodation, { lat: top.lat, lng: top.lng }) / 100) / 10
            : undefined

          const result: SuggestedAttraction = {
            name: top.placeName || item.name,
            localName: top.localName || item.name,
            reason: item.reason,
            address: top.address ?? "",
            imageUrl: top.imageUrl ?? "",
            rating: top.rating,
            reviewCount: top.reviewCount,
            lat: top.lat,
            lng: top.lng,
            distanceKm,
          }
          return result
        } catch {
          return null
        }
      })
    )

    const results = grounded
      .filter((item): item is SuggestedAttraction => Boolean(item))
      // 이미 저장/일정에 있는 곳과 겹치면 제외.
      .filter(
        (item) =>
          !existingNames.some(
            (existing) =>
              item.name.toLowerCase().includes(existing.toLowerCase()) ||
              existing.toLowerCase().includes(item.name.toLowerCase())
          )
      )

    if (accommodation) {
      results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
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
