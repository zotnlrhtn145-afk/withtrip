import { NextResponse } from "next/server"

import { getIconicLandmark } from "@/lib/getCityImage"

export const runtime = "nodejs"

type GeminiModel = {
  name?: string
  supportedGenerationMethods?: string[]
}

type GeminiImagePart = {
  inlineData?: { mimeType?: string; data?: string }
}

/**
 * Naming the exact real landmark (not "the most iconic spot") keeps the
 * model grounded — asking it to infer what's iconic produces wrong-city or
 * bizarre hallucinated results (giant sculptural text, wrong landmarks, etc).
 */
function buildPrompt(destination: string, landmark: string): string {
  return (
    `A professional travel photograph, shot on location in ${destination}, of ${landmark}. ` +
    `This must be a photorealistic depiction of this exact real landmark — not a different ` +
    `landmark, not a different city or country, not an abstract or generic scene. ` +
    `Cinematic golden hour or blue hour lighting, dramatic atmospheric sky, rich color ` +
    `grading, shallow depth of field, high-end travel magazine cover composition, ` +
    `ultra-detailed, 16:9 widescreen framing. ` +
    `Absolutely no text, letters, words, numbers, typography, logos, watermarks, or sculptural ` +
    `lettering of any kind anywhere in the image. No visible people in close-up.`
  )
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 })
    }

    const body = (await req.json()) as {
      city?: string
      country?: string
      title?: string
      location?: string
    }

    // Unknown destinations skip AI generation entirely rather than risk a
    // geographically wrong image — the caller falls back to getCityImage().
    const landmarkInfo = getIconicLandmark(body)
    if (!landmarkInfo) {
      return NextResponse.json(
        { error: "이 여행지는 아직 지원하지 않아요." },
        { status: 400 }
      )
    }
    const prompt = buildPrompt(landmarkInfo.destination, landmarkInfo.landmark)

    // 1. 사용 가능한 이미지 생성 모델 목록 조회 (계정마다 실제 노출되는 모델명이 다름)
    let candidateModels: string[] = []
    try {
      const modelsResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models",
        { headers: { "x-goog-api-key": apiKey } }
      )
      if (modelsResponse.ok) {
        const modelsData = (await modelsResponse.json()) as { models?: GeminiModel[] }
        candidateModels = (modelsData.models || [])
          .filter(
            (m) =>
              m.supportedGenerationMethods?.includes("generateContent") &&
              /image/i.test(String(m.name ?? ""))
          )
          .map((m) => String(m.name ?? "").replace(/^models\//, ""))
          .filter(Boolean)
      }
    } catch {
      console.warn("이미지 모델 목록 조회 실패, 기본 후보로 진행합니다.")
    }

    // "lite" variants follow specific-landmark prompts far less reliably
    // (they tend to hallucinate a generic/wrong landmark) — try them last.
    const isLite = (model: string) => /lite/i.test(model)
    const sortedCandidates = [
      ...candidateModels.filter((m) => !isLite(m)),
      ...candidateModels.filter(isLite),
    ]
    // gemini-2.5-flash-image is a stable, well-tested fallback name in case
    // the live model list is unavailable.
    const allModelsToTry = Array.from(new Set([...sortedCandidates, "gemini-2.5-flash-image"]))

    let lastError = ""

    for (const model of allModelsToTry) {
      // "High demand" 503s are usually momentary — retry once before moving on,
      // since falling straight to a weaker model produces geographically wrong images.
      for (let attempt = 0; attempt < 2; attempt += 1) {
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
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseModalities: ["IMAGE", "TEXT"],
                },
              }),
            }
          )

          if (response.ok) {
            const data = (await response.json()) as {
              candidates?: Array<{ content?: { parts?: GeminiImagePart[] } }>
            }
            const parts = data.candidates?.[0]?.content?.parts ?? []
            const imagePart = parts.find((part) => part.inlineData?.data)
            if (imagePart?.inlineData?.data) {
              console.info(`[generate-trip-cover] success with model: ${model}`)
              return NextResponse.json({
                imageBase64: imagePart.inlineData.data,
                mimeType: imagePart.inlineData.mimeType || "image/png",
              })
            }
            lastError = `[${model}] no image part in response`
            break
          }

          const errText = await response.text()
          lastError = `[${model}] HTTP ${response.status}: ${errText}`
          console.warn(`Gemini image model ${model} skipped due to error:`, lastError)
          if (response.status === 503 && attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 2500))
            continue
          }
          break
        } catch (e: unknown) {
          lastError = `[${model}] ${e instanceof Error ? e.message : String(e)}`
          break
        }
      }
    }

    throw new Error(`모든 이미지 생성 모델 시도 실패. 마지막 에러 상세: ${lastError}`)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "여행 커버 이미지 생성 실패"
    console.error("[generate-trip-cover] error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
