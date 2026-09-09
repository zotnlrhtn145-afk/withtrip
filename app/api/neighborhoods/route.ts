import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { distanceMeters } from "@/lib/geo"

/**
 * 동네 추천 — "숙소를 어느 동네에 잡을까" (회의 확정, 목업 ⑬).
 *
 * AI 는 동네 이름만 뽑고, 채점은 우리가 **실측 데이터**로 한다:
 *   · 미쉐린 좌표 격자 — 중심 1.5km 안의 스타/빕구르망 개수
 *     (실측: 스타는 부촌에 밀집 — 서울 강남 61%·도쿄 미나토+긴자 67%·HCMC 1군 전부.
 *      빕구르망은 반대로 로컬 동네 — 마포·종로에 몰리고 강남은 0)
 *   · 플래그십 5성 브랜드 — 스타가 희소한 도시의 보조지표 (사용자 제안:
 *     불가리·리츠칼튼·JW메리어트·W 같은 브랜드는 그 도시 최고 입지에만 짓는다)
 *
 * 스타일 조건부: 럭셔리/파인다이닝 요청이면 스타·플래그십에, 로컬/맛집
 * 요청이면 빕구르망에 무게를 둔다. **주소 파싱은 하지 않는다** — 나라마다
 * 주소 체계가 달라서 좌표 격자만 쓴다(회의 결정).
 */
export const runtime = "nodejs"
export const maxDuration = 60

type LatLng = { lat: number; lng: number }

/** 최고 입지에만 짓는 브랜드 — 이름에 이 낱말이 있으면 플래그십으로 본다 */
const FLAGSHIP_BRANDS = [
  ["불가리", "bulgari", "bvlgari"],
  ["리츠칼튼", "리츠 칼튼", "ritz-carlton", "ritz carlton"],
  ["jw 메리어트", "jw메리어트", "jw marriott"],
  ["w 호텔", "w hotel", "w seoul", "w osaka", "w bangkok", "w taipei", "w hong kong"],
  ["포시즌스", "four seasons"],
  ["파크 하얏트", "파크하얏트", "park hyatt"],
  ["세인트 레지스", "세인트레지스", "st. regis", "st regis"],
  ["만다린 오리엔탈", "mandarin oriental"],
  ["페닌슐라", "peninsula"],
  ["아만", "aman"],
  ["로즈우드", "rosewood"],
  ["샹그릴라", "shangri-la", "shangri la"],
]

function matchFlagship(name: string): boolean {
  const n = name.toLowerCase()
  return FLAGSHIP_BRANDS.some((alts) => alts.some((a) => n.includes(a)))
}

export type NeighborhoodPick = {
  name: string
  localName: string
  reason: string
  /** upscale=부촌·럭셔리 / local=로컬·맛집 */
  vibe: string
  lat: number
  lng: number
  /** 중심 1.5km 안 미쉐린 스타(1~3스타) 식당 수 */
  stars: number
  /** 중심 1.5km 안 빕구르망·셀렉티드 수 */
  bibs: number
  /** 실존 확인된 플래그십 5성 호텔 이름들 */
  flagships: string[]
  /** 기존 일정 중심에서 얼마나 먼가(km) — 일정이 있을 때만 */
  distanceKm?: number
  score: number
}

type GoogleItem = {
  name?: string
  rating?: number
  geometry?: { location?: { lat?: number; lng?: number } }
}

function getPlacesApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  ).trim()
}

async function textSearch(query: string, apiKey: string): Promise<GoogleItem[]> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json")
    url.searchParams.set("query", query)
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
    if (!res.ok) return []
    const json = (await res.json()) as { results?: GoogleItem[] }
    return json.results ?? []
  } catch {
    return []
  }
}

