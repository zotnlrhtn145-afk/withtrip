import { createHash } from "node:crypto"
import { preferredModel, rememberModel, withPreferredFirst } from "@/lib/gemini-models"

import { NextResponse } from "next/server"

import { checkRateLimit } from "@/lib/rate-limit"

import { getIconicLandmark, toEnglishKeywords } from "@/lib/getCityImage"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

/** 모델 기억의 열쇠. 용도가 다르면 다른 모델이 통한다 */
const COVER_PURPOSE = "cover-image"

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
    // ⚠️ 스토리지 키는 ASCII 여야 한다. 영문명이 없는 도시(포항·용인 등)는
    //    city_key 가 한글이라 `city/포항.png` 가 되고 **업로드가 조용히 실패했다**
    //    (생성은 됐는데 저장이 안 돼서 매번 다시 만들었다).
    const safe = /^[\x20-\x7E]+$/.test(cityKey)
      ? cityKey
      : `k${createHash("sha1").update(cityKey).digest("hex").slice(0, 12)}`
    const path = `city/${safe}.${ext}`
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
    const url = String(pub?.publicUrl ?? "").trim()
    if (!url) return null
    // ⚠️ 같은 파일 이름에 덮어쓰기 때문에 **주소가 그대로면 앱·CDN 이 옛 이미지를 계속 쓴다.**
    //    캐시를 1년으로 걸어 뒀으므로 다시 만들어도 화면이 안 바뀐다(실제로 그랬다).
    //    만든 시각을 붙여 주소를 바꾼다.
    return `${url}?v=${Date.now()}`
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
 * 이 계정에서 쓸 수 있는 텍스트 모델 후보.
 *
 * ⚠️ 모델 이름을 고정하면 안 된다. `gemini-2.0-flash` 를 박아 뒀다가
 *    **계정에 없어서 404 가 났고, 대표 장소 추론이 한 번도 동작하지 않았다.**
 *    하나만 골라도 안 된다 — 목록 첫 번째가 호출되지 않는 이름일 수 있다.
 *    일정 추출 라우트와 같이 **여러 개를 순서대로 시도**한다.
 */
async function textModelCandidates(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": apiKey },
    })
    if (!res.ok) return []
    const d = (await res.json()) as { models?: GeminiModel[] }
    return (d.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => String(m.name ?? "").replace(/^models\//, ""))
      .filter((n) => n.includes("flash") && !/image/i.test(n))
      .sort((a, b) => (/(exp|preview|thinking|lite)/.test(a) ? 1 : 0) - (/(exp|preview|thinking|lite)/.test(b) ? 1 : 0))
      .slice(0, 4)
  } catch {
    return []
  }
}

/**
 * 명소마다 어울리는 시간대.
 *
 * ⚠️ 예전엔 전부 골든아워로 고정했다. 도시가 달라도 한 세트로 보이게 하려던 건데,
 *    **야경이 좋은 곳까지 노랗게** 나왔다. 시간대는 명소에 맞게 고르고,
 *    대신 '시네마틱한 질감'은 공통으로 유지해 세트 느낌을 낸다.
 */
const LIGHT_PRESETS: Record<string, string> = {
  night:
    "Deep night. The landmark lit by its own illumination against a dark indigo sky, " +
    "city lights and reflections, long-exposure glow. Dark overall mood.",
  bluehour:
    "Blue hour just after sunset. Deep blue sky with the landmark's lights already on, " +
    "cool tones balanced with warm window light.",
  sunrise:
    "Early sunrise. Soft low-angle light, cool mist in the valleys, calm pastel sky, " +
    "fresh and quiet mood.",
  day:
    "Bright clear daytime. Strong natural light, vivid blue sky with crisp clouds, " +
    "saturated colors, open and airy mood.",
  sunset:
    "Sunset. Warm low sun, layered orange and violet sky, long shadows.",
}

/**
 * 이 명소는 언제 찍은 게 가장 그 장소다운지 묻는다.
 * (성산일출봉은 새벽, 도톤보리는 밤, 해변은 낮 — 이게 갈려야 노란 사진만 나오지 않는다)
 */
async function askBestLight(apiKey: string, landmark: string, destination: string): Promise<string> {
  const models = await textModelCandidates(apiKey)
  const prompt =
    `When is ${landmark} in ${destination} most famously and beautifully photographed? ` +
    `Answer with exactly one word from this list: night, bluehour, sunrise, day, sunset. ` +
    `Consider what the place is actually known for — a neon nightlife street is "night", ` +
    `a sunrise peak is "sunrise", a beach or a park is "day".`
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0 },
          }),
        }
      )
      if (!res.ok) continue
      const d = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const t = (d.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim().toLowerCase()
      const hit = Object.keys(LIGHT_PRESETS).find((k) => t.includes(k))
      if (hit) return hit
    } catch {
      continue
    }
  }
  return "day" // 모르면 낮 — 노란 사진이 기본값이 되지 않게
}

