import { createHash } from "node:crypto"

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
 * ⚠️ **돈이 드는 일은 하나도 하지 않는다.**
 *    - 구글 Details 를 부르지 않는다. 후보는 캐시에 적힌 photo_references 만 쓴다.
 *    - 사진도 **이미 우리 저장소에 받아 둔 것만** 본다(place_photos).
 *      사진 프록시는 (ref, 폭) 별로 캐시하므로 없는 폭을 달라고 하면
 *      그 순간 구글 Place Photo 호출이 된다 — 그래서 저장소를 직접 읽는다.
 *
 * ⚠️ 볼 게 모자라면 **"골랐음" 표시를 남기지 않는다.** 나중에 상세 화면을 한 번만
 *    열어도 사진이 캐시에 쌓이므로, 그때 공짜로 다시 시도할 수 있어야 한다.
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

/** 사진 프록시가 쓰는 것과 같은 방식 — place_photos 를 직접 뒤지려면 맞춰야 한다 */
function refHash(ref: string) {
  return createHash("sha256").update(ref).digest("hex")
}

/**
 * **이미 저장소에 받아 둔 사진만** 골라 온다. 구글 호출 0회.
 *
 * ⚠️ 폭(width)은 아무거나 좋다 — 판단만 하면 되므로 작을수록 낫다.
 *    프록시에 `w=800` 같은 걸 요청하면 그 폭이 캐시에 없을 때 구글을 부른다.
 *    그래서 프록시를 거치지 않고 저장소 주소를 직접 읽는다.
 */
async function cachedImages(
  db: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  refs: string[]
): Promise<{ ref: string; inline: { mime_type: string; data: string } }[]> {
  const byHash = new Map(refs.map((r) => [refHash(r), r]))
  const { data } = await db
    .from("place_photos")
    .select("photo_ref_hash, width, storage_path")
    .in("photo_ref_hash", [...byHash.keys()])
    .order("width", { ascending: true })
  const rows = (data as { photo_ref_hash: string; width: number; storage_path: string }[] | null) ?? []

  // ref 하나당 가장 작은 폭 하나만 — 판단에 큰 그림은 필요 없다
  const smallest = new Map<string, string>()
  for (const r of rows) if (!smallest.has(r.photo_ref_hash)) smallest.set(r.photo_ref_hash, r.storage_path)

  const out: { ref: string; inline: { mime_type: string; data: string } }[] = []
  await Promise.all(
    [...smallest.entries()].map(async ([hash, path]) => {
      const ref = byHash.get(hash)
      if (!ref) return
      try {
        const { data: blob, error } = await db.storage.from("place-photos").download(path)
        if (error || !blob) return
        const buf = await blob.arrayBuffer()
        if (buf.byteLength > 5 * 1024 * 1024) return
        out.push({
          ref,
          inline: { mime_type: blob.type || "image/jpeg", data: Buffer.from(buf).toString("base64") },
        })
      } catch {
        /* 한 장 못 받아도 나머지로 고른다 */
      }
    })
  )
  // 원래 순서를 지킨다 — 후보 순서가 흔들리면 같은 가게에 다른 답이 나온다
  return out.sort((a, b) => refs.indexOf(a.ref) - refs.indexOf(b.ref))
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
       * ⚠️ 후보는 **캐시에 적힌 것만** 쓴다. 구글 Details 를 부르지 않는다 —
       *    사진 한 장 고치자고 부르면 가게마다 돈이 나간다.
       */
      const refs = (item.photoRefs?.length ? item.photoRefs : (hit?.refs ?? []))
        .filter(Boolean)
        .slice(0, MAX_CANDIDATES)
      if (refs.length < 2 || !model || !db) return

      // 이미 받아 둔 사진만 본다. 모자라면 **표시를 남기지 않고** 물러난다 —
      // 상세 화면을 한 번 열면 사진이 쌓이므로 그때 공짜로 다시 하면 된다.
      const images = await cachedImages(db, refs)
      if (images.length < 2) return

      const best = await pickBest(
        key,
        model,
        String(item.name ?? "이 장소"),
        String(item.kind ?? "restaurant"),
        String(item.subCategory ?? ""),
        images.map((i) => i.inline)
      )
      const chosen = best >= 0 ? images[best].ref : null
      if (chosen) covers[gid] = buildPlacePhotoProxyUrl(chosen, 1200, origin)

      // 골랐든 못 골랐든 적어 둔다 — 못 고른 곳을 매번 다시 부르면 AI 비용만 샌다
      await db
        .from("places")
        .update({ cover_photo_reference: chosen, cover_curated_at: new Date().toISOString() })
        .eq("google_place_id", gid)
    })
  )

  return NextResponse.json({ covers })
}
