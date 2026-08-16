import { createHash } from "node:crypto"

import { NextResponse } from "next/server"

import { checkRateLimit } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

/**
 * POST /api/places/photo/urls
 *   body: { refs: string[], w?: number }
 *   →     { urls: { [ref]: string } }
 *
 * 사진 주소를 **한 번에** 알려준다.
 *
 * 왜 필요한가:
 *   지금까지는 사진 한 장마다 `/api/places/photo` 를 거쳐 302 로 스토리지에 갔다.
 *   사진마다 왕복이 두 번이라, 목록에 15장이면 30번을 돈다(실측: 302 에만 0.13~0.44초).
 *
 *   목록을 불러올 때 이걸 **한 번** 부르면, 이미 보관 중인 사진은
 *   스토리지 주소를 바로 받아 앱이 곧장 CDN 에서 받는다. 왕복이 절반이 된다.
 *
 * ⚠️ 아직 안 받아둔 사진은 **기존 프록시 주소를 그대로 돌려준다.**
 *    그래야 처음 보는 사진도 화면에 뜨고, 그 김에 보관까지 된다.
 *    즉 이 API 는 "빠른 길을 알면 알려주고, 모르면 원래 길을 준다".
 *
 * ⚠️ 여기서 구글을 부르지 않는다. 조회만 한다 — 목록 한 번에 200장을 물어봐도
 *    과금이 늘지 않아야 한다.
 */

const MIN_WIDTH = 80
const MAX_WIDTH = 1600
const DEFAULT_WIDTH = 500
const BUCKET = "place-photos"
/** 한 번에 물어볼 수 있는 장수 — 목록 한 페이지를 넉넉히 덮는다 */
const MAX_REFS = 300
/** 구글 약관: Places 콘텐츠는 30일까지만 보관할 수 있다. */
const MAX_AGE_DAYS = 30

function refHash(ref: string) {
  return createHash("sha256").update(ref).digest("hex")
}

function proxyUrl(ref: string, width: number) {
  return `/api/places/photo?ref=${encodeURIComponent(ref)}&w=${width}`
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, "cheap", "photo-urls")
  if (limited) return limited

  let body: { refs?: unknown; w?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ urls: {} }, { status: 400 })
  }

  const refs = Array.from(
    new Set(
      (Array.isArray(body.refs) ? body.refs : [])
        .map((r) => String(r ?? "").trim())
        .filter(Boolean)
    )
  ).slice(0, MAX_REFS)

  const width = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, Number(body.w) || DEFAULT_WIDTH)
  )

  if (refs.length === 0) return NextResponse.json({ urls: {} })

  // 기본값: 전부 기존 프록시 주소 (아는 것만 아래에서 빠른 길로 바꾼다)
  const urls: Record<string, string> = {}
  for (const ref of refs) urls[ref] = proxyUrl(ref, width)

  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ urls })

  try {
    const byHash = new Map(refs.map((r) => [refHash(r), r]))
    const { data } = await admin
      .from("place_photos")
      .select("photo_ref_hash, storage_path, fetched_at")
      .in("photo_ref_hash", [...byHash.keys()])
      .eq("width", width)

    const freshAfter = Date.now() - MAX_AGE_DAYS * 86_400_000
    for (const row of (data ?? []) as {
      photo_ref_hash: string
      storage_path: string
      fetched_at: string | null
    }[]) {
      // 30일 지난 건 프록시로 보내 다시 받아오게 둔다
      const at = row.fetched_at ? Date.parse(row.fetched_at) : 0
      if (!row.storage_path || at < freshAfter) continue
      const ref = byHash.get(row.photo_ref_hash)
      if (!ref) continue
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(row.storage_path)
      if (pub?.publicUrl) urls[ref] = pub.publicUrl
    }
  } catch (err) {
    // 조회가 실패해도 프록시 주소가 있으니 화면은 정상이다
    console.warn("[photo/urls] 조회 실패(무시):", err)
  }

  return NextResponse.json({ urls })
}
