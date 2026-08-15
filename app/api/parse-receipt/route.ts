import { NextResponse } from "next/server"

import { checkRateLimit } from "@/lib/rate-limit"

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

    // 1. 현재 API 키로 사용 가능한 전체 모델 목록 조회 시도
    let candidateModels: string[] = []
    try {
      const modelsResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models",
        {
          headers: { "x-goog-api-key": apiKey },
        }
      )
      if (modelsResponse.ok) {
        const modelsData = (await modelsResponse.json()) as {
          models?: GeminiModel[]
        }
        candidateModels = (modelsData.models || [])
          .filter((m) =>
            m.supportedGenerationMethods?.includes("generateContent")
          )
          .map((m) => String(m.name ?? "").replace(/^models\//, ""))
          .filter(Boolean)
      }
    } catch {
      console.warn("모델 목록 조회 실패, 기본 후보로 진행합니다.")
    }

    // 2. 기본 안전 후보 모델 목록 추가 및 중복 제거
    // "gemini-flash-latest"를 최우선으로 — 검증된 빠른 모델. 나머지 구버전
    // 모델명들은 계정에서 404로 죽어있는 경우가 많아 순서대로 다 시도하면
    // 수십 초가 그냥 낭비된다 (실측 71초). 라이브 목록/레거시 기본값은
    // 최후 폴백으로만 사용.
    const preferredFirst = ["gemini-flash-latest"]
    const flashFirst = [
      ...candidateModels.filter((m) => m.includes("flash") && !/tts|image/i.test(m)),
      ...candidateModels.filter((m) => !m.includes("flash") && !/tts|image/i.test(m)),
    ]
    const defaultCandidates = [
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-2.0-flash-exp",
    ]
    const allModelsToTry = Array.from(
      new Set([...preferredFirst, ...flashFirst, ...defaultCandidates])
    )

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
              return NextResponse.json({ items })
            }
          }
        } else {
          const errText = await response.text()
          lastError = `[${model}] HTTP ${response.status}: ${errText}`
          console.warn(`Gemini model ${model} skipped due to error:`, lastError)
        }
      } catch (e: unknown) {
        lastError = `[${model}] ${e instanceof Error ? e.message : String(e)}`
      }
    }

    throw new Error(
      `모든 Gemini 모델 시도 실패. 마지막 에러 상세: ${lastError}`
    )
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "영수증 분석 실패"
    console.error("[SettlementView] receipt scan error:", error)
    return NextResponse.json(
      { error: message || "영수증 분석 실패" },
      { status: 500 }
    )
  }
}
