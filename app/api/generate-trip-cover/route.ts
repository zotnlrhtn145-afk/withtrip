import { NextResponse } from "next/server"

import { getIconicLandmark, toEnglishKeywords } from "@/lib/getCityImage"
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
/**
 * 만든 이미지를 Storage 에 올리고 공개 URL 을 돌려준다.
 *
 * **도시 단위**로 올린다(`city/{키}.png`). 예전엔 사용자 폴더에 올렸는데,
 * 이제 이미지가 도시당 한 장이고 모든 사용자가 공유하므로 사용자와 무관하다.
 * 덕분에 토큰 검증도 필요 없어졌다.
 */
async function uploadCityCover(
  cityKey: string,
  base64: string,
  mimeType: string
): Promise<string | null> {
  const admin = getSupabaseAdmin()
  if (!admin || !cityKey) return null
  try {
    const ext = mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png"
    const path = `city/${cityKey}.${ext}`
    const { error } = await admin.storage
      .from("trip-covers")
      .upload(path, Buffer.from(base64, "base64"), {
        contentType: mimeType,
        cacheControl: "31536000",
        upsert: true, // 다시 만들 때 덮어쓴다
      })
    if (error) {
      console.warn("[generate-trip-cover] upload failed:", error.message)
      return null
    }
    const { data: pub } = admin.storage.from("trip-covers").getPublicUrl(path)
    return String(pub?.publicUrl ?? "").trim() || null
  } catch (e) {
    console.warn("[generate-trip-cover] upload unexpected:", e)
    return null
  }
}

/**
 * 도시 키 — 같은 도시가 두 번 만들어지지 않게 하는 기준.
 * 영문 도시명을 소문자·영숫자만 남겨 쓴다. 없으면 한글 도시명을 그대로.
 */
function cityKeyOf(input: { city?: string; country?: string; location?: string; title?: string }): string {
  const { cityEn } = toEnglishKeywords(input)
  const base = (cityEn || input.city || input.location || "").toString().trim().toLowerCase()
  return base.replace(/[^a-z0-9가-힣]+/g, "")
}

/**
 * 등록된 47개 명소 목록에 없는 도시는 **모델에게 대표 명소를 먼저 묻는다.**
 * 예전엔 목록에 없으면 그냥 포기해서 "되는 도시와 안 되는 도시"가 갈렸다.
 */
/**
 * 이 계정에서 실제로 쓸 수 있는 텍스트 모델을 찾는다.
 *
 * ⚠️ 모델 이름을 고정해 두면 안 된다. `gemini-2.0-flash` 를 박아 뒀다가
 *    **계정에 없어서 404 가 났고, 대표 장소 추론이 한 번도 동작하지 않았다.**
 *    (그런데도 조용히 "지원하지 않는 여행지"로만 보여서 알아채기 어려웠다)
 */
async function findTextModel(apiKey: string): Promise<string | null> {
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": apiKey },
    })
    if (!res.ok) return null
    const d = (await res.json()) as { models?: GeminiModel[] }
    const names = (d.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => String(m.name ?? "").replace(/^models\//, ""))
      .filter((n) => n.includes("flash") && !/image|exp|preview|thinking|lite/i.test(n))
    return names[0] ?? null
  } catch {
    return null
  }
}

async function askLandmark(
  apiKey: string,
  city: string,
  country: string
): Promise<{ landmark: string | null; raw: string }> {
  try {
    const model = await findTextModel(apiKey)
    if (!model) return { landmark: null, raw: "no text model available" }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text:
            // ⚠️ "가장 상징적인 랜드마크"만 물으면 작은 도시는 모델이 포기한다
            //    (포항·용인이 실제로 그랬다). 여행자가 사진 찍을 만한
            //    **대표적인 장소**로 넓혀 묻는다 — 해안·공원·시장·사찰도 답이 된다.
            `Name one real, specific place in ${city}${country ? `, ${country}` : ""} ` +
            `that a traveler would photograph to represent the city. ` +
            `It can be a landmark, a coastline, a park, a temple, a bridge, or a famous street — ` +
            `but it must be a real named place in that city.\n` +
            `Answer with its common English name only, no explanation. ` +
            `Only if you cannot identify this city at all, answer exactly: NONE` }] }],
          generationConfig: { temperature: 0 },
        }),
      }
    )
    if (!res.ok) return { landmark: null, raw: `HTTP ${res.status}` }
    const d = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const raw = (d.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim()

    // 모델이 설명을 덧붙이거나 목록으로 답할 때가 있다 — 첫 줄만 쓰고 장식을 걷어낸다
    const first = raw.split("\n").map((l) => l.trim()).find(Boolean) ?? ""
    const cleaned = first
      .replace(/^[-*\d.)\s]+/, "")
      .replace(/^["'`]+|["'`.]+$/g, "")
      .trim()

    if (!cleaned || /^none$/i.test(cleaned) || cleaned.length > 100) {
      return { landmark: null, raw }
    }
    return { landmark: cleaned, raw }
  } catch (e) {
    return { landmark: null, raw: String(e) }
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

    const admin = getSupabaseAdmin()
    const cityKey = cityKeyOf(body)

    // ── 이미 만들어 둔 도시면 그걸 그대로 준다.
    //    도시당 한 장만 만들고 모두 재사용한다 — 같은 제주도는 항상 같은 이미지.
    //    (예전엔 여행마다 새로 만들어서 대표 이미지 느낌이 안 났고 비용도 매번 들었다)
    if (admin && cityKey) {
      const { data: cached } = await admin
        .from("city_covers")
        .select("image_url")
        .eq("city_key", cityKey)
        .maybeSingle()
      const url = (cached as { image_url?: string } | null)?.image_url
      if (url) return NextResponse.json({ imageUrl: url, cached: true })
    }

    // ── 그릴 명소를 정한다.
    //    등록된 목록이 우선(검증된 값). 없으면 모델에게 물어본다 —
    //    예전엔 목록에 없으면 포기해서 "되는 도시와 안 되는 도시"가 갈렸다.
    const landmarkInfo = getIconicLandmark(body)
    let destination = landmarkInfo?.destination ?? ""
    let landmark = landmarkInfo?.landmark ?? ""

    if (!landmark) {
      const city = String(body.city ?? "").trim() || String(body.location ?? "").trim()
      const country = String(body.country ?? "").trim()
      if (!city) {
        return NextResponse.json({ error: "여행지를 알 수 없어요." }, { status: 400 })
      }
      const asked = await askLandmark(apiKey, city, country)
      if (!asked.landmark) {
        return NextResponse.json(
          { error: "이 여행지는 아직 지원하지 않아요.", detail: asked.raw.slice(0, 200) },
          { status: 400 }
        )
      }
      landmark = asked.landmark
      destination = country ? `${city}, ${country}` : city
    }

    const prompt = buildPrompt(destination, landmark)

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
              const imageUrl = await uploadCityCover(cityKey, imagePart.inlineData.data, mime)
              if (imageUrl) {
                // 다음부터는 만들지 않고 이걸 쓴다
                if (admin && cityKey) {
                  await admin.from("city_covers").upsert(
                    { city_key: cityKey, city_label: destination, landmark, image_url: imageUrl },
                    { onConflict: "city_key" }
                  )
                }
                return NextResponse.json({ imageUrl })
              }

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
