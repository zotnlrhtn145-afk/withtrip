/**
 * 일정 사이의 거리와 대략 이동 시간.
 *
 * ⚠️ **여기 있는 건 전부 공짜 계산이다.** 구글에 묻지 않는다.
 *    화면에 늘 보이는 값은 이걸로 만들고, 실제 소요 시간은 애매한 구간에만
 *    따로 물어본다(그건 돈이 든다).
 *
 * ⚠️ 웹과 앱이 **같은 숫자**를 보여야 한다. 한쪽이 "1.2km 도보 15분",
 *    다른 쪽이 "1.2km 도보 18분" 이면 같은 여행을 두 기기로 볼 때 어긋난다.
 *    그래서 계산은 이 파일 하나에서만 한다. (화면 모양은 각자 정한다)
 *
 * ⚠️ 이 파일은 `~/withtrip/shared/` 가 원본이다.
 *    앱 쪽 `src/lib/shared/` 는 복사본이므로 직접 고치지 말 것.
 */

export type LatLng = { lat: number; lng: number }

/** 이동 수단. 대중교통은 나라마다 편차가 커서 따로 추정하지 않는다(실제 조회로 넘긴다). */
export type TravelMode = "walk" | "drive"

/**
 * 두 점 사이 직선거리(km).
 *
 * 지구를 공으로 보고 재는 방식이라 오차가 있지만, 도시 안 거리에서는
 * 수십 미터 수준이라 "가깝다/멀다"를 가리기엔 충분하다.
 */
export function straightKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/*
  ⚠️ **직선거리는 실제 이동거리보다 짧다.** 길은 건물을 돌아가고 강은 다리로만
     건넌다. 그대로 쓰면 "10분이면 가겠네" 하고 계획을 짰다가 늦는다.
     도시에서 실제로 걷는 거리는 직선의 1.3배쯤, 차는 1.4배쯤이다.
*/
const DETOUR = { walk: 1.3, drive: 1.4 } as const
/** 걷는 속도 4.5km/h · 도시 주행 25km/h(신호·정체 포함) */
const SPEED_KMH = { walk: 4.5, drive: 25 } as const

/** 대략 몇 분 걸릴지. 어디까지나 추정이라 화면에는 "약" 을 붙여 보여 준다. */
export function roughMinutes(km: number, mode: TravelMode): number {
  const real = km * DETOUR[mode]
  const min = (real / SPEED_KMH[mode]) * 60
  // 1분 미만도 1분으로 — "0분" 은 읽는 사람을 헷갈리게 한다
  return Math.max(1, Math.round(min))
}

/**
 * 이 구간을 구글에 물어봐야 하나?
 *
 * ⚠️ **돈이 여기서 갈린다.** 가까우면 걸어서 금방이고, 아주 멀면 정확한 분보다
 *    "많이 멀다" 는 사실이 중요하다. 둘 다 추정으로 충분하다.
 *    그 사이 애매한 구간만 실제로 물어본다.
 */
export const NEAR_KM = 0.5
export const FAR_KM = 20

export function needsRealLookup(km: number): boolean {
  return km > NEAR_KM && km <= FAR_KM
}

/**
 * 아주 가까우면 거리를 숫자로 말하지 않는다.
 *
 * ⚠️ 50m 아래를 미터로 찍으면 "0m" 이 나온다(반올림). 같은 건물이거나 좌표를
 *    주소로 찾아 둘 다 같은 지점이 된 경우인데, "0m · 도보 약 1분" 은
 *    읽는 사람을 헷갈리게 한다.
 */
export const SAME_SPOT_KM = 0.05

/** 거리 표기: 1km 미만은 미터로 (”0.3km” 보다 “300m” 가 읽기 쉽다) */
export function formatKm(km: number): string {
  if (km < SAME_SPOT_KM) return "바로 근처"
  if (km < 1) return `${Math.max(10, Math.round(km * 100) * 10)}m`
  return `${km < 10 ? km.toFixed(1) : Math.round(km)}km`
}

/** 시간 표기: 60분이 넘으면 시간·분으로 */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

/** 얼마나 부담스러운 이동인지 — 화면에서 색이나 경고를 정하는 데 쓴다 */
export type LegTone = "near" | "normal" | "far"

export function legTone(km: number): LegTone {
  if (km <= NEAR_KM) return "near"
  if (km <= 5) return "normal"
  return "far"
}

/**
 * 한 구간을 한 줄로 요약. 실제 조회값이 있으면 그걸 쓰고, 없으면 추정치.
 *
 * 예) `1.2km · 도보 약 21분`   /   `1.2km · 도보 15분` (실제 조회값)
 */
export function legLabel(
  km: number,
  mode: TravelMode,
  realMinutes?: number | null
): string {
  // 바로 옆이면 이동 시간을 말할 필요가 없다
  if (km < SAME_SPOT_KM) return "바로 근처"
  const dist = formatKm(km)
  const name = mode === "walk" ? "도보" : "차"
  if (realMinutes != null) return `${dist} · ${name} ${formatMinutes(realMinutes)}`
  return `${dist} · ${name} 약 ${formatMinutes(roughMinutes(km, mode))}`
}
