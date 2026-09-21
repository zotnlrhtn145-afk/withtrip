import { REVIEWED_AIRPORT_ASSETS, REVIEWED_AIRPORT_COVERS } from "@/lib/airport-cover-reviewed"
import { placePhotoPrompt, coverPolicyVersion } from "@/shared/place-photo-policy"
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
 * ⚠️ 일반 장소는 Google 추가 조회 없이 캐시 재사용. 공항만 미저장 후보 최대4장을 프록시로 확보한다.
 *    공항 최초 후보 확보는 Photo 비용, 자동 선별은 AI 비용이 발생하며 이후 공용 캐시 재사용.
 *    - 구글 Details 를 부르지 않는다. 후보는 캐시에 적힌 photo_references 만 쓴다.
 *    - 사진도 **이미 우리 저장소에 받아 둔 것만** 본다(place_photos).
 *      사진 프록시는 (ref, 폭) 별로 캐시하므로 없는 폭을 달라고 하면
 *      그 순간 구글 Place Photo 호출이 된다 — 그래서 저장소를 직접 읽는다.
 *
 * ⚠️ 볼 게 모자라면 **"골랐음" 표시를 남기지 않는다.** 나중에 상세 화면을 한 번만
 *    열어도 사진이 캐시에 쌓이므로, 그때 저장된 사진으로 다시 시도할 수 있어야 한다.
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


async function pickBest(
  key: string,
  model: string,
  name: string,
  kind: string,
  subCategory: string,
  images: { mime_type: string; data: string }[]
): Promise<number | null> {
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
                { text: placePhotoPrompt(name, kind, subCategory, images.length) },
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
    if (!res.ok) return null
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return null
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as { bestIndex?: unknown }
    const n = parsed.bestIndex
    return typeof n === "number" && Number.isInteger(n) && n >= -1 && n < images.length ? n : null
  } catch {
    return null
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
  const coverPolicies: Record<string, string> = {}

  // ── 1) 이미 골라 둔 게 있으면 그걸 쓴다 (AI 호출 0회) ──────────
  const ids = items.map((i) => String(i.googlePlaceId))
  const cached = new Map<string, { ref: string | null; policy: string | null; done: boolean; refs: string[] }>()
  if (db) {
    const { data, error } = await db
      .from("places")
      .select("google_place_id, cover_photo_reference, cover_curated_at, cover_policy_version, photo_references")
      .in("google_place_id", ids)
    if (error) return NextResponse.json({ covers: {} }, { status: 503 })
    for (const r of (data as
      | {
          google_place_id: string
          cover_photo_reference: string | null
          cover_curated_at: string | null
          cover_policy_version: string | null
          photo_references: string[] | null
        }[]
      | null) ?? []) {
      cached.set(r.google_place_id, {
        ref: r.cover_photo_reference,
        done: !!r.cover_curated_at,
        policy: r.cover_policy_version,
        refs: r.photo_references ?? [],
      })
    }
  }

  const key = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim()
  let modelPromise: Promise<string> | undefined

  // ── 2) 아직 안 고른 것만 고른다 ──────────────────────────────
  await Promise.all(
    items.map(async (item) => {
      const gid = String(item.googlePlaceId)
      const hit = cached.get(gid)

      const policy = coverPolicyVersion(String(item.name ?? ""), String(item.kind ?? "restaurant"), String(item.subCategory ?? ""))
      const airport = policy === "airport-exterior-v3"
      const asset = airport ? REVIEWED_AIRPORT_ASSETS[gid] : undefined
      if (asset) {
        covers[gid] = new URL(asset, origin).toString()
        coverPolicies[gid] = policy
        return
      }
      const reviewed = airport ? REVIEWED_AIRPORT_COVERS[gid] : undefined
      if (reviewed && hit?.refs.includes(reviewed)) {
        covers[gid] = buildPlacePhotoProxyUrl(reviewed, 1200, origin)
        coverPolicies[gid] = policy
        return
      }
      const validPolicy = hit?.done && hit.policy === policy
      if (hit?.ref && (!airport || validPolicy)) {
        covers[gid] = buildPlacePhotoProxyUrl(hit.ref, 1200, origin)
        if (validPolicy) coverPolicies[gid] = policy
      }
      // 한 번 골라 봤는데 쓸 만한 게 없었던 곳은 다시 부르지 않는다
      if (validPolicy) return

      /**
       * ⚠️ 후보는 **캐시에 적힌 것만** 쓴다. 구글 Details 를 부르지 않는다 —
       *    사진 한 장 고치자고 부르면 가게마다 돈이 나간다.
       */
      const refs = (airport ? (hit?.refs ?? []) : item.photoRefs?.length ? item.photoRefs : (hit?.refs ?? []))
        .filter(Boolean)
        .slice(0, airport ? 8 : MAX_CANDIDATES)
      if (refs.length < (airport ? 1 : 2) || !key || !db) return

      // 이미 받아 둔 사진만 본다. 모자라면 **표시를 남기지 않고** 물러난다 —
      // 상세 화면을 한 번 열면 사진이 쌓이므로 그때 Google 재호출 없이 다시 선별한다.
      const images = await cachedImages(db, refs)
      // Airport-only bounded warmup: otherwise an interior-only cache can never discover its exterior.
      // The standard proxy persists these images; at most four missing candidates are fetched once.
      if (airport) {
        const present = new Set(images.map(image => image.ref))
        const missing = refs.filter(ref => !present.has(ref)).slice(0, 4)
        await Promise.all(missing.map(async ref => {
          try {
            const response = await fetch(buildPlacePhotoProxyUrl(ref, 720, origin), { signal: AbortSignal.timeout(12000) })
            if (!response.ok) return
            const mime = response.headers.get("content-type")?.split(";")[0] ?? ""
            if (!mime.startsWith("image/")) return
            const bytes = await response.arrayBuffer()
            if (bytes.byteLength > 5 * 1024 * 1024) return
            images.push({ ref, inline: { mime_type: mime, data: Buffer.from(bytes).toString("base64") } })
          } catch { /* Keep verified cached candidates when a thumbnail cannot load. */ }
        }))
        images.sort((a,b) => refs.indexOf(a.ref) - refs.indexOf(b.ref))
      }
      if (images.length < (airport ? 1 : 2)) return

      modelPromise ??= flashModelCandidates(key).then(models => models[0] ?? "")
      const model = await modelPromise
      if (!model) return
      const best = await pickBest(
        key,
        model,
        String(item.name ?? "이 장소"),
        String(item.kind ?? "restaurant"),
        String(item.subCategory ?? ""),
        images.map((i) => i.inline)
      )
      if (best === null) return // 통신/모델 오류를 선별 완료로 저장하지 않습니다.
      const chosen = best >= 0 ? images[best].ref : null
      if (chosen) { covers[gid] = buildPlacePhotoProxyUrl(chosen, 1200, origin); coverPolicies[gid] = policy }

      if (airport && !chosen && images.length < refs.length) return

      // 골랐든 못 골랐든 적어 둔다 — 못 고른 곳을 매번 다시 부르면 AI 비용만 샌다
      await db
        .from("places")
        .update({ cover_photo_reference: chosen, cover_policy_version: policy, cover_curated_at: new Date().toISOString() })
        .eq("google_place_id", gid)
    })
  )

  return NextResponse.json({ covers, coverPolicies })
}
