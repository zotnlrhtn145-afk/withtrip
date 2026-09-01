import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

/**
 * 영업시간이 비어 있는 장소를 **묶어서** 채운다.
 *
 * ## ⚠️ 왜 필요한가
 *
 * 영업시간은 **상세 화면을 한 번 연 곳부터** 캐시에 쌓인다. 그런데 찜 365곳
 * 중 열어 본 곳은 몇 안 돼서, 목록에 「영업 중」 딱지를 붙여도 대부분 비어
 * 있다. 한 번에 미리 채워 둔다.
 *
 * ## ⚠️ 돈이 나가는 창구다
 *
 * Place Details 는 1000회당 최소 $17 이다. 그래서 규칙을 넷으로 못박는다.
 *
 *   · **필드를 최소로만 받는다.** 이 창구가 필요한 건 영업시간과 시차뿐이다.
 *     사진·평점(Atmosphere $5)·주소까지 받으면 곳마다 더 비싸진다.
 *   · **이미 담긴 곳은 건너뛴다.** 다시 불러도 돈만 나가고 값은 같다.
 *   · **한 번에 몇 곳까지만** 부른다(`limit`). 실수로 수천 곳을 태우는 걸 막는다.
 *   · **미리 세어 볼 수 있다**(`dryRun`). 부르기 전에 몇 곳·얼마인지 본다.
 *
 * ⚠️ **찜에 있는 곳만** 채운다. `places` 캐시에는 검색으로 스쳐 간 곳까지
 *    881곳이 있는데, 아무도 담지 않은 곳의 영업시간은 볼 사람이 없다.
 *
 * 관리자만 부를 수 있다(`x-admin-secret`).
 */
export const runtime = "nodejs"
export const maxDuration = 300

/** 한 번에 이만큼까지. 넘겨도 여기서 자른다 */
const MAX_LIMIT = 200

type Period = { open?: { day?: number; time?: string }; close?: { day?: number; time?: string } }
type DetailsResult = {
  opening_hours?: { weekday_text?: string[]; periods?: Period[] }
  utc_offset?: number
  utc_offset_minutes?: number
  business_status?: string
}

/**
 * 영업시간만 받아 온다.
 *
 * ⚠️ **필드를 늘리지 말 것.** 여기에 `rating` 을 넣으면 Atmosphere 요금
 *    ($5/1000)이 붙고, `photos` 를 넣으면 더 붙는다. 이 창구의 목적은
 *    영업시간 하나다.
 * ⚠️ 이름은 `utc_offset` 이다. `utc_offset_minutes` 는 자바스크립트 라이브러리
 *    쪽 이름이라, 웹 서비스에 그걸 적으면 요청이 통째로 INVALID_REQUEST 가
 *    되어 **전부 빈 값**으로 돌아온다(실제로 한 번 겪었다).
 */
