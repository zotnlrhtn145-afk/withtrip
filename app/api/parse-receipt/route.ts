import { NextResponse } from "next/server"

import { checkRateLimit } from "@/lib/rate-limit"
import { flashModelCandidates, isBillingProblem, isTransient, modelFailed, rememberModel, sleep, TEXT_PURPOSE } from "@/lib/gemini-models"

export const runtime = "nodejs"

type GeminiModel = {
  name?: string
  supportedGenerationMethods?: string[]
}

/** Accept data URL or raw base64; return pure base64 + mime. */
function splitImagePayload(
  imageBase64: string,
  mimeTypeHint?: string
): { mimeType: string; data: string } {
  const value = String(imageBase64 ?? "").trim()
  const match = value.match(/^data:([^;]+);base64,(.+)$/i)
  if (match) {
    return { mimeType: match[1] || "image/jpeg", data: match[2] }
  }
  return {
    mimeType: mimeTypeHint?.trim() || "image/jpeg",
    data: value.replace(/\s+/g, ""),
  }
}

function mapCategory(raw: unknown): string {
  const value = String(raw ?? "").trim()
  if (value === "식비") return "식사"
  if (value === "숙박") return "숙소"
  return value
}

type ParsedItem = {
  title?: unknown
  amount?: unknown
  category?: unknown
  date?: unknown
}

function normalizeParsedItem(raw: ParsedItem) {
  return {
    title: String(raw.title ?? "").trim() || "영수증 지출",
    amount: Number(raw.amount) || 0,
    category: mapCategory(raw.category),
    date: String(raw.date ?? "").trim(),
  }
}

/**
 * Accepts whatever shape the model returned and normalizes to an items array:
 * - { items: [...] } — expected shape
 * - [...] — bare array (model skipped the wrapper)
 * - { title, amount, ... } — single legacy object shape
 */
function extractItems(parsed: unknown): ReturnType<typeof normalizeParsedItem>[] {
  if (Array.isArray(parsed)) {
    return parsed.map((item) => normalizeParsedItem(item as ParsedItem))
  }
  if (parsed && typeof parsed === "object") {
    const obj = parsed as { items?: unknown } & ParsedItem
    if (Array.isArray(obj.items)) {
      return obj.items.map((item) => normalizeParsedItem(item as ParsedItem))
    }
    if (obj.title !== undefined || obj.amount !== undefined) {
      return [normalizeParsedItem(obj)]
    }
  }
  return []
}

