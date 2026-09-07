import { NextResponse } from "next/server"

import { checkRateLimit } from "@/lib/rate-limit"
import {
  flashModelCandidates,
  isBillingProblem,
  isTransient,
  markModelGone,
  modelFailed,
  rememberModel,
  sleep,
  TEXT_PURPOSE,
} from "@/lib/gemini-models"

export const runtime = "nodejs"

/**
 * 표(항공권·KTX·버스) 사진을 읽어 이동수단 칸을 채운다.
 *
 * ## 왜 만들었나
 *
 * 이동수단을 넣으려면 항공사·편명·출발지·도착지·날짜·시각을 **여섯 칸 넘게**
 * 손으로 옮겨 적어야 했다. 표는 이미 손에 있는데 그걸 보고 베끼는 셈이다.
 * 캡처 한 장이면 끝나야 한다.
 *
 * ⚠️ **탑승자는 읽지 않는다.** 표에 적힌 이름은 로마자·약자라 우리 멤버와
 *    잇기 어렵고, 잘못 이으면 「내가 안 탄 비행기」가 내 일정에 들어간다.
 *    사람은 앱에서 고르는 게 빠르고 확실하다(사용자 요청도 그러했다).
 *
 * ⚠️ 값은 **모르면 비운다.** 지어내면 사용자가 틀린 줄 모르고 저장한다.
 *    비어 있으면 눈에 띄고, 그 칸만 채우면 된다.
 */

/** data URL 이든 순수 base64 든 받아서 나눈다 */
function splitImagePayload(
  imageBase64: string,
  mimeTypeHint?: string,
): { mimeType: string; data: string } {
  const value = String(imageBase64 ?? "").trim()
  const match = value.match(/^data:([^;]+);base64,(.+)$/i)
  if (match) {
    return { mimeType: match[1] || "image/jpeg", data: match[2] }
  }
  return { mimeType: mimeTypeHint?.trim() || "image/jpeg", data: value }
}

export type TicketFields = {
  /** FLIGHT · TRAIN · CAR — 앱의 `TYPES` 와 같은 값 */
  type: "FLIGHT" | "TRAIN" | "CAR" | null
  /** 항공사·철도사 이름 (대한항공 · KTX · SRT …) */
  carrier: string | null
  /** 편명·열차번호 (KE001 · KTX 101) */
  vehicleNo: string | null
  fromLabel: string | null
  toLabel: string | null
  departDate: string | null
  departTime: string | null
  arriveDate: string | null
  arriveTime: string | null
}

