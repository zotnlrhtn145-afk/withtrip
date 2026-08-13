import { createHash } from "node:crypto"

import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

/**
 * GET /api/places/photo?ref=<photo_reference>&w=800
 *
 * 장소 사진 — **우리가 한 번 받아서 보관하고, 그 다음부터는 우리 것을 준다.**
 *
 * 왜 이렇게 하나:
 *  1) 키 감추기 — 예전에는 `.../place/photo?...&key=<서버키>` 를 그대로 내려보내서
 *     구글 키가 모든 응답과 DB(saved_places.image_url)에 노출됐다.
 *  2) 비용 — 예전에는 **화면에 뜰 때마다** 구글 Places Photo API 가 과금됐다.
 *     사용자가 만 명이면 호출도 만 배가 된다. 지금은 **사진 한 장당 30일에 한 번**만
 *     구글을 부르고, 나머지는 전부 우리 스토리지에서 나간다.
 *     → 사용자가 몇 명이든 구글 호출 수가 같다.
 *
 * 30일인 이유: 구글 약관이 Places 콘텐츠 캐싱을 30일까지만 허용한다.
 * (places 캐시 테이블의 갱신 주기와 같은 기준)
 *
 * ⚠️ 이 라우트의 URL 모양은 **절대 바꾸지 않는다.** 이 주소가 그대로
 *    saved_places.image_url 에 저장돼 있고 네이티브 앱도 이 주소를 쓴다.
 *    안에서 어디서 가져오는지만 달라진다.
 *
 * 무슨 일이 있어도 사진은 보여야 한다 — 스토리지·DB가 안 되면
 * 예전처럼 구글로 바로 넘긴다(기능 저하만, 고장 없음).
 */

const MIN_WIDTH = 80
const MAX_WIDTH = 1600
const DEFAULT_WIDTH = 800

const BUCKET = "place-photos"
/** 구글 약관: Places 콘텐츠는 30일까지만 보관할 수 있다. */
const MAX_AGE_DAYS = 30
/** 구글이 응답하지 않을 때 화면이 멈추지 않도록 하는 상한 */
const FETCH_TIMEOUT_MS = 8_000

/** 우리 스토리지 주소로 넘길 때의 브라우저 캐시. 하루면 함수 호출도 같이 줄어든다. */
const STORED_CACHE_SECONDS = 86_400
/** 구글로 바로 넘길 때(폴백)는 서명이 곧 만료되므로 짧게 잡는다. */
const FALLBACK_CACHE_SECONDS = 600

function getApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ||
    ""
  ).trim()
}

/** photo_reference 는 400자가 넘어 파일명으로 쓸 수 없다. 해시를 키로 쓴다. */
function refHash(ref: string) {
  return createHash("sha256").update(ref).digest("hex")
}

function extOf(contentType: string | null) {
  if (contentType?.includes("png")) return "png"
  if (contentType?.includes("webp")) return "webp"
  return "jpg"
}

function redirectTo(url: string, seconds: number) {
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": `public, max-age=${seconds}` },
  })
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ref = String(searchParams.get("ref") ?? "").trim()

  if (!ref || ref.length > 1000) {
    return NextResponse.json({ error: "ref가 필요합니다." }, { status: 400 })
  }

  const rawWidth = Number(searchParams.get("w") ?? DEFAULT_WIDTH)
  const width = Number.isFinite(rawWidth)
    ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(rawWidth)))
    : DEFAULT_WIDTH

  const apiKey = getApiKey()
  if (!apiKey) {
    return NextResponse.json({ error: "Google API 키가 설정되지 않았습니다." }, { status: 500 })
  }

  const admin = getSupabaseAdmin()
  const hash = refHash(ref)

  // ── 1) 이미 우리가 갖고 있고, 아직 30일이 안 지났으면 그대로 준다 (구글 호출 없음)
  if (admin) {
    try {
      const { data } = await admin
        .from("place_photos")
        .select("storage_path, fetched_at")
        .eq("photo_ref_hash", hash)
        .eq("width", width)
        .maybeSingle()

      if (data?.storage_path) {
        const ageDays = (Date.now() - new Date(data.fetched_at).getTime()) / 86_400_000
        if (ageDays < MAX_AGE_DAYS) {
          const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(data.storage_path)
          if (pub?.publicUrl) return redirectTo(pub.publicUrl, STORED_CACHE_SECONDS)
        }
      }
    } catch {
      // 조회 실패는 무시하고 구글에서 받아온다 — 사진은 어떻게든 보여야 한다
    }
  }

  // ── 2) 없거나 오래됐으면 구글에서 한 번 받아온다
  const target = new URL("https://maps.googleapis.com/maps/api/place/photo")
  target.searchParams.set("maxwidth", String(width))
  target.searchParams.set("photo_reference", ref)
  target.searchParams.set("key", apiKey)

  let res: Response
  try {
    // 리다이렉트를 따라가서 이미지 바이트까지 받는다 (보관해야 하므로)
    res = await fetchWithTimeout(target.toString(), { cache: "no-store" })
  } catch {
    return NextResponse.json({ error: "사진 요청 중 오류가 발생했습니다." }, { status: 502 })
  }

  if (!res.ok) {
    return NextResponse.json({ error: "사진을 가져오지 못했습니다." }, { status: 502 })
  }

  const contentType = res.headers.get("content-type") ?? "image/jpeg"
  let bytes: ArrayBuffer
  try {
    bytes = await res.arrayBuffer()
  } catch {
    return NextResponse.json({ error: "사진을 읽지 못했습니다." }, { status: 502 })
  }

  // ── 3) 우리 스토리지에 넣어 두고, 다음부터는 여기서 나가게 한다
  if (admin) {
    const path = `${hash.slice(0, 2)}/${hash}_${width}.${extOf(contentType)}`
    try {
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType, upsert: true })

      if (!upErr) {
        // 같은 사진을 동시에 요청하면 두 번 올라올 수 있다 — upsert 라 마지막 것이 남고 문제 없다
        await admin
          .from("place_photos")
          .upsert(
            {
              photo_ref_hash: hash,
              width,
              storage_path: path,
              bytes: bytes.byteLength,
              fetched_at: new Date().toISOString(),
            },
            { onConflict: "photo_ref_hash,width" }
          )

        const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
        if (pub?.publicUrl) return redirectTo(pub.publicUrl, STORED_CACHE_SECONDS)
      }
    } catch {
      // 보관에 실패해도 아래에서 받아온 이미지를 그대로 내려준다
    }
  }

  // ── 4) 보관을 못 했으면 받아온 바이트를 그대로 내려준다 (예전과 같은 동작)
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${FALLBACK_CACHE_SECONDS}`,
    },
  })
}
