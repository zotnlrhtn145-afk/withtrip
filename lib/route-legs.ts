import { getSupabaseAdmin } from "@/lib/supabase-admin"

/**
 * 두 지점 사이 **실제** 이동 시간. 캐시를 먼저 보고, 없을 때만 구글에 묻는다.
 *
 * ⚠️ **이 파일이 요금을 결정한다.** 원칙은 셋이다.
 *    1) 캐시가 먼저다 — 좌표를 100m 로 반올림해 여러 여행이 같은 줄을 쓴다.
 *    2) 애매한 거리만 묻는다 — 아주 가깝거나 아주 멀면 물어봐야 얻는 게 없다.
 *    3) **실패도 저장한다** — 일본은 구글이 대중교통 경로를 아예 주지 않는다.
 *       안 남기면 볼 때마다 다시 물어보게 되고 그게 전부 요금이다.
 *
 * ⚠️ 이 모듈은 **절대 throw 하지 않는다.** 조회가 실패해도 화면은 직선거리
 *    추정치로 그대로 돌아가야 한다(기능 무중단).
 */

export type LegMode = "walk" | "drive" | "transit"

export type LegPoint = { lat: number; lng: number }

export type LegResult = {
  /** 실제 이동 거리(m). 못 구했으면 null */
  distanceM: number | null
  /** 실제 소요 시간(초). 못 구했으면 null */
  durationS: number | null
  /** 구글이 경로를 못 준 경우 (예: 일본 대중교통) */
  noRoute: boolean
  /** 어디서 온 값인지 — 캐시 적중률을 보려고 남긴다 */
  source: "cache" | "google" | "error"
}

const GOOGLE_MODE: Record<LegMode, string> = {
  walk: "walking",
  drive: "driving",
  transit: "transit",
}

/*
  ⚠️ 키 이름을 **장소 검색과 똑같은 순서**로 찾는다. 배포 환경마다 어떤 이름으로
     넣어 뒀는지가 달라서, 한 곳만 보면 "키가 없다" 며 조용히 빈 값을 돌려준다
     (실제로 그렇게 새 API 가 아무것도 못 받아 왔다).
*/
function apiKey(): string {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ||
    ""
  ).trim()
}

async function fromCache(a: LegPoint, b: LegPoint, mode: LegMode): Promise<LegResult | null> {
  try {
    // 서비스 키가 없으면 캐시를 못 쓴다 — 그래도 구글 직접 조회로 화면은 나온다
    const db = getSupabaseAdmin()
    if (!db) return null
    const { data, error } = await db.rpc("route_cache_get", {
      p_from_lat: a.lat,
      p_from_lng: a.lng,
      p_to_lat: b.lat,
      p_to_lng: b.lng,
      p_mode: mode,
    })
    if (error) return null
    const row = Array.isArray(data) ? data[0] : null
    if (!row) return null
    return {
      distanceM: row.distance_m ?? null,
      durationS: row.duration_s ?? null,
      noRoute: !!row.no_route,
      source: "cache",
    }
  } catch {
    return null
  }
}

async function toCache(
  a: LegPoint,
  b: LegPoint,
  mode: LegMode,
  r: { distanceM: number | null; durationS: number | null; noRoute: boolean }
): Promise<void> {
  try {
    const db = getSupabaseAdmin()
    if (!db) return
    await db.rpc("route_cache_put", {
      p_from_lat: a.lat,
      p_from_lng: a.lng,
      p_to_lat: b.lat,
      p_to_lng: b.lng,
      p_mode: mode,
      p_distance_m: r.distanceM,
      p_duration_s: r.durationS,
      p_no_route: r.noRoute,
    })
  } catch {
    /* 캐시에 못 넣어도 화면은 그대로 나와야 한다 */
  }
}

/**
 * 구글에 한 구간을 묻는다.
 *
 * ⚠️ 대중교통은 **출발 시각이 없으면 아무것도 안 준다**(확인함).
 *    실제 여행 날짜를 모를 때가 많아 "내일 오전 10시" 를 기준으로 삼는다 —
 *    평일 낮 운행 기준이라 대체로 무난하다.
 */
async function askGoogle(a: LegPoint, b: LegPoint, mode: LegMode): Promise<LegResult> {
  const key = apiKey()
  if (!key) return { distanceM: null, durationS: null, noRoute: false, source: "error" }

  const params = new URLSearchParams({
    origins: `${a.lat},${a.lng}`,
    destinations: `${b.lat},${b.lng}`,
    mode: GOOGLE_MODE[mode],
    language: "ko",
    key,
  })
  if (mode === "transit") {
    params.set("departure_time", String(Math.floor(Date.now() / 1000) + 86400))
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`
    )
    const json = (await res.json()) as {
      status?: string
      rows?: { elements?: { status?: string; distance?: { value?: number }; duration?: { value?: number } }[] }[]
    }
    const el = json?.rows?.[0]?.elements?.[0]
    if (json.status !== "OK" || !el) {
      return { distanceM: null, durationS: null, noRoute: false, source: "error" }
    }
    if (el.status !== "OK") {
      /*
        ZERO_RESULTS 등 — 이 구간은 이 수단으로 갈 길이 없다.
        ⚠️ 이것도 **캐시에 남긴다.** 일본 대중교통이 여기 해당하는데,
           안 남기면 화면을 열 때마다 다시 물어보게 된다.
      */
      return { distanceM: null, durationS: null, noRoute: true, source: "google" }
    }
    return {
      distanceM: el.distance?.value ?? null,
      durationS: el.duration?.value ?? null,
      noRoute: false,
      source: "google",
    }
  } catch {
    return { distanceM: null, durationS: null, noRoute: false, source: "error" }
  }
}

/** 한 구간의 실제 이동 시간. 캐시 → 구글 순으로 본다. */
export async function getLeg(a: LegPoint, b: LegPoint, mode: LegMode): Promise<LegResult> {
  const hit = await fromCache(a, b, mode)
  if (hit) return hit

  const fresh = await askGoogle(a, b, mode)
  // 오류(네트워크·키 문제)는 저장하지 않는다 — 다음에 다시 시도해야 한다
  if (fresh.source === "google") await toCache(a, b, mode, fresh)
  return fresh
}