const EMPTY: TicketFields = {
  type: null,
  carrier: null,
  vehicleNo: null,
  fromLabel: null,
  toLabel: null,
  departDate: null,
  departTime: null,
  arriveDate: null,
  arriveTime: null,
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

/** 모델이 뭘 주든 우리가 쓸 수 있는 모양으로만 남긴다 */
function clean(raw: unknown, todayYear: number): TicketFields {
  const o = (raw ?? {}) as Record<string, unknown>
  const str = (k: string) => {
    const v = String(o[k] ?? "").trim()
    return v && v !== "null" && v !== "미상" ? v : null
  }
  const type = String(o.type ?? "").trim().toUpperCase()
  const date = (k: string) => {
    const v = str(k)
    if (!v || !DATE_RE.test(v)) return null
    /*
      ⚠️ **연도를 고쳐 준다.** 표에 「12/24」처럼 월·일만 있으면 모델이 연도를
         제멋대로 찍는다(영수증에서 2년 전으로 넣은 적이 있다). 표가 1년 넘게
         지난 것일 리는 거의 없으니 너무 먼 해는 올해로 끌어온다.
    */
    const y = Number(v.slice(0, 4))
    if (Math.abs(y - todayYear) >= 2) return `${todayYear}${v.slice(4)}`
    return v
  }
  const time = (k: string) => {
    const v = str(k)
    return v && TIME_RE.test(v) ? v : null
  }
  return {
    type: type === "FLIGHT" || type === "TRAIN" || type === "CAR" ? type : null,
    carrier: str("carrier"),
    vehicleNo: str("vehicleNo"),
    fromLabel: str("fromLabel"),
    toLabel: str("toLabel"),
    departDate: date("departDate"),
    departTime: time("departTime"),
    arriveDate: date("arriveDate"),
    arriveTime: time("arriveTime"),
  }
}

export async function POST(req: Request) {
  /* 인증이 없는 라우트다 — 반복 호출로 AI 비용이 새지 않게 막는다 */
  const limited = await checkRateLimit(req, "vision", "parse-ticket")
  if (limited) return limited

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 })
    }

    const body = (await req.json()) as {
      imageBase64?: string
      mimeType?: string
      imageUrl?: string
    }

    let rawImage = String(body.imageBase64 ?? "").trim()
    let mimeHint = body.mimeType

    /* 주소로 온 경우 — 서버가 받아온다(앱에서 base64 로 만들어 보내는 건 낭비다) */
    if (!rawImage && body.imageUrl) {
      const url = String(body.imageUrl).trim()
      if (!/^https?:\/\//.test(url)) {
        return NextResponse.json({ error: "이미지 주소가 올바르지 않습니다." }, { status: 400 })
      }
      try {
        const res = await fetch(url)
        if (!res.ok) {
          return NextResponse.json({ error: "이미지를 가져오지 못했습니다." }, { status: 502 })
        }
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.byteLength > 10_000_000) {
          return NextResponse.json({ error: "이미지가 너무 큽니다." }, { status: 413 })
        }
        rawImage = buf.toString("base64")
        mimeHint = res.headers.get("content-type") ?? "image/jpeg"
      } catch {
        return NextResponse.json({ error: "이미지를 가져오지 못했습니다." }, { status: 502 })
      }
    }

    if (!rawImage) {
      return NextResponse.json({ error: "imageBase64 또는 imageUrl 이 필요합니다." }, { status: 400 })
    }

    const { mimeType, data: imageBase64 } = splitImagePayload(rawImage, mimeHint)

    /*
      ⚠️ **모델 이름을 코드에 박지 않는다.** 박아 둔 폴백이 전부 이 계정에 없어서
         영수증 스캔이 통째로 죽은 적이 있다. 쓸 수 있는 것을 물어봐서 고른다.
    */
    const models = await flashModelCandidates(apiKey)
    if (models.length === 0) {
      return NextResponse.json(
        { error: "지금은 표를 읽을 수 없어요. 잠시 뒤 다시 시도해 주세요." },
        { status: 503 },
      )
    }

    const now = new Date()
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

    const prompt =
      "이 이미지는 항공권·기차표·버스표 또는 그 예약 확인 화면이야. 다음 값을 뽑아 줘.\n" +
      "- type: 비행기면 FLIGHT, 기차(KTX·SRT·신칸센 등)면 TRAIN, 버스·렌터카면 CAR\n" +
      "- carrier: 항공사·철도사 이름 (예: 대한항공, KTX, SRT, ANA)\n" +
      "- vehicleNo: 편명·열차번호 (예: KE001, KTX 101, NH862)\n" +
      "- fromLabel: 출발지. **공항이면 세 글자 코드**(ICN·NRT), 기차면 역 이름(서울·부산)\n" +
      "- toLabel: 도착지. 같은 규칙\n" +
      "- departDate / arriveDate: YYYY-MM-DD\n" +
      "- departTime / arriveTime: HH:MM (24시간)\n\n" +
      `오늘은 ${todayIso} 야. 표에 연도가 없고 "12/24" 처럼 월·일만 있으면 **가장 가까운 미래의 연도**를 붙여라.\n` +
      "⚠️ **모르는 값은 반드시 null 로 둬라. 절대 지어내지 마라.**\n" +
      "⚠️ 탑승자 이름·좌석·예약번호·금액은 **읽지 마라**. 필요 없다.\n" +
      "⚠️ 왕복표라 구간이 둘이면 **가는 편(첫 구간)만** 뽑아라.\n" +
      '반드시 {"type":...,"carrier":...,"vehicleNo":...,"fromLabel":...,"toLabel":...,' +
      '"departDate":...,"departTime":...,"arriveDate":...,"arriveTime":...} 형태의 JSON 으로만 답해라.'

    let lastError = ""

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
                  ],
                },
              ],
              generationConfig: { responseMimeType: "application/json" },
            }),
          },
        )

        if (response.ok) {
          const data = (await response.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
          }
          let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
          if (rawText) {
            rawText = rawText.replace(/```json|```/g, "").trim()
            const fields = clean(JSON.parse(rawText) as unknown, now.getFullYear())
            /*
              ⚠️ **하나도 못 읽었으면 성공이라고 하지 않는다.** 빈 칸만 돌려주면
                 사용자는 「읽었는데 아무것도 없네」로 받아들이고, 사진이 문제인지
                 우리가 문제인지 알 수 없다.
            */
            const got = Object.values(fields).filter(Boolean).length
            if (got >= 2) {
              console.info(`[parse-ticket] success with model: ${model} (${got} fields)`)
              await rememberModel(TEXT_PURPOSE, model)
              return NextResponse.json({ ticket: fields })
            }
            lastError = `[${model}] 읽은 값이 ${got}개뿐`
          }
        } else {
          const errText = await response.text()
          lastError = `[${model}] HTTP ${response.status}: ${errText}`
          if (isBillingProblem(response.status, errText)) {
            console.error("[parse-ticket] Gemini 결제 문제:", errText.slice(0, 200))
            return NextResponse.json(
              { error: "지금은 표 자동 입력을 쓸 수 없어요. 직접 넣어 주세요." },
              { status: 503 },
            )
          }
          if (isTransient(response.status, errText)) {
            await sleep(700)
            continue
          }
          /* 404 는 그 이름이 없다는 뜻 — 이 프로세스가 사는 동안 후보에서 뺀다 */
          if (response.status === 404) {
            markModelGone(model)
            await modelFailed(TEXT_PURPOSE)
          }
        }
      } catch (e: unknown) {
        lastError = `[${model}] ${e instanceof Error ? e.message : String(e)}`
      }
    }

    /* ⚠️ 구글 원문 에러를 사용자에게 보여 주지 않는다 — 할 수 있는 게 없는 말이다 */
    console.error("[parse-ticket] 모든 모델 실패:", lastError)
    return NextResponse.json(
      {
        error: "표를 읽지 못했어요. 글씨가 잘 보이게 다시 찍어 주세요.",
        reason: String(lastError).slice(0, 300),
        ticket: EMPTY,
      },
      { status: 502 },
    )
  } catch (error: unknown) {
    console.error("[parse-ticket] 예외:", error)
    return NextResponse.json(
      { error: "표를 읽지 못했어요. 잠시 뒤 다시 시도해 주세요." },
      { status: 500 },
    )
  }
}