export async function POST(req: Request) {
  // 인증이 없는 라우트다 — 반복 호출로 AI 비용이 새지 않게 막는다
  const limited = await checkRateLimit(req, "vision", "parse-receipt")
  if (limited) return limited

  try {
    const apiKey =
      process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    const body = (await req.json()) as {
      imageBase64?: string
      mimeType?: string
      /** 이미 올라간 사진의 주소. 대화방 사진을 지출로 등록할 때 쓴다. */
      imageUrl?: string
    }

    let rawImage = String(body.imageBase64 ?? "").trim()
    let mimeHint = body.mimeType

    // 주소로 온 경우 — 서버가 받아온다.
    // (앱에서 이미 올린 사진을 다시 base64 로 만들어 보내는 건 낭비이고,
    //  RN 에는 파일 → base64 변환이 번거롭다)
    if (!rawImage && body.imageUrl) {
      const url = String(body.imageUrl).trim()
      if (!/^https?:\/\//.test(url)) {
        return NextResponse.json({ error: "잘못된 이미지 주소입니다." }, { status: 400 })
      }
      try {
        const res = await fetch(url, { cache: "no-store" })
        if (!res.ok) {
          return NextResponse.json({ error: "이미지를 가져오지 못했습니다." }, { status: 502 })
        }
        const buf = Buffer.from(await res.arrayBuffer())
        // 영수증 사진이 과도하게 크면 Gemini 요청이 무거워진다 (보통 300KB 안팎)
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
      return NextResponse.json(
        { error: "imageBase64 또는 imageUrl 이 필요합니다." },
        { status: 400 }
      )
    }

    const { mimeType, data: imageBase64 } = splitImagePayload(rawImage, mimeHint)

    /*
      쓸 수 있는 모델을 **직접 물어봐서** 고른다.

      ⚠️ **모델 이름을 코드에 박으면 안 된다.** 여기 폴백으로
         `gemini-1.5-flash-latest` · `gemini-1.5-flash` · `gemini-1.5-pro` ·
         `gemini-2.0-flash-exp` 넷이 박혀 있었는데 **넷 다 이 계정에 없다.**
         그래서 영수증을 찍으면 넷을 차례로 두드리다 마지막 404 를 그대로
         사용자에게 보여 줬다(신고받음 — "models/gemini-2.0-flash-exp is not
         found for API version v1beta").
         같은 함정에 도시 커버 생성·인스타 추출에서도 빠진 적이 있다.

      ⚠️ 목록을 못 받으면 **아무것도 시도하지 않는다.** 죽은 이름을 두드려 봐야
         시간만 버리고(실측 71초) 끝은 똑같이 실패다. 차라리 빨리 말해 준다.
    */
    const models = await flashModelCandidates(apiKey)
    if (models.length === 0) {
      return NextResponse.json(
        { error: "지금은 영수증을 읽을 수 없어요. 잠시 뒤 다시 시도해 주세요." },
        { status: 503 }
      )
    }
    const allModelsToTry = models
    const tried = models

    let lastError = ""

    // 3. 성공하는 모델을 찾을 때까지 순차적 시도 (Loop)
    for (const model of allModelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text:
                        "이 이미지를 분석해줘. 하나의 매장에서 결제한 단일 영수증이면 배열에 항목을 1개만 담아줘. " +
                        "카드사/은행 앱의 거래내역 목록처럼 여러 건의 결제가 나열되어 있으면, 각 결제 건을 배열의 " +
                        "개별 항목으로 만들어줘 (합산하지 말고 건별로 분리). 각 항목은 title(가맹점명), " +
                        "amount(결제금액, 숫자만), category(식비/쇼핑/교통/숙박/기타 중 하나), " +
                        "date(YYYY-MM-DD, 항목별 날짜가 다르면 각각 반영, 알 수 없으면 오늘 날짜)를 포함해야 해. " +
                        '반드시 {"items": [{"title": "...", "amount": 0, "category": "...", "date": "..."}, ...]} ' +
                        "형태의 JSON으로만 응답해줘.",
                    },
                    {
                      inlineData: {
                        mimeType: mimeType || "image/jpeg",
                        data: imageBase64,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: "application/json",
              },
            }),
          }
        )

        if (response.ok) {
          const data = (await response.json()) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> }
            }>
          }
          let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text

          if (rawText) {
            // 마크다운 코드블록 제거 후 안전하게 JSON 파싱
            rawText = rawText.replace(/```json|```/g, "").trim()
            const parsedData: unknown = JSON.parse(rawText)
            const items = extractItems(parsedData).filter((item) => item.amount > 0)
            if (items.length > 0) {
              console.info(
                `[parse-receipt] success with model: ${model} (${items.length} item(s))`
              )
              // 통한 모델을 기억한다 — 다음 요청은 이것부터 본다(헛호출을 줄인다)
              await rememberModel(TEXT_PURPOSE, model)
              return NextResponse.json({ items })
            }
          }
        } else {
          const errText = await response.text()
          lastError = `[${model}] HTTP ${response.status}: ${errText}`
          console.warn(`Gemini model ${model} skipped due to error:`, lastError)
          /*
            ⚠️ 과부하(503)·속도제한(429)은 **잠깐 기다렸다 같은 모델에 다시**
               물으면 대개 통한다. 바로 다음 모델로 넘어가면 더 나쁜 모델을 쓴다.
          */
          /*
            ⚠️ 결제가 막힌 것이면 **바로 멈춘다.** 모델을 바꿔 봐야, 다시 해
               봐야 똑같이 실패한다. 그리고 사용자에게 "사진이 흐리면 다시
               찍어 주세요" 라고 하면 안 된다 — 사진 문제가 아니다.
               (실측: "Your prepayment credits are depleted.")
          */
          if (isBillingProblem(response.status, errText)) {
            console.error("[parse-receipt] Gemini 결제 문제:", errText.slice(0, 200))
            return NextResponse.json(
              {
                error: "지금은 영수증 자동 입력을 쓸 수 없어요. 금액과 항목을 직접 넣어 주세요.",
                reason: String(errText).slice(0, 300),
              },
              { status: 503 }
            )
          }
          if (isTransient(response.status, errText)) {
            await sleep(700)
            continue
          }
          if (response.status === 404) await modelFailed(TEXT_PURPOSE)
        }
      } catch (e: unknown) {
        lastError = `[${model}] ${e instanceof Error ? e.message : String(e)}`
      }
    }

    /*
      ⚠️ **구글 원문 에러를 사용자에게 그대로 보여 주지 않는다.**
         "models/gemini-2.0-flash-exp is not found for API version v1beta..." 가
         통째로 알림창에 떴다(신고받음). 사용자가 할 수 있는 게 없는 말이고,
         내부 사정만 드러난다. 원인은 로그에 남기고 화면에는 할 수 있는 말을 한다.
    */
    console.error("[parse-receipt] 모든 모델 실패:", lastError)
    return NextResponse.json(
      {
        error: "영수증을 읽지 못했어요. 사진이 흐리면 다시 찍어 주세요.",
        /*
          ⚠️ 진단용. **화면에는 안 쓴다** — 앱은 `error` 만 보여 준다.
             이게 없으면 "왜 실패했는지" 를 알 길이 서버 로그뿐이라, 사용자
             신고가 들어와도 재현부터 해야 한다. 짧게 잘라 담는다.
        */
        reason: String(lastError).slice(0, 300),
        tried,
      },
      { status: 502 }
    )
  } catch (error: unknown) {
    // ⚠️ 여기서도 원문을 흘리지 않는다 — 위 주석 참고
    console.error("[parse-receipt] 예외:", error)
    return NextResponse.json(
      { error: "영수증을 읽지 못했어요. 잠시 뒤 다시 시도해 주세요." },
      { status: 500 }
    )
  }
}
