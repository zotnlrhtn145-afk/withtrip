import { NextResponse } from "next/server"

import { flashModelCandidates } from "@/lib/gemini-models"
import { buildPlacePhotoProxyUrl, resolveRequestOrigin } from "@/lib/place-cover-image"
import { checkRateLimit } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * POST /api/places/cover
 *   body: { items: [{ googlePlaceId, name, kind, subCategory, photoRefs? }] }
 *   →     { covers: { [googlePlaceId]: string } }   // 프록시 사진 주소
 *
 * 가게 대표 사진을 AI 가 고른다 — **가게당 딱 한 번**.
 *
 * ⚠️ 구글이 주는 사진 순서는 제멋대로다. photos[0] 을 그냥 쓰면
 *    36층 중식당에 1층 오피스 빌딩 입구 사진이 걸린다(실제로 그랬다).
 *
 * ⚠️ **결과는 places 에 적어 둔다.** places 는 가게 단위 캐시라 모든 사용자가
 *    나눠 쓴다. 사람마다 다시 고르면 AI 비용이 사람 수만큼 붙는다.
 *
 * ⚠️ **구글에 새로 묻지 않는다.** 후보는 이미 손에 있는 것(요청으로 넘어온 것 또는
 *    캐시에 적힌 photo_references)만 쓴다. 후보가 없으면 그냥 포기한다 —
 *    사진 한 장 고치자고 Details 를 부르면 돈이 샌다. (일괄 정리는 별도 스크립트로)
 */

type Item = {
  googlePlaceId?: string
  name?: string
  kind?: string
  subCategory?: string
  photoRefs?: string[]
}

/** 한 번에 손볼 수 있는 가게 수 — 넘치면 AI 호출이 한 요청에 몰린다 */
const MAX_ITEMS = 8
/** 가게당 살펴볼 후보 장수. 넷을 넘겨 봐야 판단이 좋아지지 않고 토큰만 먹는다 */
const MAX_CANDIDATES = 4

async function fetchAsInline(url: string): Promise<{ mime_type: string; data: string } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8_000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    // 5MB 넘는 건 대표 사진 후보로 볼 이유가 없다
    if (buf.byteLength > 5 * 1024 * 1024) return null
    return {
      mime_type: res.headers.get("content-type")?.split(";")[0] || "image/jpeg",
      data: Buffer.from(buf).toString("base64"),
    }
  } catch {
    return null
  }
}

function promptFor(name: string, kind: string, subCategory: string, count: number): string {
  const isStay = kind === "stay"
  const label = isStay ? "숙소" : kind === "bar" ? "바/라운지" : "음식점"

  /**
   * ⚠️ **숙소와 음식점은 좋은 사진의 기준이 다르다.** 호텔은 건물 외관이나
   *    로비·객실이 대표 사진으로 알맞지만, 음식점에 건물 외관이 걸리면
   *    "여기가 어디지" 싶어진다. 한 프롬프트로 뭉뚱그리면 둘 다 어긋난다.
   */
  const good = isStay
    ? "객실, 로비·라운지, 수영장·부대시설, 숙소 건물 전경(간판만 크게 찍힌 건 제외)"
    : "가게 안 인테리어·분위기, 먹음직스러운 대표 음식·음료, 가게 간판이 보이는 정면 외관"

  const bad = isStay
    ? "주변 길거리, 지도 화면, 로고, 메뉴판, 사람 얼굴이 크게 나온 사진, 흐린 사진"
    : "가게가 들어 있는 큰 빌딩의 외관·로비(가게가 안 보임), 길거리, 주차장, 지도 화면, " +
      "로고, 메뉴판·영수증, 사람 얼굴이 크게 나온 사진, 흐린 사진"

  return (
    `"${name}"(${label}${subCategory ? " · " + subCategory : ""})의 대표 사진 후보 ${count}장이다(0번부터).\n` +
    `목록에서 이 가게를 한눈에 알아볼 사진 하나를 골라라.\n\n` +
    `좋은 사진: ${good}\n` +
    `나쁜 사진: ${bad}\n\n` +
    `⚠️ 특히 **가게가 큰 건물 안에 있을 때** 건물 외관·로비 사진이 섞여 들어온다. ` +
    `그건 이 가게 사진이 아니다. 고르지 마라.\n` +
    `쓸 만한 게 하나도 없으면 bestIndex 를 -1 로 해라.\n` +
    `{"bestIndex": 0} 형태의 JSON 으로만 답해라.`
  )
}

