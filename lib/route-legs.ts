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
  /** 왜 실패했는지 (진단용). 키 내용은 절대 담지 않는다 */
  reason?: string
  /**
   * 길을 따라가는 선 (구글 encoded polyline).
   * ⚠️ 좌표 배열이 아니라 **문자열 그대로** 옮긴다. 풀어서 보내면 한 구간에
   *    수백 개 점이라 응답이 몇 배로 커진다. 푸는 건 화면 쪽에서 한다.
   */
  polyline?: string | null
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
    /*
      ⚠️ **선이 없는 옛 캐시는 한 번만 다시 묻는다.** 이 기능이 생기기 전에
         담긴 값들에는 선이 없어서, 그대로 쓰면 그 구간만 영영 직선으로 남는다.
         길이 없다고 확인된 구간(`no_route`)은 다시 물어도 소용없으니 그대로 쓴다.
    */
    if (!row.polyline && !row.no_route) return null
    return {
      distanceM: row.distance_m ?? null,
      durationS: row.duration_s ?? null,
      noRoute: !!row.no_route,
      polyline: row.polyline ?? null,
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
  r: { distanceM: number | null; durationS: number | null; noRoute: boolean; polyline?: string | null }
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
      p_polyline: r.polyline ?? null,
    })
  } catch {
    /* 캐시에 못 넣어도 화면은 그대로 나와야 한다 */
  }
}

/**
 * 예전 방식(Distance Matrix)으로 거리·시간만 받아 온다.
 *
 * Directions 가 막혀 있을 때의 **구명줄**이다. 선은 못 주지만 거리·시간은
 * 그대로 나오므로, 화면에서 사라지는 게 없다.
 */
async function askDistanceMatrix(a: LegPoint, b: LegPoint, mode: LegMode): Promise<LegResult | null> {
  const key = apiKey()
  if (!key) return null
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
    const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`)
    const json = (await res.json()) as {
      status?: string
      rows?: { elements?: { status?: string; distance?: { value?: number }; duration?: { value?: number } }[] }[]
    }
    const el = json?.rows?.[0]?.elements?.[0]
    if (json.status !== "OK" || !el) return null
    if (el.status !== "OK") {
      return { distanceM: null, durationS: null, noRoute: true, polyline: null, source: "google" }
    }
    return {
      distanceM: el.distance?.value ?? null,
      durationS: el.duration?.value ?? null,
      noRoute: false,
      polyline: null,
      source: "google",
    }
  } catch {
    return null
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
  if (!key) return { distanceM: null, durationS: null, noRoute: false, source: "error", reason: "키 없음" }

  /*
    ⚠️ Distance Matrix 가 아니라 **Directions** 를 쓴다. 거리·시간에 더해
       **길을 따라가는 선**까지 한 번에 준다. 예전엔 직선으로 그려서 강 위를
       가로지르고 건물을 뚫고 지나갔다. 따로 물으면 같은 구간을 두 번 부르는
       셈이라 요금이 두 배가 된다.
  */
  const params = new URLSearchParams({
    origin: `${a.lat},${a.lng}`,
    destination: `${b.lat},${b.lng}`,
    mode: GOOGLE_MODE[mode],
    language: "ko",
    key,
  })
  if (mode === "transit") {
    params.set("departure_time", String(Math.floor(Date.now() / 1000) + 86400))
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`
    )
    const json = (await res.json()) as {
      status?: string
      routes?: {
        overview_polyline?: { points?: string }
        legs?: { distance?: { value?: number }; duration?: { value?: number } }[]
      }[]
    }
    if (json.status === "ZERO_RESULTS") {
      /*
        이 구간은 이 수단으로 갈 길이 없다.
        ⚠️ 이것도 **캐시에 남긴다.** 일본 대중교통이 여기 해당하는데,
           안 남기면 화면을 열 때마다 다시 물어보게 된다.
      */
      return { distanceM: null, durationS: null, noRoute: true, polyline: null, source: "google" }
    }
    const route = json?.routes?.[0]
    const leg = route?.legs?.[0]
    if (json.status !== "OK" || !leg) {
      /*
        ⚠️ **Directions 가 막혀 있어도 거리·시간은 나와야 한다.**
           선(polyline)은 Directions 에만 있는데, 이 API 는 프로젝트에서 따로
           켜 줘야 한다. 안 켜져 있으면 `REQUEST_DENIED` 가 온다.
           여기서 그냥 실패로 두면 **선이 없는 정도가 아니라 거리·시간이 통째로
           사라진다** — 이미 잘 돌던 기능이 죽는다.
           그래서 예전에 쓰던 Distance Matrix 로 한 번 더 물어본다.
           (Directions 를 켜는 순간 저절로 선까지 나온다)
      */
      const fb = await askDistanceMatrix(a, b, mode)
      if (fb) return fb
      return {
        distanceM: null, durationS: null, noRoute: false, source: "error",
        reason: `구글: ${json.status ?? "응답없음"}`,
      }
    }
    return {
      distanceM: leg.distance?.value ?? null,
      durationS: leg.duration?.value ?? null,
      noRoute: false,
      polyline: route?.overview_polyline?.points ?? null,
      source: "google",
    }
  } catch (e) {
    return {
      distanceM: null, durationS: null, noRoute: false, source: "error",
      reason: `연결 실패: ${e instanceof Error ? e.message.slice(0, 60) : ""}`,
    }
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
