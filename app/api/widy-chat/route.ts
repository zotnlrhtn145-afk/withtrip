import { NextResponse } from "next/server"

/**
 * 위디의 머리 — **라우터 + 답변** (신고 반영: "말만 많고 틀린 대답만 해").
 *
 * 정규식 의도 분류는 "헬스장"조차 놓쳤고, "아니 그런 장소를 검색해 줘야지"처럼
 * 맥락을 가리키는 말에서 앞 대화(헬스장)를 잃었다. 그래서:
 *   · 제미나이가 **최근 대화까지 보고** 무엇을 원하는지 판단한다
 *   · places/blocks 면 **맥락을 합쳐 스스로 완결된 검색어**를 만들어 준다
 *     ("아니 검색해 줘야지" → "기구가 많고 규모 큰 대형 헬스장")
 *   · chat 이면 2~3문장 답 (가게 이름 지어내기 금지)
 * 그라운딩 없음 — 턴당 ~3원.
 */
export const runtime = "nodejs"
export const maxDuration = 20

export async function POST(request: Request) {
  try {
    const geminiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim()
    if (!geminiKey) return NextResponse.json({ mode: "chat", reply: null, error: "서버 설정이 없어요." }, { status: 200 })

    const body = (await request.json()) as {
      query?: string
      history?: { role?: string; text?: string }[]
      city?: string
      country?: string
      startDate?: string
    }
    const query = String(body.query ?? "").trim().slice(0, 400)
    if (!query) return NextResponse.json({ mode: "chat", reply: null }, { status: 200 })
    const city = String(body.city ?? "").trim()
    const country = String(body.country ?? "").trim()
    const history = (Array.isArray(body.history) ? body.history : [])
      .slice(-8)
      .map((h) => `${h.role === "widy" ? "위디" : "사용자"}: ${String(h.text ?? "").slice(0, 90)}`)
      .join("\n")

    const promptText =
      `너는 "위디(Widy)" — 여행 앱 위드트립의 여행 동행 AI다.\n` +
      (city ? `사용자는 ${city}${country ? ` (${country})` : ""} 여행 중/준비 중이다.\n` : "") +
      (history ? `최근 대화:\n${history}\n` : "") +
      `사용자의 새 말: "${query}"\n\n` +
      `사용자가 지금 원하는 것을 판단해라:\n` +
      `1) "places" — 실제 장소(식당·카페·바·헬스장·스파·클럽·쇼핑·명소 등 어떤 종류든)를 찾거나 추천받고 싶다.\n` +
      `   조금이라도 장소를 원하면 places 다. 이때 search 에 **앞 대화의 맥락까지 합쳐 그 자체로 완결된** 한국어 검색 문장을 만들어라.\n` +
      `   (예: 앞에서 헬스장 얘기 중 "아니 그런 장소를 검색해 줘야지" → search: "기구가 많고 규모가 큰 대형 헬스장")\n` +
      `2) "blocks" — 여행 일정(하루 구성·며칠 계획·큰 틀)을 짜 달라고 한다. search 에 요청을 완결된 문장으로.\n` +
      `3) "chat" — 그 외 잡담·질문·상의. reply 에 2~3문장, 친근한 존댓말. 구체적인 가게·시설 이름은 절대 지어내지 마라(동네·거리 수준까지만).\n` +
      `   장소를 원하는 것 같은데 확신이 없으면 chat 이 아니라 places 를 골라라.\n` +
      `반드시 JSON 만: {"mode":"places|blocks|chat","search":"...","reply":"..."}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 13_000)
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
    if (!response.ok) return NextResponse.json({ mode: "chat", reply: null }, { status: 200 })
    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").replace(/```json|```/g, "").trim()
    try {
      const parsed = JSON.parse(rawText) as { mode?: string; search?: string; reply?: string }
      const mode = parsed.mode === "places" || parsed.mode === "blocks" ? parsed.mode : "chat"
      return NextResponse.json({
        mode,
        search: String(parsed.search ?? "").trim().slice(0, 200) || null,
        reply: String(parsed.reply ?? "").trim().slice(0, 500) || null,
      })
    } catch {
      return NextResponse.json({ mode: "chat", reply: rawText.slice(0, 500) || null })
    }
  } catch {
    return NextResponse.json({ mode: "chat", reply: null }, { status: 200 })
  }
}
