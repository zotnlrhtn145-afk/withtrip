import { NextResponse } from "next/server"

import { flashModelCandidates } from "@/lib/gemini-models"
import { checkRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 30

/**
 * POST /api/classify-receipt
 *   body: { imageUrls: string[] }
 *   →     { receipt: boolean[] }
 *
 * 대화방에 올린 사진이 **영수증·계산서·카드내역인지**만 가린다.
 *
 * ⚠️ 예전엔 모든 사진 밑에 "지출로 등록"을 달았다. 판별을 안 하니 오탐은 없지만,
 *    풍경 사진·셀카 밑에도 늘 떠 있어서 지저분했다.
 *    올릴 때 한 번만 보고 결과를 메시지에 넣어 두면, 보는 사람마다 다시 부르지 않는다.
 *
 * ⚠️ **썸네일을 넘긴다.** 글자를 읽는 게 아니라 "영수증처럼 생겼나"만 보므로
 *    작은 이미지로 충분하다. 실제 금액 읽기는 사용자가 누른 뒤 parse-receipt 가 한다.
 *
 * 애매하면 **false** 로 둔다. 안 뜨는 건 그냥 안 뜨는 거지만,
 * 엉뚱한 사진에 뜨면 매번 눈에 거슬린다.
 */

const MAX_IMAGES = 10
/**
 * ⚠️ 폰으로 찍은 영수증은 2~5MB 가 흔하다. 2MB 로 잡았더니 실제 영수증이
 *    전부 "너무 큼"으로 버려져 한 장도 못 가렸다.
 *    앱은 썸네일을 보내지만, 원본이 와도 처리되게 넉넉히 잡는다.
 */
const MAX_BYTES = 8 * 1024 * 1024

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, "vision", "classify-receipt")
  if (limited) return limited

  let body: { imageUrls?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ receipt: [] }, { status: 400 })
  }

  const urls = (Array.isArray(body.imageUrls) ? body.imageUrls : [])
    .map((u) => String(u ?? "").trim())
    .filter((u) => u.startsWith("http"))
    .slice(0, MAX_IMAGES)

  // 못 가리면 전부 false — "안 뜸"이 기본값이다
  const fallback = urls.map(() => false)
  if (urls.length === 0) return NextResponse.json({ receipt: [] })

  const key = (process.env.GEMINI_API_KEY || "").trim()
  if (!key) return NextResponse.json({ receipt: fallback })

  const parts: Array<Record<string, unknown>> = []
  const skipped: string[] = []
  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8_000)
      const res = await fetch(url, { signal: controller.signal, cache: "no-store" })
      clearTimeout(timer)
      if (!res.ok) {
        parts.push({ text: "(이미지를 받지 못함)" })
        skipped.push(`http_${res.status}`)
        continue
      }
      const buf = await res.arrayBuffer()
      if (buf.byteLength > MAX_BYTES) {
        parts.push({ text: "(이미지가 너무 큼)" })
        skipped.push(`too_big_${buf.byteLength}`)
        continue
      }
      parts.push({
        inline_data: {
          mime_type: res.headers.get("content-type")?.split(";")[0] || "image/jpeg",
          data: Buffer.from(buf).toString("base64"),
        },
      })
    } catch {
      parts.push({ text: "(이미지를 받지 못함)" })
      skipped.push("fetch_error")
    }
  }

  parts.push({
    text:
      `위 이미지들이 **돈을 쓴 증빙**인지 하나씩 판단해라.\n\n` +
      `증빙인 것: 영수증, 계산서, 카드 전표, 카드 사용 내역 화면, 결제 완료 화면,\n` +
      `  송금 확인 화면, 메뉴판에 가격이 적힌 계산서, 청구서.\n` +
      `증빙이 아닌 것: 음식 사진, 풍경, 인물, 간판, 지도, 스크린샷 중 결제와 무관한 것.\n\n` +
      `⚠️ 애매하면 false 로 해라. 안 뜨는 건 괜찮지만 엉뚱한 사진에 뜨면 거슬린다.\n\n` +
      `이미지 순서대로 true/false 를 배열로만 답해라.\n` +
      `{"receipt": [true, false]}`,
  })

  const models = await flashModelCandidates(key)
  for (const model of [models[0] ?? "gemini-flash-latest"]) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: "application/json",
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
          signal: controller.signal,
        },
      )
      if (!res.ok) continue
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!raw) continue
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as {
        receipt?: unknown
      }
      const arr = Array.isArray(parsed.receipt) ? parsed.receipt : []
      // 길이가 안 맞아도 화면이 깨지지 않게 원래 장수에 맞춘다
      return NextResponse.json({
        receipt: urls.map((_, i) => arr[i] === true),
        skipped,
      })
    } catch {
      /* 다음 모델 */
    } finally {
      clearTimeout(timer)
    }
  }

  return NextResponse.json({ receipt: fallback })
}
