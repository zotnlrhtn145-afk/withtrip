import { NextResponse } from "next/server"

import { buildPlacePhotoProxyUrl, resolveCoverImageUrl } from "@/lib/place-cover-image"
import { distanceMeters } from "@/lib/geo"

/**
 * AI 일정 초안 — **백지에서 문장 하나로 기본 틀을 잡는다** (회의 결정).
 *
 * "6박7일. 목·금·토는 클럽·유흥, 일·월·화·수는 숙소 근처에서 럭셔리하게"
 * → 일차별 시간표 초안 (아침~밤 3~5칸) → 앱에서 검토·수정 후 한 번에 채움.
 *
 * 컨시어지(장소 추천)의 윗층이다: 컨시어지는 "어디 갈까"의 답, 이건
 * "여행 전체의 뼈대"의 답. 같은 검증(구글 실존·평점 4.0+)을 통과한다.
 *
 * ⚠️ 그라운딩 비용: 초안 하나에 장소 15~25곳 × Text Search 1회. 초안은
 *    여행당 한두 번 쓰는 기능이라 감수한다 — 자동으로 반복 호출하는 곳에
 *    이 API 를 물리지 말 것.
 */
export const runtime = "nodejs"
export const maxDuration = 60

type LatLng = { lat: number; lng: number }

export type DraftSlot = {
  time: string
  name: string
  reason: string
  kind: string
  address: string
  imageUrl: string
  rating?: number
  lat: number
  lng: number
  distanceKm?: number
}

export type DraftDay = { day: number; theme: string; slots: DraftSlot[] }

