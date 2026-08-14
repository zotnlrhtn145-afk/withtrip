import { NextResponse } from "next/server"

import { getIconicLandmark } from "@/lib/getCityImage"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

/**
 * 만든 이미지를 Storage 에 올리고 공개 URL 을 돌려준다.
 *
 * 왜 서버가 올리나: 예전엔 base64 를 브라우저로 내려보내 브라우저가 올렸다.
 * 그래서 **앱은 같은 걸 또 만들어야 했고, 결국 안 만들어서 앱에서 만든 여행만
 * AI 커버가 안 붙었다.** 서버가 여기까지 끝내면 웹·앱이 똑같이 한 번만 부르면 된다.
 *
 * 올리기에 실패하면 null 을 돌려주고, 호출부는 예전처럼 base64 를 받아 직접 올린다.
 */
async function uploadCover(
  req: Request,
  base64: string,
  mimeType: string
): Promise<string | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null

  // 폴더가 사용자 id 여야 한다(본인 커버 삭제 정책이 그 기준). 그래서 토큰으로 확인한다.
  // 클라이언트가 보낸 id 를 그대로 믿으면 남의 폴더에 쓸 수 있다.
  const header = req.headers.get("authorization") ?? ""
  const jwt = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  if (!jwt) return null

  try {
    const { data, error } = await admin.auth.getUser(jwt)
    const userId = data?.user?.id
    if (error || !userId) return null

    const ext = mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png"
    const path = `${userId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`

    const { error: upErr } = await admin.storage
      .from("trip-covers")
      .upload(path, Buffer.from(base64, "base64"), {
        contentType: mimeType,
        cacheControl: "31536000",
        upsert: false,
      })
    if (upErr) {
      console.warn("[generate-trip-cover] upload failed:", upErr.message)
      return null
    }

    const { data: pub } = admin.storage.from("trip-covers").getPublicUrl(path)
    return String(pub?.publicUrl ?? "").trim() || null
  } catch (e) {
    console.warn("[generate-trip-cover] upload unexpected:", e)
    return null
  }
}

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
    // ① 무엇을 그릴지 — 실제 명소를 못 박는다.
    //    "그 도시의 상징적인 곳"처럼 맡기면 엉뚱한 도시나 없는 건물을 그린다(실측).
    `A cinematic travel photograph of ${landmark} in ${destination}. ` +
    `This must be the real, recognizable ${landmark} — not a similar-looking place, ` +
    `not a different city or country, not an invented structure.\n` +
    // ② 어떻게 그릴지 — 도시가 달라도 **한 세트처럼 보이게** 톤을 고정한다.
    //    도시마다 분위기가 제각각이면 대표 이미지 모음으로서 어색하다.
    `Style: wide establishing shot that shows the landmark clearly. ` +
    `Golden hour light, dramatic layered sky, deep rich colors, gentle haze in the distance, ` +
    `high-end travel magazine cover look. 16:9 widescreen.\n` +
    // ③ 이 이미지는 **여행 카드 배경**으로 쓰이고 아래쪽에 제목 글씨가 얹힌다.
    //    아래 1/3 이 복잡하면 글씨가 안 읽힌다.
    `Composition: keep the lower third calm and uncluttered (sky, water, ground or shadow) ` +
    `so white text can be overlaid there and stay readable. Main subject in the upper two thirds.\n` +
    // ④ 금지 — 글자가 들어가면 커버로 못 쓴다. 실제로 조형물 형태의 글자가 나온 적이 있다.
    `Absolutely no text, letters, words, numbers, signage, logos, watermarks, ` +
    `or sculptural lettering anywhere. No close-up faces.`
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
              const mime = imagePart.inlineData.mimeType || "image/png"

              // 서버가 올린다. 성공하면 URL 만 주면 되므로 응답도 훨씬 가볍다.
              const imageUrl = await uploadCover(req, imagePart.inlineData.data, mime)
              if (imageUrl) return NextResponse.json({ imageUrl })

              // 못 올렸으면 예전처럼 base64 를 준다 (호출부가 직접 올린다)
              return NextResponse.json({
                imageBase64: imagePart.inlineData.data,
                mimeType: mime,
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
