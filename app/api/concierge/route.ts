import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { buildPlacePhotoProxyUrl, resolveCoverImageUrl } from "@/lib/place-cover-image"
import { distanceMeters } from "@/lib/geo"

/**
 * AI 컨시어지 — **자유 문장**으로 묻는다 (회의 결정).
 *
 * "일월화수는 숙소 근처에서 럭셔리하게 — 와인, 루프탑, 스파" 같은 의도를
 * 제미나이가 큰 틀(후보)로 바꾸고, 우리는 그 큰 틀을 **검증하고 실행**한다:
 *   · 구글 Places 로 실존·좌표·평점 확인 (평점 4.0 미만 탈락 — 집 규칙)
 *   · 미쉐린 표(1,406곳)와 대조해 등급 뱃지
 *   · 숙소 좌표 기준 가까운 순
 * 앱 쪽 카드의 [찜에 담기]·[일정에 넣기]가 "사람의 손길" 자리다.
 *
 * ⚠️ suggest-attractions(관광명소 고정 프롬프트)의 일반화판이다. 그쪽과
 *    같은 그라운딩 전략(장소당 Text Search 1회)을 쓴다 — 상세 조회까지
 *    돌리면 타임아웃 위험.
 */
export const runtime = "nodejs"
export const maxDuration = 60

type LatLng = { lat: number; lng: number }

export type ConciergePick = {
  name: string
  localName: string
  reason: string
  kind: string
  address: string
  imageUrl: string
  rating?: number
  reviewCount?: number
  lat: number
  lng: number
  distanceKm?: number
  michelin?: string | null
}

type GoogleTextSearchItem = {
  name?: string
  formatted_address?: string
  rating?: number
  user_ratings_total?: number
  photos?: { photo_reference?: string }[]
  geometry?: { location?: { lat?: number; lng?: number } }
}

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

async function ground(
  name: string,
  city: string,
  apiKey: string,
  origin: string
): Promise<Omit<ConciergePick, "reason" | "kind" | "distanceKm" | "michelin"> | null> {
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
    return {
      name: placeName,
      localName: placeName,
      address: String(top?.formatted_address ?? "").trim(),
      imageUrl: photoUrl || resolveCoverImageUrl({ imageUrl: "", kind: "attraction", category: "관광지" }),
      rating: typeof top?.rating === "number" ? top.rating : undefined,
      reviewCount: typeof top?.user_ratings_total === "number" ? top.user_ratings_total : undefined,
      lat,
      lng,
    }
  } catch {
    return null
  }
}

/*
  비용 안전장치 (v3.2 GO 확정):
  ① 같은 도시+비슷한 질문 1시간 캐시 — 위디의 방에서 같은 걸 다시 물어도 0원
  ② 그라운딩 후보 10 → 6곳 (Text Search 회당 $0.032)
  ③ 여행당 일 상한 — 폭주 방지 뚜껑 (넘으면 정중히 내일로)
  서버리스 메모리 캐시라 인스턴스마다 따로지만, 같은 사용자의 연타는 대부분
  같은 인스턴스에 떨어진다 — 완벽보다 뚜껑이 목적이다.
*/
const CACHE = new Map<string, { at: number; results: ConciergePick[] }>()
const CACHE_TTL = 60 * 60 * 1000
const DAILY = new Map<string, { day: string; n: number }>()
const DAILY_CAP = 10