type GoogleTextSearchItem = {
  name?: string
  formatted_address?: string
  rating?: number
  user_ratings_total?: number
  photos?: { photo_reference?: string }[]
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

async function ground(name: string, city: string, apiKey: string, origin: string) {
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
    const photoRef = top?.photos?.[0]?.photo_reference
    return {
      name: String(top?.name ?? name).trim(),
      address: String(top?.formatted_address ?? "").trim(),
      imageUrl: photoRef
        ? buildPlacePhotoProxyUrl(photoRef, 800, origin)
        : resolveCoverImageUrl({ imageUrl: "", kind: "attraction", category: "관광지" }),
      rating: typeof top?.rating === "number" ? top.rating : undefined,
      lat,
      lng,
    }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const geminiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim()
    const placesKey = getPlacesApiKey()
    if (!geminiKey || !placesKey) {
      return NextResponse.json({ days: [], error: "서버 설정이 없어요." }, { status: 200 })
    }

    const body = (await request.json()) as {
      query?: string
      city?: string
      country?: string
      days?: number
      startDate?: string
      accommodation?: LatLng | null
    }
    const query = String(body.query ?? "").trim().slice(0, 400)
    const city = String(body.city ?? "").trim()
    const dayCount = Math.min(Math.max(1, Number(body.days ?? 3)), 10)
    if (!query || !city) {
      return NextResponse.json({ days: [], error: "어떤 여행인지 적어 주세요." }, { status: 200 })
    }
    const country = String(body.country ?? "").trim()
    const destination = country ? `${city}, ${country}` : city
    const startDate = String(body.startDate ?? "").trim()
    const accommodation: LatLng | null =
      body.accommodation && typeof body.accommodation.lat === "number" && typeof body.accommodation.lng === "number"
        ? body.accommodation
        : null

    /* 요일 정보 — "목·금·토는 클럽" 같은 요청을 일차에 맞게 풀려면 필요하다 */
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
    const dayLines = startDate
      ? Array.from({ length: dayCount }, (_, i) => {
          const d = new Date(`${startDate}T00:00:00`)
          d.setDate(d.getDate() + i)
          return `${i + 1}일차 = ${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`
        }).join(", ")
      : `${dayCount}일`

    const promptText =
      `${destination} ${dayCount}일 여행의 일정 초안을 짜라.\n` +
      `일차와 요일: ${dayLines}\n` +
      `사용자의 요청: "${query}"\n` +
      (accommodation ? `숙소 좌표 (${accommodation.lat}, ${accommodation.lng}) 근처 동선을 우선해라.\n` : "") +
      `규칙:\n` +
      `- 하루 3~5칸. 시간은 현실적으로(아침 늦게 시작, 이동 시간 고려). 밤 문화 요청이 있는 날은 밤 칸을 넣어라.\n` +
      `- 장소는 전부 실존하는, 지도에서 검색되는 정확한 상호. 같은 장소 반복 금지.\n` +
      `- 관광객 함정보다 평가 좋은 곳. 각 칸마다 한국어로 짧은 이유(15자 내외)와 종류(식당/바/카페/스파/클럽/명소/쇼핑/기타).\n` +
      `- 하루마다 그날의 분위기를 5자 내외 테마로.\n` +
      `반드시 JSON 만: {"days":[{"day":1,"theme":"테마","slots":[{"time":"11:30","name":"정확한 상호","reason":"이유","kind":"종류"}]}]}`

    let plan: { day: number; theme: string; slots: { time: string; name: string; reason: string; kind: string }[] }[] = []
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20_000)
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
        const parsed = JSON.parse(rawText) as { days?: typeof plan }
        plan = (parsed.days ?? [])
          .map((d) => ({
            day: Number(d.day ?? 0),
            theme: String(d.theme ?? "").trim(),
            slots: (d.slots ?? [])
              .map((sl) => ({
                time: String(sl.time ?? "").trim(),
                name: String(sl.name ?? "").trim(),
                reason: String(sl.reason ?? "").trim(),
                kind: String(sl.kind ?? "기타").trim(),
              }))
              .filter((sl) => sl.name && /^\d{1,2}:\d{2}$/.test(sl.time)),
          }))
          .filter((d) => d.day >= 1 && d.day <= dayCount && d.slots.length > 0)
      }
    } catch {
      /* 아래에서 처리 */
    }
    if (plan.length === 0) {
      return NextResponse.json({ days: [], error: "초안을 만들지 못했어요. 다시 물어봐 주세요." }, { status: 200 })
    }

    /* 그라운딩 — 이름별 한 번만 (같은 곳이 여러 날 나와도 검색은 1회) */
    const origin = new URL(request.url).origin
    const uniqueNames = [...new Set(plan.flatMap((d) => d.slots.map((sl) => sl.name)))]
    const groundedBy = new Map<string, Awaited<ReturnType<typeof ground>>>()
    await Promise.all(
      uniqueNames.map(async (n) => {
        groundedBy.set(n, await ground(n, city, placesKey, origin))
      })
    )

    const days: DraftDay[] = plan.map((d) => ({
      day: d.day,
      theme: d.theme,
      slots: d.slots
        .map((sl) => {
          const g = groundedBy.get(sl.name)
          if (!g) return null
          /* 실존 확인 실패·평점 4.0 미만 탈락 — 집 규칙. 초안에 유령이 섞이면 끝장이다 */
          if ((g.rating ?? 0) < 4.0) return null
          return {
            time: sl.time,
            name: g.name,
            reason: sl.reason,
            kind: sl.kind,
            address: g.address,
            imageUrl: g.imageUrl,
            rating: g.rating,
            lat: g.lat,
            lng: g.lng,
            distanceKm: accommodation
              ? Math.round((distanceMeters(accommodation, { lat: g.lat, lng: g.lng }) / 1000) * 10) / 10
              : undefined,
          }
        })
        .filter((sl): sl is DraftSlot => !!sl),
    }))

    return NextResponse.json({ days: days.filter((d) => d.slots.length > 0) })
  } catch (error) {
    console.error("[draft-itinerary] error:", error)
    return NextResponse.json({ days: [], error: "초안 생성 중 오류가 났어요." }, { status: 200 })
  }
}
