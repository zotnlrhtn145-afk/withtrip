import { NextResponse } from "next/server"

export const runtime = "nodejs"

const SUBCATEGORIES_BY_KIND: Record<string, string[]> = {
  restaurant: [
    "한식", "일식", "스시", "국수·면요리", "중식", "이탈리안", "프렌치",
    "양식", "고기·구이", "해산물", "브런치", "카페", "디저트", "기타",
  ],
  bar: ["칵테일 바", "와인 바", "이자카야", "펍", "루프탑 라운지", "기타"],
  stay: ["호텔", "리조트", "료칸", "게스트하우스", "펜션", "기타"],
}

/**
 * 이름/주소만으로 정규식으로는 못 잡는 경우(유명 체인점 등)를 Gemini의 상식으로 보정한다.
 * 예: "이치란"은 이름에 "라멘"이 없어도 라멘 전문점으로 알려져 있다.
 */
export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ subCategory: null }, { status: 200 })
    }

    const body = (await req.json()) as {
      kind?: string
      placeName?: string
      localName?: string
      address?: string
      fallback?: string
    }
    const kind = body.kind === "bar" || body.kind === "stay" ? body.kind : "restaurant"
    const options = SUBCATEGORIES_BY_KIND[kind]
    const placeName = String(body.placeName ?? "").trim()
    if (!placeName) {
      return NextResponse.json({ subCategory: null }, { status: 200 })
    }

    const promptText =
      `다음은 지도 검색으로 찾은 장소다.\n` +
      `이름: ${placeName}${body.localName && body.localName !== placeName ? ` (${body.localName})` : ""}\n` +
      `주소: ${body.address ?? "정보 없음"}\n` +
      `분류: ${kind === "stay" ? "숙소" : kind === "bar" ? "바/라운지" : "레스토랑"}\n\n` +
      `이 장소의 세부 카테고리를 아래 목록 중 정확히 하나만 골라라. ` +
      `이름이 유명 체인/브랜드라면 실제로 알려진 사실을 활용해라 (예: "이치란"은 라멘 전문점이므로 국수·면요리). ` +
      `확실한 근거가 없으면 "기타"를 골라라.\n` +
      `목록: ${options.join(", ")}\n\n` +
      `반드시 {"subCategory": "..."} 형태의 JSON으로만 응답해라. 목록에 없는 값은 절대 쓰지 마라.`

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
      // best-effort; fall back to the pinned default below
    }
    const allModelsToTry = Array.from(
      new Set([...preferredFirst, ...candidateModels, "gemini-1.5-flash-latest", "gemini-1.5-flash"])
    )

    for (const model of allModelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
          }
        )
        if (!response.ok) continue

        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!rawText) continue
        rawText = rawText.replace(/```json|```/g, "").trim()
        const parsed = JSON.parse(rawText) as { subCategory?: unknown }
        const subCategory = String(parsed.subCategory ?? "").trim()
        if (options.includes(subCategory)) {
          return NextResponse.json({ subCategory })
        }
        return NextResponse.json({ subCategory: null })
      } catch {
        continue
      }
    }

    return NextResponse.json({ subCategory: null })
  } catch (error: unknown) {
    console.error("[classify-subcategory] error:", error)
    return NextResponse.json({ subCategory: null }, { status: 200 })
  }
}
