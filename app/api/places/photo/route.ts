import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * GET /api/places/photo?ref=<photo_reference>&w=800
 *
 * 구글 장소 사진 프록시.
 *
 * 왜 필요한가: 예전에는 사진 URL을 `.../place/photo?...&key=<서버키>` 형태로 만들어
 * 브라우저에 그대로 내려보냈다. 그 결과 **서버용 구글 API 키가 모든 응답과
 * DB(saved_places.image_url)에 노출**됐다. 이 라우트는 키를 서버에만 두고,
 * 구글이 주는 실제 이미지 주소로 302 리다이렉트만 시켜준다.
 *
 * 이미지 바이트를 우리 서버로 통과시키지 않으므로(리다이렉트) 대역폭 부담이 없다.
 */

const MIN_WIDTH = 80
const MAX_WIDTH = 1600
const DEFAULT_WIDTH = 800

/** 구글 리다이렉트 대상(lh3...)은 서명이 만료되므로 캐시를 짧게 잡는다. */
const CACHE_SECONDS = 600

function getApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  ).trim()
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

  const target = new URL("https://maps.googleapis.com/maps/api/place/photo")
  target.searchParams.set("maxwidth", String(width))
  target.searchParams.set("photo_reference", ref)
  target.searchParams.set("key", apiKey)

  try {
    // 구글은 실제 이미지 주소로 302를 준다. 그 주소로 브라우저를 그냥 넘긴다.
    const res = await fetch(target.toString(), { redirect: "manual", cache: "no-store" })
    const location = res.headers.get("location")

    if (location) {
      return NextResponse.redirect(location, {
        status: 302,
        headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` },
      })
    }

    // 리다이렉트가 아니면(드묾) 바이트를 그대로 전달한다.
    if (res.ok) {
      const body = await res.arrayBuffer()
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
          "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        },
      })
    }

    return NextResponse.json({ error: "사진을 가져오지 못했습니다." }, { status: 502 })
  } catch {
    return NextResponse.json({ error: "사진 요청 중 오류가 발생했습니다." }, { status: 502 })
  }
}
