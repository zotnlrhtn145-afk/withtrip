import { NextResponse } from "next/server"

/**
 * 위디의 잡담·일반 질문 답변 — **항상 대답하는 위디** (신고: "질문에 대한 답변도 없어").
 *
 * 블록·장소 의도가 아닌 말(질문·상의·수다)에도 위디가 사람처럼 답한다.
 * 제미나이 플래시만 쓴다(턴당 ~3원) — 그라운딩 없음, 가게 이름 지어내기 금지.
 */
export const runtime = "nodejs"
export const maxDuration = 20

export async function POST(request: Request) {
  try {
    const geminiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim()
    if (!geminiKey) return NextResponse.json({ reply: null, error: "서버 설정이 없어요." }, { status: 200 })

    const body = (await request.json()) as {
      query?: string
      city?: string
      country?: string
      title?: string
      startDate?: string
      endDate?: string
    }
    const query = String(body.query ?? "").trim().slice(0, 400)
    if (!query) return NextResponse.json({ reply: null }, { status: 200 })
    const city = String(body.city ?? "").trim()
    const country = String(body.country ?? "").trim()

    const promptText =
      `너는 "위디(Widy)" — 여행 앱 위드트립의 여행 동행 AI다. 친근한 한국어 존댓말로 답해라.\n` +
      (city ? `지금 사용자는 ${city}${country ? ` (${country})` : ""} 여행을 준비/진행 중이다.` : "") +
      (body.title ? ` 여행 이름: "${String(body.title).slice(0, 40)}".` : "") +
      (body.startDate ? ` 기간: ${body.startDate}${body.endDate ? ` ~ ${body.endDate}` : ""}.` : "") +
      `\n사용자의 말: "${query}"\n` +
      `규칙:\n` +
      `- 2~3문장, 짧고 다정하게. 이모지 금지.\n` +
      `- 구체적인 가게·식당·호텔 이름을 절대 지어내지 마라. 동네·거리·활동 수준까지만.\n` +
      `- 여행과 무관한 말이어도 가볍게 받아주고, 자연스러우면 여행 준비로 살짝 이어라.\n` +
      `- 일정을 짜 달라는 말이면 "요일이나 분위기까지 적어 주시면 큰 폭을 잡아 드려요"라고 안내해라.\n` +
      `답변 텍스트만 출력해라.`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    let response: Response
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!response.ok) return NextResponse.json({ reply: null }, { status: 200 })
    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const reply = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim().slice(0, 500)
    return NextResponse.json({ reply: reply || null })
  } catch {
    return NextResponse.json({ reply: null }, { status: 200 })
  }
}