async function pickBest(
  key: string,
  model: string,
  name: string,
  kind: string,
  subCategory: string,
  images: { mime_type: string; data: string }[]
): Promise<number> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25_000)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptFor(name, kind, subCategory, images.length) },
                ...images.map((i) => ({ inline_data: i })),
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            // 사진 고르기에 생각을 오래 할 이유가 없다 — 응답만 늦어진다
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: controller.signal,
      }
    )
    if (!res.ok) return -1
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return -1
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as { bestIndex?: unknown }
    const n = Number(parsed.bestIndex)
    return Number.isFinite(n) && n >= 0 && n < images.length ? n : -1
  } catch {
    return -1
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, "vision", "places-cover")
  if (limited) return limited

  let body: { items?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ covers: {} }, { status: 400 })
  }

  const items = (Array.isArray(body.items) ? (body.items as Item[]) : [])
    .filter((i) => String(i?.googlePlaceId ?? "").trim())
    .slice(0, MAX_ITEMS)
  if (items.length === 0) return NextResponse.json({ covers: {} })

  const origin = resolveRequestOrigin(request.url)
  const db = getSupabaseAdmin()
  const covers: Record<string, string> = {}

  // ── 1) 이미 골라 둔 게 있으면 그걸 쓴다 (AI 호출 0회) ──────────
  const ids = items.map((i) => String(i.googlePlaceId))
  const cached = new Map<string, { ref: string | null; done: boolean; refs: string[] }>()
  if (db) {
    const { data } = await db
      .from("places")
      .select("google_place_id, cover_photo_reference, cover_curated_at, photo_references")
      .in("google_place_id", ids)
    for (const r of (data as
      | {
          google_place_id: string
          cover_photo_reference: string | null
          cover_curated_at: string | null
          photo_references: string[] | null
        }[]
      | null) ?? []) {
      cached.set(r.google_place_id, {
        ref: r.cover_photo_reference,
        done: !!r.cover_curated_at,
        refs: r.photo_references ?? [],
      })
    }
  }

  const key = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim()
  const models = key ? await flashModelCandidates(key) : []
  const model = models[0] ?? ""

  // ── 2) 아직 안 고른 것만 고른다 ──────────────────────────────
  await Promise.all(
    items.map(async (item) => {
      const gid = String(item.googlePlaceId)
      const hit = cached.get(gid)

      if (hit?.ref) {
        covers[gid] = buildPlacePhotoProxyUrl(hit.ref, 1200, origin)
        return
      }
      // 한 번 골라 봤는데 쓸 만한 게 없었던 곳은 다시 부르지 않는다
      if (hit?.done) return

      /**
       * ⚠️ 후보는 **손에 있는 것만** 쓴다. 없으면 포기한다.
       *    사진 한 장 고치자고 구글 Details 를 부르면 가게마다 돈이 나간다.
       */
      const refs = (item.photoRefs?.length ? item.photoRefs : (hit?.refs ?? []))
        .filter(Boolean)
        .slice(0, MAX_CANDIDATES)
      if (refs.length < 2 || !model) return

      const images = (
        await Promise.all(refs.map((r) => fetchAsInline(buildPlacePhotoProxyUrl(r, 800, origin))))
      ).filter((x): x is { mime_type: string; data: string } => !!x)
      if (images.length < 2) return

      const best = await pickBest(
        key,
        model,
        String(item.name ?? "이 장소"),
        String(item.kind ?? "restaurant"),
        String(item.subCategory ?? ""),
        images
      )
      const chosen = best >= 0 ? refs[best] : null
      if (chosen) covers[gid] = buildPlacePhotoProxyUrl(chosen, 1200, origin)

      // 골랐든 못 골랐든 적어 둔다 — 못 고른 곳을 매번 다시 부르면 돈만 샌다
      if (db) {
        await db
          .from("places")
          .update({ cover_photo_reference: chosen, cover_curated_at: new Date().toISOString() })
          .eq("google_place_id", gid)
      }
    })
  )

  return NextResponse.json({ covers })
}