export async function POST(request: Request) {
  try {
    const geminiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim()
    const placesKey = getPlacesApiKey()
    if (!geminiKey || !placesKey) {
      return NextResponse.json({ results: [], error: "서버 설정이 없어요." }, { status: 200 })
    }

    const body = (await request.json()) as {
      query?: string
      city?: string
      country?: string
      /** 이미 잡힌 일정들의 좌표 — 그 중심 근처 동네를 우선한다 */
      scheduleCoords?: LatLng[]
    }
    const query = String(body.query ?? "").trim().slice(0, 300)
    const city = String(body.city ?? "").trim()
    if (!city) {
      return NextResponse.json({ results: [], error: "도시가 필요해요." }, { status: 200 })
    }
    const country = String(body.country ?? "").trim()
    const destination = country ? `${city}, ${country}` : city

    /* 기존 일정 중심 — "큰 관광지를 먼저 짜고 숙소는 나중에" 흐름의 핵심 */
    const coords = (Array.isArray(body.scheduleCoords) ? body.scheduleCoords : []).filter(
      (c) => typeof c?.lat === "number" && typeof c?.lng === "number"
    )
    const centroid: LatLng | null =
      coords.length > 0
        ? {
            lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
            lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
          }
        : null

    const promptText =
      `${destination} 에서 숙소 잡기 좋은 동네(구역) 5곳을 추천해라.\n` +
      (query ? `여행 스타일: "${query}"\n` : "") +
      (centroid
        ? `사용자의 일정 중심 좌표는 (${centroid.lat.toFixed(4)}, ${centroid.lng.toFixed(4)}) — 오가기 좋은 동네를 우선해라.\n`
        : "") +
      `각 동네마다:\n` +
      `- name: 한국어 동네 이름 (예: "긴자", "1군(벤타인)")\n` +
      `- localName: 현지어 이름\n` +
      `- lat, lng: 동네 중심 좌표 (숫자)\n` +
      `- reason: 왜 이 스타일에 맞는지 한국어 25자 내외\n` +
      `- vibe: "upscale"(부촌·럭셔리·파인다이닝) 또는 "local"(로컬·맛집·시장) 중 스타일에 맞는 것\n` +
      `- hotels: 그 동네에 실제로 있는 최고급 5성 호텔 이름 최대 2개 (불가리·리츠칼튼·JW메리어트·W·포시즌스·파크하얏트 같은 플래그십 브랜드만. 없으면 빈 배열)\n` +
      `반드시 JSON 만: {"picks":[{"name":"","localName":"","lat":0,"lng":0,"reason":"","vibe":"","hotels":[]}]}`

    type RawPick = { name?: string; localName?: string; lat?: number; lng?: number; reason?: string; vibe?: string; hotels?: string[] }
    let picks: Required<RawPick>[] = []
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 18_000)
      let response: Response
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }
      if (response.ok) {
        const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
        const rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").replace(/```json|```/g, "").trim()
        const parsed = JSON.parse(rawText) as { picks?: RawPick[] }
        picks = (parsed.picks ?? [])
          .map((p) => ({
            name: String(p.name ?? "").trim(),
            localName: String(p.localName ?? "").trim(),
            lat: Number(p.lat ?? NaN),
            lng: Number(p.lng ?? NaN),
            reason: String(p.reason ?? "").trim(),
            vibe: p.vibe === "local" ? "local" : "upscale",
            hotels: Array.isArray(p.hotels) ? p.hotels.map((h) => String(h ?? "").trim()).filter(Boolean).slice(0, 2) : [],
          }))
          .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .slice(0, 5)
      }
    } catch {
      /* 아래에서 빈 결과 처리 */
    }
    if (picks.length === 0) {
      return NextResponse.json({ results: [], error: "동네를 뽑지 못했어요. 다시 물어봐 주세요." }, { status: 200 })
    }

    /*
      미쉐린 좌표 격자 채점 — 동네 중심 1.5km.
      한 번에 모든 동네를 덮는 네모로 읽고 메모리에서 나눈다(질의 1번).
    */
    const admin = getSupabaseAdmin()
    let mich: { distinction: string | null; lat: number | null; lng: number | null }[] = []
    if (admin) {
      const lats = picks.map((p) => p.lat)
      const lngs = picks.map((p) => p.lng)
      const pad = 0.03 // ≈ 3.3km — 1.5km 반경을 넉넉히 덮는다
      const { data } = await admin
        .from("michelin_places")
        .select("distinction, lat, lng")
        .gte("lat", Math.min(...lats) - pad)
        .lte("lat", Math.max(...lats) + pad)
        .gte("lng", Math.min(...lngs) - pad)
        .lte("lng", Math.max(...lngs) + pad)
      mich = (data ?? []) as typeof mich
    }

    /*
      플래그십 호텔 검증 — AI 가 말한 호텔이 (1) 플래그십 브랜드 사전에 있고
      (2) 실존하며 (3) 그 동네 3km 안인지. 유령 호텔이 지표가 되면 안 된다.
    */
    const results: NeighborhoodPick[] = await Promise.all(
      picks.map(async (p) => {
        const center = { lat: p.lat, lng: p.lng }
        let stars = 0
        let bibs = 0
        for (const m of mich) {
          if (m.lat == null || m.lng == null) continue
          if (distanceMeters(center, { lat: m.lat, lng: m.lng }) > 1500) continue
          const d = (m.distinction ?? "").toLowerCase()
          if (d.includes("star") || d.includes("스타")) stars += 1
          else bibs += 1
        }

        const flagships: string[] = []
        for (const h of p.hotels) {
          if (!matchFlagship(h)) continue
          const found = (await textSearch(`${h} ${city}`, placesKey))[0]
          const flat = found?.geometry?.location?.lat
          const flng = found?.geometry?.location?.lng
          if (typeof flat !== "number" || typeof flng !== "number") continue
          if (distanceMeters(center, { lat: flat, lng: flng }) > 3000) continue
          if (!matchFlagship(String(found?.name ?? ""))) continue
          flagships.push(String(found?.name ?? h))
        }

        /*
          스타일 조건부 점수 — 요청이 럭셔리면 스타·플래그십, 로컬이면 빕.
          ⚠️ 럭셔리 모드에서 빕은 양념까지만(상한 20곳 x 0.2 = 최대 4점).
             실측: HCMC 3군이 빕 37곳으로 스타 4곳·플래그십 동네를 눌렀다 —
             빕 밀집은 로컬의 증거지 럭셔리의 증거가 아니다.
        */
        const upscale = p.vibe === "upscale"
        const score = upscale
          ? stars * 5 + flagships.length * 6 + Math.min(bibs, 20) * 0.2
          : bibs * 3 + stars + flagships.length

        return {
          name: p.name,
          localName: p.localName,
          reason: p.reason,
          vibe: p.vibe,
          lat: p.lat,
          lng: p.lng,
          stars,
          bibs,
          flagships,
          distanceKm: centroid
            ? Math.round((distanceMeters(centroid, center) / 1000) * 10) / 10
            : undefined,
          score,
        }
      })
    )

    /* 점수 순 — 같은 점수면 일정 중심에 가까운 순 */
    results.sort((a, b) => b.score - a.score || (a.distanceKm ?? 99) - (b.distanceKm ?? 99))

    return NextResponse.json({ results })
  } catch (error) {
    console.error("[neighborhoods] error:", error)
    return NextResponse.json({ results: [], error: "동네 추천 중 오류가 났어요." }, { status: 200 })
  }
}
