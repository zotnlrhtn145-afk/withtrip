import { flashModelCandidates } from "@/lib/gemini-models"
import { placePhotoPrompt } from "@/shared/place-photo-policy"
import { NextResponse } from "next/server"

import { checkRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"

type CandidateImage = { index: number; mimeType: string; data: string }

async function fetchAsBase64(
  url: string,
  origin: string
): Promise<{ mimeType: string; data: string } | null> {
  try {
    // 사진 URL은 이제 우리 프록시(/api/places/photo?...)라 상대경로로 온다.
    // 서버 fetch는 절대 URL이 필요하므로 요청 origin을 붙인다.
    const absolute = url.startsWith("/") ? new URL(url, origin).toString() : url
    const res = await fetch(absolute, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg"
    if (!mimeType.startsWith("image/")) return null
    const buffer = await res.arrayBuffer()
    if (buffer.byteLength > 5 * 1024 * 1024) return null
    const bytes = new Uint8Array(buffer)
    let binary = ""
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    return { mimeType, data: btoa(binary) }
  } catch {
    return null
  }
}

/**
 * 후보 사진 중 업장 내부(인테리어) 또는 대표 음식/음료 사진을 하나 골라준다.
 * 외부 전경, 간판, 메뉴판, 로고, 사람 얼굴 클로즈업 등은 제외 대상.
 */
export async function POST(req: Request) {
  // 인증이 없는 라우트다 — 반복 호출로 AI 비용이 새지 않게 막는다
  const limited = await checkRateLimit(req, "cheap", "curate-place-photo")
  if (limited) return limited

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 })
    }

    const body = (await req.json()) as {
      photoUrls?: string[]
      placeName?: string
      kind?: string
      subCategory?: string
    }
    const photoUrls = (body.photoUrls ?? []).filter(Boolean).slice(0, 4)
    if (photoUrls.length === 0) {
      return NextResponse.json({ bestIndex: -1, imageUrl: null })
    }

    const origin = new URL(req.url).origin
    const fetched = await Promise.all(photoUrls.map((url) => fetchAsBase64(url, origin)))
    const candidates: CandidateImage[] = fetched
      .map((item, index) => (item ? { index, ...item } : null))
      .filter((item): item is CandidateImage => item !== null)

    if (candidates.length === 0) {
      return NextResponse.json({ bestIndex: -1, imageUrl: null })
    }

    const promptText = placePhotoPrompt(body.placeName ?? "이 장소", body.kind ?? "restaurant", body.subCategory ?? "", candidates.length)

    const allModelsToTry = (await flashModelCandidates(apiKey)).slice(0, 2)

    let lastError = ""
    for (const model of allModelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            signal: AbortSignal.timeout(12000),
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: promptText },
                    ...candidates.map((c) => ({
                      inlineData: { mimeType: c.mimeType, data: c.data },
                    })),
                  ],
                },
              ],
              generationConfig: { responseMimeType: "application/json" },
            }),
          }
        )

        if (!response.ok) {
          lastError = `[${model}] HTTP ${response.status}: ${await response.text()}`
          continue
        }

        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!rawText) continue
        rawText = rawText.replace(/```json|```/g, "").trim()
        const parsed = JSON.parse(rawText) as { bestIndex?: unknown }
        const bestIndex = Number(parsed.bestIndex)
        if (!Number.isFinite(bestIndex) || bestIndex < 0 || bestIndex >= candidates.length) {
          return NextResponse.json({ bestIndex: -1, imageUrl: null })
        }
        const originalIndex = candidates[bestIndex].index
        return NextResponse.json({ bestIndex: originalIndex, imageUrl: photoUrls[originalIndex] })
      } catch (e: unknown) {
        lastError = `[${model}] ${e instanceof Error ? e.message : String(e)}`
      }
    }

    console.warn("[curate-place-photo] all models failed:", lastError)
    return NextResponse.json({ bestIndex: -1, imageUrl: null })
  } catch (error: unknown) {
    console.error("[curate-place-photo] error:", error)
    return NextResponse.json({ bestIndex: -1, imageUrl: null }, { status: 200 })
  }
}
