import { NextResponse } from "next/server"

export const runtime = "nodejs"

type CandidateImage = { index: number; mimeType: string; data: string }

async function fetchAsBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg"
    const buffer = await res.arrayBuffer()
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

    const fetched = await Promise.all(photoUrls.map((url) => fetchAsBase64(url)))
    const candidates: CandidateImage[] = fetched
      .map((item, index) => (item ? { index, ...item } : null))
      .filter((item): item is CandidateImage => item !== null)

    if (candidates.length === 0) {
      return NextResponse.json({ bestIndex: -1, imageUrl: null })
    }

    const kindLabel =
      body.kind === "stay" ? "숙소" : body.kind === "bar" ? "바/라운지" : "레스토랑"

    const promptText =
      `아래 이미지는 "${body.placeName ?? "이 장소"}"(${kindLabel}${body.subCategory ? " · " + body.subCategory : ""}) ` +
      `후보 대표 사진 ${candidates.length}장이다 (0번부터 순서대로). ` +
      "이 중에서 대표 이미지로 쓰기 가장 좋은 사진을 하나 골라라. " +
      "좋은 사진 = 업장 내부 인테리어/분위기 사진, 또는 먹음직스러운 시그니처 음식·음료 클로즈업 사진. " +
      "나쁜 사진(고르지 말 것) = 건물 외경/간판만 있는 사진, 메뉴판/영수증, 로고, 지도 스크린샷, " +
      "사람 얼굴이 크게 나온 사진, 흐릿하거나 화질이 매우 낮은 사진. " +
      "적합한 사진이 하나도 없으면 bestIndex를 -1로 답하라. " +
      '반드시 {"bestIndex": 0, "reason": "..."} 형태의 JSON으로만 응답해라.'

    const preferredFirst = ["gemini-flash-latest"]
    let candidateModels: string[] = []
    try {
      const modelsResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models",
        { headers: { "x-goog-api-key": apiKey } }
      )
      if (modelsResponse.ok) {
        const modelsData = (await modelsResponse.json()) as {
          models?: { name?: string; supportedGenerationMethods?: string[] }[]
        }
        candidateModels = (modelsData.models || [])
          .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m) => String(m.name ?? "").replace(/^models\//, ""))
          .filter((m) => Boolean(m) && !/tts|image/i.test(m))
      }
    } catch {
      // live model list is best-effort; fall back to the pinned default below
    }
    const allModelsToTry = Array.from(
      new Set([...preferredFirst, ...candidateModels, "gemini-1.5-flash-latest", "gemini-1.5-flash"])
    )

    let lastError = ""
    for (const model of allModelsToTry) {
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
