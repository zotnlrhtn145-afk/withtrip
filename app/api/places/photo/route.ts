import { recoverPlacePhoto } from "@/lib/place-photo-recovery"
import { createHash } from "node:crypto"

import { NextResponse } from "next/server"

import { createPhotoRequestGuard } from "@/lib/photo-request-guard"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

/**
 * GET /api/places/photo?ref=<photo_reference>&w=800
 *
 * 장소 사진 — **우리가 한 번 받아서 보관하고, 그 다음부터는 우리 것을 준다.**
 *
 * 요청된 사진을 저장하고, 저장본은 기간 만료 없이 모든 이용자가 재사용한다.
 * 2026-09-22 사용자 운영 결정. 저장/전송 비용 및 소스 이용 조건은 별개다.
 * 같은 참조의 저장본은 해상도와 무관하게 재사용하고, 신규 사진은 1600px로 확보한다.
 *
 * ⚠️ 이 라우트의 URL 모양은 **절대 바꾸지 않는다.** 이 주소가 그대로
 *    saved_places.image_url 에 저장돼 있고 네이티브 앱도 이 주소를 쓴다.
 *    안에서 어디서 가져오는지만 달라진다.
 *
 * 저장 여부를 확인하지 못하면 유료 요청을 하지 않는다.
 * DB 색인이 누락돼도 실제 저장 파일을 먼저 확인한다.
 */

const MIN_WIDTH = 80
const MAX_WIDTH = 1600
const DEFAULT_WIDTH = 800

const BUCKET = "place-photos"
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

const guardedPhoto = createPhotoRequestGuard()

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
  // Existing stored sizes always win; only true misses need a 1600px master.
  return guardedPhoto(`${refHash(ref)}:${width}`, () => loadPhoto(ref, width, apiKey))
}

async function loadPhoto(ref: string, width: number, apiKey: string, allowRecovery = true): Promise<Response> {
  const admin = getSupabaseAdmin()
  const hash = refHash(ref)

  // Fail closed: an unavailable index is not evidence that the photo is missing.
  const unavailable = () => NextResponse.json({ error: "저장된 사진을 잠시 후 다시 불러와 주세요." }, {
    status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" },
  })
  if (!admin) return unavailable()
  try {
    const { data, error } = await admin.from("place_photos")
      .select("storage_path")
      .eq("photo_ref_hash", hash)
      .order("width", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return unavailable()
    if (data?.storage_path) {
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(data.storage_path)
      return pub?.publicUrl ? redirectTo(pub.publicUrl, STORED_CACHE_SECONDS) : unavailable()
    }

    // Upload may have succeeded while the index write failed. Recover that exact
    // reference's file, never substitute a different photo based on its place/name.
    const prefix = hash.slice(0, 2)
    const { data: files, error: listError } = await admin.storage.from(BUCKET)
      .list(prefix, { search: `${hash}_`, limit: 100 })
    if (listError || !files) return unavailable()
    const pattern = new RegExp(`^${hash}_(\\d+)\\.(jpg|png|webp)$`)
    const stored = files.map(file => ({ file, match: file.name.match(pattern) }))
      .filter(item => item.match && Number(item.match[1]) > 0)
      .sort((a, b) => Number(b.match![1]) - Number(a.match![1]))[0]
    if (stored) {
      const path = `${prefix}/${stored.file.name}`
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
      return pub?.publicUrl ? redirectTo(pub.publicUrl, STORED_CACHE_SECONDS) : unavailable()
    }
  } catch {
    return unavailable()
  }

  // ── 2) 저장본이 없을 때만 구글에서 받아온다. 기존 저장본은 키 없이도 제공한다.
  if (!apiKey) {
    return NextResponse.json({ error: "Google API 키가 설정되지 않았습니다." }, { status: 500 })
  }
  /*
    ⚠️ 구글 사진 참조가 **두 가지 형식**이다.
       옛것: `AWCwyd...` (한 덩어리)          → legacy `place/photo`
       새것: `places/ChIJ../photos/AXQ..`     → Places API (New) `…/media`
       새 형식을 옛 주소에 넣으면 502 가 난다 — 실제로 그렇게 깨졌다.
       어느 쪽이든 받아 준다.
  */
  if (width !== MAX_WIDTH) {
    return guardedPhoto(`${hash}:${MAX_WIDTH}`, () => loadPhoto(ref, MAX_WIDTH, apiKey, allowRecovery))
  }
  const isNewRef = ref.startsWith("places/")
  const target = isNewRef
    ? new URL(`https://places.googleapis.com/v1/${ref}/media`)
    : new URL("https://maps.googleapis.com/maps/api/place/photo")
  if (isNewRef) {
    target.searchParams.set("maxWidthPx", String(width))
    target.searchParams.set("skipHttpRedirect", "false")
  } else {
    target.searchParams.set("maxwidth", String(width))
    target.searchParams.set("photo_reference", ref)
  }
  target.searchParams.set("key", apiKey)

  let res: Response
  try {
    // 리다이렉트를 따라가서 이미지 바이트까지 받는다 (보관해야 하므로)
    res = await fetchWithTimeout(target.toString(), { cache: "no-store" })
  } catch {
    return NextResponse.json({ error: "사진 요청 중 오류가 발생했습니다." }, { status: 502 })
  }

  if (!res.ok) {
    if (allowRecovery && (res.status === 400 || res.status === 404)) {
      try {
        const recovered = await recoverPlacePhoto(ref, width, apiKey,
          next => loadPhoto(next, width, apiKey, false))
        if (recovered) {
          // Remember an expired reference as an alias to the repaired stored photo.
          // Old installed apps must not pay for the same failed ref on every request.
          const location = recovered.headers.get("location")
          const base = admin?.storage.from(BUCKET).getPublicUrl("").data.publicUrl
          if (admin && location && base && location.startsWith(base)) {
            const storagePath = location.slice(base.length).replace(/^\/+/, "")
            if (storagePath && !storagePath.includes("?") && !storagePath.includes("..")) {
              await admin.from("place_photos").upsert({
                photo_ref_hash: hash, width, storage_path: storagePath,
                fetched_at: new Date().toISOString(),
              }, { onConflict: "photo_ref_hash,width" })
            }
          }
          return recovered
        }
      } catch { console.warn("[photo-recovery] temporary failure") }
    }
    return NextResponse.json({ error: "사진을 가져오지 못했습니다." }, { status: 502 })
  }

  const contentType = res.headers.get("content-type") ?? "image/jpeg"
  if (!contentType.startsWith("image/")) return NextResponse.json({ error: "사진 형식 오류" }, { status: 502 })
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
