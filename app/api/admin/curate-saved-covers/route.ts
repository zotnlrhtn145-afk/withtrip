import { createHash } from "node:crypto"

import { NextResponse } from "next/server"

import { flashModelCandidates } from "@/lib/gemini-models"
import { buildPlacePhotoProxyUrl, resolveRequestOrigin } from "@/lib/place-cover-image"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * 찜 대표사진 일괄 수리 (관리자) — "가게 사진이 이상한 게 메인에 걸려 있다"(신고).
 *
 * 저장 당시 구글 photos[0](제멋대로)이나 인스타 표지가 image_url 로 굳어 있다.
 * 상세를 열 때만 고치는 지금 방식으론 목록이 영영 지저분하다 — 한 번에 민다:
 *
 *   가게(google_place_id)별로:
 *     ① 사진 후보 확보 — places 캐시에 없으면 Details(fields=photos) 1회
 *     ② 후보 4장을 저장소에서 읽거나(공짜) 없으면 구글 Photo 로 받아 저장
 *        (프록시와 같은 경로 규약 — 다음부터 그 사진은 공짜)
 *     ③ 상세 화면과 같은 기준으로 제미나이가 하나 고름 (내부·음식 우선)
 *     ④ places 에 기록 + 그 가게를 담은 **모든 찜의 image_url 교체**
 *
 *   gpid 가 없는 찜(인스타 저장 등)은 resolveMissing=1 일 때 이름+주소로
 *   Find Place 를 돌려 gpid 부터 찾는다.
 *
 * 비용: 곳당 대략 Details 1.7¢ + Photo 4장 2.8¢ ≈ 4.5¢(60원). 재실행은 공짜(캐시).
 */

const BUCKET = "place-photos"
const CAND = 4
const PHOTO_W = 480

function refHash(ref: string) {
  return createHash("sha256").update(ref).digest("hex")
}

function placesKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  ).trim()
}

type Db = NonNullable<ReturnType<typeof getSupabaseAdmin>>

