import { NextResponse } from "next/server"

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

export async function POST(req: Request) {
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
    }

    const rawImage = String(body.imageBase64 ?? "").trim()
    if (!rawImage) {
      return NextResponse.json({ error: "imageBase64 is required." }, { status: 400 })
    }

    const { mimeType, data: imageBase64 } = splitImagePayload(
      rawImage,
      body.mimeType
    )

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
    // Prefer flash models from live list first, then defaults
    const flashFirst = [
      ...candidateModels.filter((m) => m.includes("flash")),
      ...candidateModels.filter((m) => !m.includes("flash")),
    ]
    const defaultCandidates = [
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-2.0-flash-exp",
    ]
    const allModelsToTry = Array.from(
      new Set([...flashFirst, ...defaultCandidates])
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
                      text: "영수증 이미지에서 상호명(title), 총금액(amount), 카테고리(category: 식비/쇼핑/교통/숙박/기타), 날짜(date: YYYY-MM-DD)를 추출해서 JSON 형식으로만 응답해줘.",
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
            const parsedData = JSON.parse(rawText) as {
              title?: unknown
              amount?: unknown
              category?: unknown
              date?: unknown
            }
            console.info(`[parse-receipt] success with model: ${model}`)
            return NextResponse.json({
              title: String(parsedData.title ?? "").trim() || "영수증 지출",
              amount: Number(parsedData.amount) || 0,
              category: mapCategory(parsedData.category),
              date: String(parsedData.date ?? "").trim(),
            })
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