async function askLandmark(
  apiKey: string,
  city: string,
  country: string
): Promise<{ landmark: string | null; raw: string }> {
  const models = await textModelCandidates(apiKey)
  if (models.length === 0) return { landmark: null, raw: "no text model" }

  const prompt =
    // ⚠️ "가장 상징적인 랜드마크"만 물으면 작은 도시는 모델이 포기한다(포항·용인).
    //    여행자가 사진 찍을 만한 **대표적인 장소**로 넓혀 묻는다.
    `Name one real, specific place in ${city}${country ? `, ${country}` : ""} ` +
    `that a traveler would photograph to represent the city. ` +
    `It can be a landmark, a coastline, a park, a temple, a bridge, or a famous street — ` +
    `but it must be a real named place in that city.\n` +
    `Answer with its common English name only, no explanation. ` +
    `Only if you cannot identify this city at all, answer exactly: NONE`

  let last = ""
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0 },
          }),
        }
      )
      if (!res.ok) {
        last = `${model}:HTTP ${res.status}`
        continue
      }
      const d = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const raw = (d.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim()

      // 설명을 덧붙이거나 목록으로 답할 때가 있다 — 첫 줄만 쓰고 장식을 걷어낸다
      const first = raw.split("\n").map((l) => l.trim()).find(Boolean) ?? ""
      const cleaned = first
        .replace(/^[-*\d.)\s]+/, "")
        .replace(/^["'`]+|["'`.]+$/g, "")
        .trim()

      if (!cleaned || /^none$/i.test(cleaned) || cleaned.length > 100) {
        last = `${model}:${raw.slice(0, 60)}`
        continue
      }
      return { landmark: cleaned, raw }
    } catch (e) {
      last = `${model}:${String(e).slice(0, 40)}`
    }
  }
  return { landmark: null, raw: last }
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
function buildPrompt(destination: string, landmark: string, light: string): string {
  return (
    // ① 무엇을 그릴지 — 실제 명소를 못 박는다.
    //    "그 도시의 상징적인 곳"처럼 맡기면 엉뚱한 도시나 없는 건물을 그린다(실측).
    `A cinematic travel photograph of ${landmark} in ${destination}. ` +
    `This must be the real, recognizable ${landmark} — not a similar-looking place, ` +
    `not a different city or country, not an invented structure.\n` +
    // ② 시간대는 **명소에 맞게** 고른다. 전부 골든아워로 고정했더니
    //    야경이 좋은 곳까지 노랗게 나왔다.
    `Lighting: ${LIGHT_PRESETS[light] ?? LIGHT_PRESETS.day}\n` +
    // ③ 질감은 공통 — 시간대가 달라도 한 세트로 보이게 하는 건 이쪽이다.
    `Style: wide establishing shot that shows the landmark clearly. ` +
    `Rich deep colors, gentle atmospheric depth, high-end travel magazine cover look. ` +
    `16:9 widescreen.\n` +
    // ④ 이 이미지는 **여행 카드 배경**으로 쓰이고 아래쪽에 제목 글씨가 얹힌다.
    `Composition: keep the lower third calm and uncluttered (sky, water, ground or shadow) ` +
    `so white text can be overlaid there and stay readable. Main subject in the upper two thirds.\n` +
    // ⑤ 금지 — 글자가 들어가면 커버로 못 쓴다.
    `Absolutely no text, letters, words, numbers, signage, logos, watermarks, ` +
    `or sculptural lettering anywhere. No close-up faces.`
  )
}

export async function POST(req: Request) {
  // 인증이 없는 라우트다 — 반복 호출로 AI 비용이 새지 않게 막는다
  const limited = await checkRateLimit(req, "image", "generate-trip-cover")
  if (limited) return limited

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

    const light = await askBestLight(apiKey, landmark, destination)
    const prompt = buildPrompt(destination, landmark, light)

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
    /*
      ⚠️ **지난번에 통했던 모델을 맨 앞에 세운다.**
         서버는 요청마다 새로 떠서 메모리 기억이 사라진다. 그래서 매번 목록을
         받아 앞에서부터 훑고, 503 이면 재시도까지 했다 — 도시 커버 150장을
         만들던 날 이 낭비가 150번 곱해졌다.
         (기억이 틀리면 예전처럼 나머지를 훑으므로 기능은 그대로다)
    */
    const remembered = await preferredModel(COVER_PURPOSE)
    const allModelsToTry = withPreferredFirst(
      Array.from(new Set([...sortedCandidates, "gemini-2.5-flash-image"])),
      remembered
    )

    let lastError = ""

    for (const model of allModelsToTry) {
      /*
        과부하(503)는 대개 잠깐이라 같은 모델에 한 번 더 물어본다 — 바로 다음
        모델로 넘어가면 더 나쁜 모델이 걸려 엉뚱한 지역 그림이 나온다.
        ⚠️ 다만 **기억해 둔 모델에만** 두 번 준다. 나머지까지 두 번씩 주면
           한 번 실패에 호출이 배로 늘어난다.
      */
      const tries = model === remembered ? 2 : 1
      for (let attempt = 0; attempt < tries; attempt += 1) {
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
              // 다음 요청은 이 모델부터 시도한다
              void rememberModel(COVER_PURPOSE, model)
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

              // 못 올렸으면 예전처럼 base64 를 준다 (호출부가 직접 올린다).
              // 이 경로로 오면 도시 커버가 저장되지 않아 매번 다시 만들게 되므로
              // 로그를 남긴다 — 실제로 한글 경로 때문에 조용히 이 길로 빠진 적이 있다.
              console.warn(`[generate-trip-cover] 저장 실패 — city=${cityKey}`)
              return NextResponse.json({
                imageBase64: imagePart.inlineData.data,
                mimeType: mime,
                warning: "STORAGE_UPLOAD_FAILED",
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
