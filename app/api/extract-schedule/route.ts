import { NextResponse } from "next/server"

import { checkRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"
/** 모델이 느릴 때가 있어 여유를 준다. 아래에서 호출별로 따로 상한을 건다. */
export const maxDuration = 60

/**
 * POST /api/extract-schedule
 *
 * 여행 단톡 대화에서 **일정 후보**를 뽑는다.
 *
 * 왜 필요한가: 여행 계획은 대화 속에서 정해진다.
 * "둘째 날 오전엔 성산일출봉 갔다가 점심은 그 근처에서" 같은 말이 오간 뒤,
 * 누군가 그걸 다시 일정 화면에 옮겨 적어야 했다. 그 수고를 없앤다.
 *
 * ⚠️ **확정된 것만 뽑는다.** "거기 좋대", "가볼까?" 같은 이야기는 제외한다.
 *    일정이 멋대로 늘어나면 사용자가 기능 자체를 안 믿게 된다.
 *    그리고 서버는 후보만 돌려주고, **등록 여부는 사용자가 화면에서 고른다.**
 */

type GeminiModel = { name?: string; supportedGenerationMethods?: string[] }

/** 낮을수록 먼저 시도한다. 실험·미리보기 모델은 뒤로 민다. */
function score(name: string): number {
  if (/(exp|preview|thinking)/.test(name)) return 2
  if (/lite/.test(name)) return 1
  return 0
}

export type ScheduleCandidate = {
  /** 며칠째 (1~) — 모르면 null */
  day: number | null
  /** 장소·일정 이름 */
  place: string
  /** HH:MM — 모르면 빈 문자열 */
  time: string
  /** 이동 | 숙소 | 관광 | 식사 | 카페 */
  category: string
  /** 근거가 된 대화 한 줄 — 사용자가 맞는지 판단할 수 있게 */
  quote: string
}

const CATEGORIES = ["이동", "숙소", "관광", "식사", "카페"]
const MAX_CANDIDATES = 12

function buildPrompt(days: number, transcript: string): string {
  return (
    `아래는 친구들끼리 여행 계획을 이야기한 단톡 대화다. ` +
    `여기서 **가기로 한 장소**를 뽑아라.\n\n` +
    `무엇을 넣나:\n` +
    `- "가자", "먹자", "예약했어", "거기로 하자" 처럼 **가기로 한 곳**.\n` +
    // ⚠️ 시간·날짜가 불확실하다고 빼면 안 된다. 실제로 "우리 소수헌 가자 2시쯤이
    //    좋을려나?" 를 통째로 걸러서 아무것도 못 뽑은 적이 있다.
    //    장소는 정해졌고 시간만 의논 중인 경우가 대화에서는 훨씬 흔하다.
    `- **시간이나 날짜가 아직 불확실해도 장소가 정해졌으면 넣는다.**\n` +
    `  예: "소수헌 가자 2시쯤이 좋을려나?" → 장소는 확정, 시간만 미정 → 넣는다(time 은 빈 문자열).\n\n` +
    `무엇을 빼나:\n` +
    `- "어디 갈까?", "뭐 먹지?" 처럼 **장소가 아직 안 정해진** 이야기.\n` +
    `- "거기 좋대", "가보고 싶다" 처럼 **가기로 한 게 아닌** 감상.\n` +
    `- 인사·잡담.\n\n` +
    `규칙:\n` +
    `- day 는 1부터 ${days} 사이. 며칠째인지 대화에 없으면 null (억지로 넣지 마라).\n` +
    `- time 은 "HH:MM" 24시간제. 확실하지 않으면 빈 문자열.\n` +
    `- category 는 반드시 ${CATEGORIES.join(", ")} 중 하나.\n` +
    `- quote 에는 그렇게 판단한 **근거가 된 대화 한 줄**을 그대로 옮긴다.\n` +
    `- 같은 장소가 여러 번 나오면 한 번만.\n` +
    `- 가기로 한 곳이 하나도 없으면 빈 배열. 억지로 만들지 마라.\n\n` +
    `JSON 만 출력한다:\n` +
    `{"items": [{"day": null, "place": "소수헌", "time": "", "category": "식사", "quote": "우리 소수헌 가자 2시쯤이 좋을려나?"}]}\n\n` +
    `대화:\n${transcript}`
  )
}

export async function POST(req: Request) {
  // 인증이 없는 라우트다 — 반복 호출로 AI 비용이 새지 않게 막는다
  const limited = await checkRateLimit(req, "cheap", "extract-schedule")
  if (limited) return limited

  try {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim()
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 })
    }

    const body = (await req.json()) as { transcript?: string; days?: number }
    const transcript = String(body.transcript ?? "").trim()
    if (!transcript) {
      return NextResponse.json({ error: "대화 내용이 필요합니다." }, { status: 400 })
    }
    // 너무 긴 대화는 자른다 — 최근 것이 더 중요하고 비용도 커진다
    const clipped = transcript.length > 8000 ? transcript.slice(-8000) : transcript
    const days = Math.min(Math.max(Number(body.days) || 7, 1), 30)

    // 계정마다 노출되는 모델명이 달라 목록을 먼저 조회한다 (다른 라우트와 같은 방식)
    let models: string[] = []
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": apiKey },
      })
      if (res.ok) {
        const data = (await res.json()) as { models?: GeminiModel[] }
        models = (data.models ?? [])
          .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
          .map((m) => String(m.name ?? "").replace(/^models\//, ""))
          .filter((n) => n.includes("flash"))
          // ⚠️ 목록에는 실험·미리보기 모델이 섞여 있고 이름 순서도 보장되지 않는다.
          //    앞의 2개만 시도하도록 줄였다가 **동작하던 모델이 뒤로 밀려 전부 실패**한 적이 있다.
          //    안정판(exp/preview/thinking 이 아닌 것)을 앞으로 보낸다.
          .sort((a, b) => score(a) - score(b))
      }
    } catch {
      /* 목록 조회 실패는 무시하고 기본값으로 */
    }
    /*
      ⚠️ 죽은 이름을 폴백으로 두지 않는다. `gemini-2.0-flash`·`gemini-1.5-flash`
         는 이 계정에 없어서(404) 두드려 봐야 시간만 버리고 끝은 같은 실패다.
         목록을 못 받으면 빨리 말해 주는 게 낫다.
    */
    if (models.length === 0) {
      return NextResponse.json({ items: [], reason: "모델 목록을 받지 못했습니다" })
    }

    // 한 번은 90초를 넘겨 응답이 끊긴 적이 있다 → 호출마다 20초 상한을 건다.
    // 시도 횟수는 줄이지 않는다. 2회로 줄였더니 동작하던 모델이 밀려나 전부 실패했다.
    for (const model of models.slice(0, 4)) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 20_000)
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              contents: [{ parts: [{ text: buildPrompt(days, clipped) }] }],
              generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
            }),
            signal: controller.signal,
          }
        )
        if (!res.ok) continue

        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
        if (!text) continue

        const parsed = JSON.parse(text) as { items?: ScheduleCandidate[] }
        const items = (parsed.items ?? [])
          .filter((it) => String(it?.place ?? "").trim())
          .map((it) => ({
            day: Number.isFinite(Number(it.day)) && Number(it.day) > 0 ? Number(it.day) : null,
            place: String(it.place).trim(),
            time: /^\d{1,2}:\d{2}$/.test(String(it.time ?? "")) ? String(it.time) : "",
            category: CATEGORIES.includes(String(it.category)) ? String(it.category) : "관광",
            quote: String(it.quote ?? "").trim().slice(0, 120),
          }))
          .slice(0, MAX_CANDIDATES)

        return NextResponse.json({ items })
      } catch {
        continue
      } finally {
        clearTimeout(timer)
      }
    }

    return NextResponse.json({ items: [], error: "대화를 분석하지 못했어요." })
  } catch (e) {
    console.error("[extract-schedule]", e)
    return NextResponse.json({ items: [], error: "분석 중 오류가 발생했습니다." }, { status: 500 })
  }
}