async function fetchHours(apiKey: string, placeId: string): Promise<DetailsResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json")
  url.searchParams.set("place_id", placeId)
  url.searchParams.set("fields", ["opening_hours", "utc_offset", "business_status"].join(","))
  url.searchParams.set("language", "ko")
  url.searchParams.set("key", apiKey)
  try {
    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) return null
    const json = (await res.json()) as { status?: string; result?: DetailsResult }
    if (json.status !== "OK" || !json.result) return null
    return json.result
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "관리자만 쓸 수 있습니다." }, { status: 403 })
  }

  const apiKey = (process.env.GOOGLE_PLACES_API_KEY || "").trim()
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY 가 없습니다." }, { status: 500 })

  const db = getSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "DB 연결 실패" }, { status: 500 })

  const body = (await req.json().catch(() => ({}))) as { limit?: number; dryRun?: boolean }
  const limit = Math.min(Math.max(1, Number(body.limit ?? 50)), MAX_LIMIT)
  const dryRun = body.dryRun === true

  /* 1) 찜에 담긴 곳의 열쇠를 모은다 */
  const { data: saved } = await db
    .from("saved_places")
    .select("google_place_id")
    .not("google_place_id", "is", null)
  const wanted = Array.from(
    new Set((saved ?? []).map((r) => String((r as { google_place_id: string }).google_place_id)))
  ).filter(Boolean)
  if (wanted.length === 0) return NextResponse.json({ total: 0, filled: 0, left: 0 })

  /*
    2) 그중 아직 영업시간이 없는 곳.
    ⚠️ `in()` 에 수백 개를 한 번에 넣으면 URL 이 너무 길어 실패한다 — 잘라서 묻는다.
  */
  const already = new Set<string>()
  for (let i = 0; i < wanted.length; i += 80) {
    const { data } = await db
      .from("places")
      .select("google_place_id, opening_periods")
      .in("google_place_id", wanted.slice(i, i + 80))
    for (const r of data ?? []) {
      const row = r as { google_place_id: string; opening_periods: unknown }
      if (row.opening_periods) already.add(row.google_place_id)
    }
  }
  const todo = wanted.filter((id) => !already.has(id))

  if (dryRun) {
    return NextResponse.json({
      total: wanted.length,
      already: already.size,
      todo: todo.length,
      /* 최소 필드 기준 Basic $17 + Contact $3 */
      estimatedUsd: Number((todo.length * 0.02).toFixed(2)),
    })
  }

  /*
    3) 실제로 받아 온다.
    ⚠️ **한꺼번에 다 던지지 않는다.** 구글이 잠깐 막을 수 있고, 막히면 그 건은
       돈만 나가고 값은 못 받는다. 5개씩 나눠 보낸다.
  */
  const batch = todo.slice(0, limit)
  let filled = 0
  let empty = 0
  for (let i = 0; i < batch.length; i += 5) {
    const slice = batch.slice(i, i + 5)
    const got = await Promise.all(slice.map((id) => fetchHours(apiKey, id)))
    const rows = slice
      .map((id, k) => ({ id, r: got[k] }))
      .filter((x): x is { id: string; r: DetailsResult } => !!x.r)
      .map(({ id, r }) => {
        const periods = r.opening_hours?.periods ?? null
        if (periods) filled += 1
        else empty += 1
        return {
          google_place_id: id,
          /*
            ⚠️ 영업시간이 **없는 곳도 적어 둔다**(빈 배열). 안 적으면 다음에
               또 물어서 같은 돈이 또 나간다 — 공원처럼 영업시간이 원래 없는
               곳이 꽤 된다.
          */
          opening_periods: periods ?? [],
          hours_text: r.opening_hours?.weekday_text ?? null,
          utc_offset_min:
            typeof r.utc_offset_minutes === "number"
              ? r.utc_offset_minutes
              : typeof r.utc_offset === "number"
                ? r.utc_offset
                : null,
          hours_refreshed_at: new Date().toISOString(),
          /* 문 닫은 가게는 표시해 둔다 — 목록에서 걸러 낼 수 있다 */
          is_closed: r.business_status === "CLOSED_PERMANENTLY",
        }
      })
    if (rows.length) {
      /*
        ⚠️ `upsert` 가 아니라 `update` 다. 이 창구는 **이미 있는 줄만** 손댄다 —
           `places` 에 없는 열쇠로 새 줄을 만들면 이름·좌표가 빈 껍데기가 생긴다.
      */
      await Promise.all(
        rows.map((row) => {
          const { google_place_id, ...patch } = row
          return db.from("places").update(patch).eq("google_place_id", google_place_id)
        })
      )
    }
  }

  return NextResponse.json({
    total: wanted.length,
    tried: batch.length,
    filled,
    /* 받아 왔지만 영업시간이 원래 없는 곳(공원 등) */
    noHours: empty,
    left: Math.max(0, todo.length - batch.length),
  })
}