/** 후보 사진 확보 — 저장소 우선, 없으면 구글 Photo(유료)로 받아 저장까지 */
async function candidateImages(
  db: Db,
  gkey: string,
  refs: string[]
): Promise<{ mime_type: string; data: string }[]> {
  const out: { i: number; inline: { mime_type: string; data: string } }[] = []
  await Promise.all(
    refs.slice(0, CAND).map(async (ref, i) => {
      const hash = refHash(ref)
      try {
        /* ① 저장소에 아무 폭이나 있으면 그걸 쓴다 — 구글 호출 0 */
        const { data: rows } = await db
          .from("place_photos")
          .select("storage_path")
          .eq("photo_ref_hash", hash)
          .order("width", { ascending: true })
          .limit(1)
        const path0 = (rows as { storage_path: string }[] | null)?.[0]?.storage_path
        if (path0) {
          const { data: blob } = await db.storage.from(BUCKET).download(path0)
          if (blob) {
            const buf = await blob.arrayBuffer()
            if (buf.byteLength <= 5 * 1024 * 1024) {
              out.push({ i, inline: { mime_type: blob.type || "image/jpeg", data: Buffer.from(buf).toString("base64") } })
              return
            }
          }
        }
        /* ② 없으면 구글 Photo (유료) — 받아서 프록시 규약대로 저장해 다음부턴 공짜 */
        const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${PHOTO_W}&photo_reference=${encodeURIComponent(ref)}&key=${gkey}`
        const res = await fetch(url)
        if (!res.ok) return
        const contentType = res.headers.get("content-type") ?? "image/jpeg"
        if (!contentType.startsWith("image/")) return
        const bytes = await res.arrayBuffer()
        const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg"
        const path = `${hash.slice(0, 2)}/${hash}_${PHOTO_W}.${ext}`
        await db.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true })
        await db.from("place_photos").upsert(
          { photo_ref_hash: hash, width: PHOTO_W, storage_path: path, bytes: bytes.byteLength, fetched_at: new Date().toISOString() },
          { onConflict: "photo_ref_hash,width" }
        )
        out.push({ i, inline: { mime_type: contentType, data: Buffer.from(bytes).toString("base64") } })
      } catch {
        /* 한 장 실패는 넘어간다 */
      }
    })
  )
  return out.sort((a, b) => a.i - b.i).map((x) => x.inline)
}

function kindOf(category: string | null): { label: string; good: string; bad: string } {
  const c = category ?? ""
  if (c.includes("숙소") || c.includes("호텔"))
    return {
      label: "숙소",
      good: "객실, 로비·라운지, 수영장·부대시설, 숙소 건물 전경(간판만 크게 찍힌 건 제외)",
      bad: "주변 길거리, 지도 화면, 로고, 메뉴판, 사람 얼굴이 크게 나온 사진, 흐린 사진",
    }
  if (c.includes("관광"))
    return {
      label: "관광지/명소",
      good: "그 명소를 한눈에 알아볼 대표 전경·내부·전시·풍경",
      bad: "주차장, 매표소 줄, 지도 화면, 로고, 사람 얼굴이 크게 나온 사진, 흐린 사진",
    }
  const label = c.includes("바") || c.includes("라운지") ? "바/라운지" : "음식점"
  return {
    label,
    good: "가게 안 인테리어·분위기, 먹음직스러운 대표 음식·음료, 가게 간판이 보이는 정면 외관",
    bad:
      "가게가 들어 있는 큰 빌딩의 외관·로비(가게가 안 보임), 길거리, 주차장, 지도 화면, " +
      "로고, 메뉴판·영수증, 사람 얼굴이 크게 나온 사진, 흐린 사진",
  }
}

async function pickBest(
  gemKey: string,
  model: string,
  name: string,
  category: string | null,
  images: { mime_type: string; data: string }[]
): Promise<number> {
  const k = kindOf(category)
  const prompt =
    `"${name}"(${k.label})의 대표 사진 후보 ${images.length}장이다(0번부터).\n` +
    `목록에서 이 가게를 한눈에 알아볼 사진 하나를 골라라.\n\n` +
    `좋은 사진: ${k.good}\n나쁜 사진: ${k.bad}\n\n` +
    `⚠️ 특히 가게가 큰 건물 안에 있을 때 건물 외관·로비 사진이 섞여 들어온다. 그건 이 가게 사진이 아니다.\n` +
    `쓸 만한 게 하나도 없으면 bestIndex 를 -1 로 해라.\n{"bestIndex": 0} JSON 으로만 답해라.`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25_000)
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": gemKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, ...images.map((i) => ({ inline_data: i }))] }],
        generationConfig: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
      }),
      signal: controller.signal,
    })
    if (!res.ok) return -1
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as { bestIndex?: unknown }
    const n = Number(parsed.bestIndex)
    return Number.isFinite(n) && n >= 0 && n < images.length ? n : -1
  } catch {
    return -1
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(req: Request) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const db = getSupabaseAdmin()
  const gkey = placesKey()
  const gemKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim()
  if (!db || !gkey || !gemKey) return NextResponse.json({ error: "server config" }, { status: 500 })

  const body = (await req.json().catch(() => ({}))) as { limit?: number; resolveMissing?: boolean }
  const limit = Math.min(Math.max(1, Number(body.limit ?? 10)), 25)

  const origin = resolveRequestOrigin(req.url)
  const models = await flashModelCandidates(gemKey)
  const model = models[0] ?? ""
  if (!model) return NextResponse.json({ error: "no model" }, { status: 500 })

  /* ── 0) gpid 없는 찜 되살리기 (선택) — 이름+주소로 Find Place ── */
  let resolved = 0
  if (body.resolveMissing) {
    const { data: missing } = await db
      .from("saved_places")
      .select("id, place_name, address")
      .is("google_place_id", null)
      .not("place_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit)
    for (const row of (missing as { id: string; place_name: string; address: string | null }[] | null) ?? []) {
      try {
        const q = [row.place_name, row.address].filter(Boolean).join(" ")
        const url = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json")
        url.searchParams.set("input", q)
        url.searchParams.set("inputtype", "textquery")
        url.searchParams.set("fields", "place_id")
        url.searchParams.set("key", gkey)
        const res = await fetch(url.toString())
        const j = (await res.json()) as { candidates?: { place_id?: string }[] }
        const pid = j.candidates?.[0]?.place_id
        if (pid) {
          await db.from("saved_places").update({ google_place_id: pid }).eq("id", row.id)
          resolved += 1
        }
      } catch {
        /* 다음 것 */
      }
    }
  }

  /* ── 1) 아직 표지를 안 고른 가게 고르기 ── */
  const { data: savedRows } = await db
    .from("saved_places")
    .select("google_place_id, place_name, category")
    .not("google_place_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1500)
  const byGid = new Map<string, { name: string; category: string | null }>()
  for (const r of (savedRows as { google_place_id: string; place_name: string | null; category: string | null }[] | null) ?? []) {
    if (!byGid.has(r.google_place_id)) byGid.set(r.google_place_id, { name: r.place_name ?? "장소", category: r.category })
  }
  const allGids = [...byGid.keys()]
  const doneSet = new Set<string>()
  for (let i = 0; i < allGids.length; i += 200) {
    const { data } = await db
      .from("places")
      .select("google_place_id, cover_photo_reference")
      .in("google_place_id", allGids.slice(i, i + 200))
      .not("cover_photo_reference", "is", null)
    for (const r of (data as { google_place_id: string }[] | null) ?? []) doneSet.add(r.google_place_id)
  }
  const todo = allGids.filter((g) => !doneSet.has(g)).slice(0, limit)

  /* ── 2) 가게별 처리 ── */
  const results: { gid: string; name: string; picked: boolean; updated: number; note?: string }[] = []
  for (const gid of todo) {
    const meta = byGid.get(gid)!
    try {
      /* 사진 후보 — places 캐시 우선, 없으면 Details */
      let refs: string[] = []
      const { data: prow } = await db.from("places").select("photo_references").eq("google_place_id", gid).maybeSingle()
      refs = ((prow as { photo_references: string[] | null } | null)?.photo_references ?? []).filter(Boolean)
      if (refs.length === 0) {
        const url = new URL("https://maps.googleapis.com/maps/api/place/details/json")
        url.searchParams.set("place_id", gid)
        url.searchParams.set("fields", "photos")
        url.searchParams.set("key", gkey)
        const res = await fetch(url.toString())
        const j = (await res.json()) as { result?: { photos?: { photo_reference?: string }[] } }
        refs = (j.result?.photos ?? []).map((p) => p.photo_reference ?? "").filter(Boolean).slice(0, 6)
        if (refs.length > 0) {
          await db.from("places").upsert({ google_place_id: gid, photo_references: refs }, { onConflict: "google_place_id" })
        }
      }
      if (refs.length === 0) {
        results.push({ gid, name: meta.name, picked: false, updated: 0, note: "사진 없음" })
        continue
      }

      const images = await candidateImages(db, gkey, refs)
      if (images.length === 0) {
        results.push({ gid, name: meta.name, picked: false, updated: 0, note: "후보 확보 실패" })
        continue
      }

      const best = await pickBest(gemKey, model, meta.name, meta.category, images)
      const chosen = best >= 0 ? refs[best] : refs[0] /* 모델이 못 고르면 첫 장이라도 — 지금보다 나쁠 순 없다? 아니, 첫 장이 문제였다 → 고른 것만 반영 */
      if (best < 0) {
        results.push({ gid, name: meta.name, picked: false, updated: 0, note: "쓸 만한 후보 없음" })
        continue
      }

      await db
        .from("places")
        .upsert(
          { google_place_id: gid, cover_photo_reference: chosen, cover_curated_at: new Date().toISOString() },
          { onConflict: "google_place_id" }
        )
      const cover = buildPlacePhotoProxyUrl(chosen, 1200, origin)
      const { data: upd } = await db
        .from("saved_places")
        .update({ image_url: cover })
        .eq("google_place_id", gid)
        .select("id")
      results.push({ gid, name: meta.name, picked: true, updated: (upd as { id: string }[] | null)?.length ?? 0 })
    } catch (e) {
      results.push({ gid, name: meta.name, picked: false, updated: 0, note: String((e as Error).message).slice(0, 80) })
    }
  }

  return NextResponse.json({
    resolved,
    pendingBefore: allGids.length - doneSet.size,
    processed: results.length,
    picked: results.filter((r) => r.picked).length,
    updatedRows: results.reduce((a, r) => a + r.updated, 0),
    results,
  })
}