function normQuery(q: string): string {
  return q.toLowerCase().replace(/[\s.,!?~·…]/g, "").slice(0, 60)
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
      accommodation?: LatLng | null
      existingNames?: string[]
    }
    const query = String(body.query ?? "").trim().slice(0, 300)
    const city = String(body.city ?? "").trim()
    if (!query || !city) {
      return NextResponse.json({ results: [], error: "무엇을 찾는지 적어 주세요." }, { status: 200 })
    }
    const tripId = String((body as { tripId?: string }).tripId ?? "").trim()
    const country = String(body.country ?? "").trim()

    /* ① 캐시 — 같은 도시+질문이면 그대로 돌려준다 */
    const cacheKey = `${city}|${normQuery(query)}`
    const hit = CACHE.get(cacheKey)
    if (hit && Date.now() - hit.at < CACHE_TTL) {
      return NextResponse.json({ results: hit.results, cached: true })
    }

    /* ③ 여행당 일 상한 */
    if (tripId) {
      const today = new Date().toISOString().slice(0, 10)
      const d = DAILY.get(tripId)
      const n = d && d.day === today ? d.n : 0
      if (n >= DAILY_CAP) {
        return NextResponse.json(
          { results: [], error: "오늘은 위디가 많이 뛰었어요 — 내일 다시 물어봐 주세요." },
          { status: 200 }
        )
      }
      DAILY.set(tripId, { day: today, n: n + 1 })
    }
    const destination = country ? `${city}, ${country}` : city
    const existingNames = Array.isArray(body.existingNames)
      ? body.existingNames.map((n) => String(n ?? "").trim()).filter(Boolean)
      : []
    const accommodation: LatLng | null =
      body.accommodation && typeof body.accommodation.lat === "number" && typeof body.accommodation.lng === "number"
        ? body.accommodation
        : null

    /*
      의도를 그대로 준다 — 요약하거나 고치지 않는다. 사람이 쓴 문장이 곧 스펙이다.
      ⚠️ 숙소 좌표가 있으면 "그 근처 우선"을 명시한다 — 제미나이 앱과 우리의
         차이가 여기서 시작된다(제미나이는 내 숙소를 모른다).
    */
    const promptText =
      `${destination} 여행 중인 사용자의 요청: "${query}"\n` +
      (accommodation ? `사용자의 숙소 좌표는 (${accommodation.lat}, ${accommodation.lng}) — 이 근처를 우선해라.\n` : "") +
      `이 요청에 딱 맞는 실제 장소 10곳을 추천해줘. 실존하는, 지도에서 검색되는 정확한 상호만.\n` +
      `서로 겹치지 않는 다른 장소여야 하고, 관광객 함정보다 현지에서 평가가 좋은 곳을 골라라.\n` +
      (existingNames.length > 0 ? `이미 목록에 있어 제외할 곳: ${existingNames.join(", ")}\n` : "") +
      `각 장소마다: 왜 이 요청에 맞는지 한국어로 짧게(20자 내외), 그리고 종류(식당/바/카페/스파/클럽/명소/쇼핑/기타).\n` +
      `반드시 JSON 만: {"picks":[{"name":"정확한 상호","reason":"이유","kind":"종류"}]}`

    let picks: { name: string; reason: string; kind: string }[] = []
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
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
        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        const rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").replace(/```json|```/g, "").trim()
        const parsed = JSON.parse(rawText) as { picks?: Array<{ name?: string; reason?: string; kind?: string }> }
        picks = (parsed.picks ?? [])
          .map((p) => ({
            name: String(p.name ?? "").trim(),
            reason: String(p.reason ?? "").trim(),
            kind: String(p.kind ?? "기타").trim(),
          }))
          .filter((p) => p.name)
      }
    } catch {
      /* 아래에서 빈 결과로 처리 */
    }
    if (picks.length === 0) {
      return NextResponse.json({ results: [], error: "추천을 만들지 못했어요. 다시 물어봐 주세요." }, { status: 200 })
    }
    /* ② 그라운딩은 6곳까지 — Text Search 가 회당 돈이다 */
    picks = picks.slice(0, 6)

    /* 그라운딩 — 실존·좌표·평점. 평점 4.0 미만은 탈락(집 규칙) */
    const origin = new URL(request.url).origin
    const grounded = await Promise.all(picks.map((p) => ground(p.name, city, placesKey, origin)))
    let results: ConciergePick[] = []
    for (let i = 0; i < picks.length; i++) {
      const g = grounded[i]
      if (!g) continue
      if ((g.rating ?? 0) < 4.0) continue
      results.push({
        ...g,
        reason: picks[i].reason,
        kind: picks[i].kind,
        distanceKm: accommodation
          ? Math.round((distanceMeters(accommodation, { lat: g.lat, lng: g.lng }) / 1000) * 10) / 10
          : undefined,
        michelin: null,
      })
    }

    /* 겹침 제거 (같은 이름·120m 안) */
    const dedup: ConciergePick[] = []
    for (const item of results) {
      const norm = normalizeName(item.name)
      const dup = dedup.some((kept) => {
        const keptNorm = normalizeName(kept.name)
        if (norm === keptNorm) return true
        if (norm.length >= 3 && (norm.includes(keptNorm) || keptNorm.includes(norm))) return true
        return distanceMeters({ lat: item.lat, lng: item.lng }, { lat: kept.lat, lng: kept.lng }) < 120
      })
      if (!dup) dedup.push(item)
    }
    results = dedup

    /* 미쉐린 대조 — 이름 또는 150m 근접. 우리만 붙일 수 있는 뱃지 */
    const admin = getSupabaseAdmin()
    if (admin && results.length > 0) {
      const lats = results.map((r) => r.lat)
      const lngs = results.map((r) => r.lng)
      const { data: mich } = await admin
        .from("michelin_places")
        .select("name, distinction, lat, lng")
        .gte("lat", Math.min(...lats) - 0.05)
        .lte("lat", Math.max(...lats) + 0.05)
        .gte("lng", Math.min(...lngs) - 0.05)
        .lte("lng", Math.max(...lngs) + 0.05)
      for (const r of results) {
        /*
          ⚠️ 근접만으로 붙이면 안 된다 — 미쉐린 식당 옆 스파에 뱃지가 붙었다(실측).
             이름이 같거나, (식당이면서 60m 안)일 때만 인정한다.
        */
        const hit = ((mich ?? []) as { name: string; distinction: string | null; lat: number | null; lng: number | null }[]).find(
          (m) =>
            normalizeName(m.name) === normalizeName(r.name) ||
            (r.kind === "식당" &&
              m.lat != null &&
              m.lng != null &&
              distanceMeters({ lat: m.lat, lng: m.lng }, { lat: r.lat, lng: r.lng }) < 60)
        )
        if (hit) r.michelin = hit.distinction ?? "가이드 등재"
      }
    }

    /* 숙소 가까운 순 */
    if (accommodation) results.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))

    const out = results.slice(0, 6)
    CACHE.set(cacheKey, { at: Date.now(), results: out })
    if (CACHE.size > 300) {
      const oldest = [...CACHE.entries()].sort((x, y) => x[1].at - y[1].at)[0]
      if (oldest) CACHE.delete(oldest[0])
    }
    return NextResponse.json({ results: out })
  } catch (error) {
    console.error("[concierge] error:", error)
    return NextResponse.json({ results: [], error: "추천 중 오류가 났어요." }, { status: 200 })
  }
}
