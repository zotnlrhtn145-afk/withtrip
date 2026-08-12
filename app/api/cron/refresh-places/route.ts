import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * 주 1회 장소 평점 갱신 크론 (Vercel Cron → 일요일 04:00 KST).
 *
 * 구글 정책: place_id 외 필드는 30일 이내 주기로 갱신해야 한다. 주 1회면 충분.
 *
 * ⚠️ 이 작업이 수정해도 되는 것은 오직 places 테이블의
 *    rating / rating_count / last_refreshed_at / is_closed 4개 컬럼뿐이다.
 *    다른 테이블·다른 컬럼은 절대 건드리지 않는다. DELETE도 하지 않는다.
 *    (폐업이면 삭제가 아니라 is_closed = true 로만 표시)
 */

/** 한 번에 갱신할 최대 개수. 비용 상한 역할도 한다. */
const BATCH_SIZE = 200

/**
 * 이 시간 안에 이미 갱신된 장소는 건너뛴다.
 * 주 1회 크론에는 아무 영향이 없고, 엔드포인트가 반복 호출돼도 구글 호출이 안 나가게 막는다.
 */
const MIN_AGE_HOURS = 24

function getApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  ).trim()
}

type RefreshResult = {
  rating: number | null
  ratingCount: number | null
  notFound: boolean
} | null

/** 최소 필드만 요청해서 요금 등급을 낮춘다 (rating, user_ratings_total). */
async function fetchRating(placeId: string, apiKey: string): Promise<RefreshResult> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json")
  url.searchParams.set("place_id", placeId)
  url.searchParams.set("fields", "rating,user_ratings_total")
  url.searchParams.set("key", apiKey)

  try {
    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) return null

    const json = (await res.json()) as {
      status?: string
      result?: { rating?: number; user_ratings_total?: number }
    }

    if (json.status === "NOT_FOUND" || json.status === "ZERO_RESULTS") {
      return { rating: null, ratingCount: null, notFound: true }
    }
    if (json.status !== "OK" || !json.result) return null

    return {
      rating: typeof json.result.rating === "number" ? json.result.rating : null,
      ratingCount:
        typeof json.result.user_ratings_total === "number"
          ? json.result.user_ratings_total
          : null,
      notFound: false,
    }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  // Vercel Cron은 Authorization: Bearer $CRON_SECRET 을 붙여 호출한다.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization") ?? ""
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const apiKey = getApiKey()
  const db = getSupabaseAdmin()

  if (!apiKey || !db) {
    // 갱신은 부가 작업이다. 못 해도 앱은 기존 데이터로 정상 동작한다.
    return NextResponse.json({
      ok: false,
      skipped: true,
      reason: !apiKey ? "GOOGLE_PLACES_API_KEY 없음" : "SUPABASE_SERVICE_ROLE_KEY 없음",
    })
  }

  // 가장 오래 갱신 안 된 순으로 집되, **최근 MIN_AGE_HOURS 안에 갱신된 건 제외**한다.
  //
  // 이건 비용 안전장치다. CRON_SECRET을 설정하지 않으면 이 엔드포인트는 인증 없이 열려 있어
  // 누구나 반복 호출해 구글 할당량을 태울 수 있다. 이 조건이 있으면 하루에 한 번을 넘겨
  // 실제 구글 호출이 발생하지 않는다 (두 번째 호출부터는 대상이 0건).
  const cutoff = new Date(Date.now() - MIN_AGE_HOURS * 60 * 60 * 1000).toISOString()
  const { data, error } = await db
    .from("places")
    .select("id,google_place_id")
    .lt("last_refreshed_at", cutoff)
    .order("last_refreshed_at", { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
  }

  const targets = (data ?? []) as { id: number; google_place_id: string }[]
  let updated = 0
  let closed = 0
  let failed = 0

  for (const row of targets) {
    const result = await fetchRating(row.google_place_id, apiKey)

    if (!result) {
      // 일시적 실패 — last_refreshed_at을 건드리지 않아 다음 주에 다시 시도된다.
      failed += 1
      continue
    }

    if (result.notFound) {
      // 폐업 추정: 삭제하지 않고 표시만 한다.
      const { error: closeErr } = await db
        .from("places")
        .update({ is_closed: true, last_refreshed_at: new Date().toISOString() })
        .eq("id", row.id)
      if (closeErr) failed += 1
      else closed += 1
      continue
    }

    const { error: updErr } = await db
      .from("places")
      .update({
        rating: result.rating,
        rating_count: result.ratingCount,
        last_refreshed_at: new Date().toISOString(),
      })
      .eq("id", row.id)

    if (updErr) failed += 1
    else updated += 1
  }

  const summary = { ok: true, scanned: targets.length, updated, closed, failed }
  console.log("[cron/refresh-places]", JSON.stringify(summary))
  return NextResponse.json(summary)
}
