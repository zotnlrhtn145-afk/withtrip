import { NextResponse } from "next/server"

/**
 * AI 블록 초안 — **큰 폭만 짠다** (회의 확정: AI는 블록, 장소는 사람).
 *
 * "6박7일. 목·금·토는 클럽, 일~수는 숙소 근처 럭셔리" → 일차별 블록:
 *   Day 5 (일) 럭셔리 휴식: 🌅 낮 스파·수영 / 🌇 저녁 와인 다이닝 / 🌃 밤 루프탑
 *
 * ⚠️ 처음 버전은 시간별 장소까지 뽑았다가 갈아엎었다 — 블록에는 상호가
 *    없어서 **유령 장소(할루시네이션)·그라운딩 비용·검증이 전부 사라진다.**
 *    장소는 앱에서 사람이 채운다(찜·컨시어지·들를 곳 찾기).
 */
export const runtime = "nodejs"
export const maxDuration = 30

export type DraftBlock = { start: string; end: string; title: string; icon: string; hint: string }
export type DraftDay = { day: number; theme: string; blocks: DraftBlock[] }

export async function POST(request: Request) {
  try {
    const geminiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim()
    if (!geminiKey) {
      return NextResponse.json({ days: [], error: "서버 설정이 없어요." }, { status: 200 })
    }

    const body = (await request.json()) as {
      query?: string
      city?: string
      country?: string
      days?: number
      startDate?: string
    }
    const query = String(body.query ?? "").trim().slice(0, 400)
    const city = String(body.city ?? "").trim()
    const dayCount = Math.min(Math.max(1, Number(body.days ?? 3)), 14)
    if (!query || !city) {
      return NextResponse.json({ days: [], error: "어떤 여행인지 적어 주세요." }, { status: 200 })
    }
    const destination = body.country ? `${city}, ${String(body.country).trim()}` : city
    const startDate = String(body.startDate ?? "").trim()

    /* 요일 — "목·금·토는 클럽" 을 일차에 맞게 풀려면 필요하다 */
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"]
    const dayLines = startDate
      ? Array.from({ length: dayCount }, (_, i) => {
          const d = new Date(`${startDate}T00:00:00`)
          d.setDate(d.getDate() + i)
          return `${i + 1}일차 = ${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`
        }).join(", ")
      : `${dayCount}일`

    const promptText =
      `${destination} ${dayCount}일 여행의 하루 구성(블록)을 짜라.\n` +
      `일차와 요일: ${dayLines}\n` +
      `사용자의 요청: "${query}"\n` +
      `규칙:\n` +
      `- 구체적인 가게·장소 이름을 절대 쓰지 마라. "숙소 근처 스파", "루프탑 바에서 한 잔"처럼 **활동의 큰 폭**만.\n` +
      `- 하루 2~4블록. 시간대는 현실적으로(느긋한 아침, 이동 여유). 첫날은 도착, 마지막 날은 출발을 감안해라.\n` +
      `- 밤 문화를 요청한 요일에는 밤 블록을 넣어라.\n` +
      `- 블록 제목은 12자 내외 한국어, 각 블록에 어울리는 이모지 하나(🌅🌇🌃☕🍜🛍🏛🧖🍷🎉 등).\n` +
      `- 블록마다 hint: 그 활동으로 그 도시에서 유명한 것을 **거리·동네·명물 수준**으로 18~28자. ` +
      `(예: "부이비엔 워킹 스트리트와 1군 루프탑 바가 몰린 곳") 구체적인 가게 이름은 여기서도 금지.\n` +
      `- 하루마다 그날 분위기를 6자 내외 테마로.\n` +
      `반드시 JSON 만: {"days":[{"day":1,"theme":"테마","blocks":[{"start":"11:00","end":"14:00","title":"블록 제목","icon":"🌅","hint":"유명한 거리·동네 한 줄"}]}]}`

    let days: DraftDay[] = []
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 18_000)
      let response: Response
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
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
      if (response.ok) {
        const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
        const rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").replace(/```json|```/g, "").trim()
        const parsed = JSON.parse(rawText) as { days?: Array<{ day?: number; theme?: string; blocks?: Array<Partial<DraftBlock>> }> }
        days = (parsed.days ?? [])
          .map((d) => ({
            day: Number(d.day ?? 0),
            theme: String(d.theme ?? "").trim().slice(0, 12),
            blocks: (d.blocks ?? [])
              .map((b) => ({
                start: String(b.start ?? "").trim(),
                end: String(b.end ?? "").trim(),
                title: String(b.title ?? "").trim().slice(0, 24),
                icon: String(b.icon ?? "✨").trim().slice(0, 4),
                /* 힌트 — "화려한 밤문화"만으론 무슨 말인지 모른다(신고). 뭐가 유명한지 한 줄 */
                hint: String((b as Partial<DraftBlock>).hint ?? "").trim().slice(0, 40),
              }))
              .filter((b) => b.title && /^\d{1,2}:\d{2}$/.test(b.start))
              .slice(0, 5),
          }))
          .filter((d) => d.day >= 1 && d.day <= dayCount && d.blocks.length > 0)
      }
    } catch {
      /* 아래에서 처리 */
    }

    if (days.length === 0) {
      return NextResponse.json({ days: [], error: "초안을 만들지 못했어요. 다시 물어봐 주세요." }, { status: 200 })
    }
    return NextResponse.json({ days })
  } catch (error) {
    console.error("[draft-itinerary] error:", error)
    return NextResponse.json({ days: [], error: "초안 생성 중 오류가 났어요." }, { status: 200 })
  }
}
