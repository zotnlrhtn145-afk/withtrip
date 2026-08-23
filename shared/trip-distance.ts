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

/**
 * 이동 수단.
 * ⚠️ 대중교통(transit)은 **추정하지 않는다** — 나라·시간대마다 편차가 너무 크다.
 *    실제 조회값이 있을 때만 표기에 쓴다.
 */
export type TravelMode = "walk" | "drive" | "transit"

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
const DETOUR = { walk: 1.3, drive: 1.4, transit: 1.4 } as const
/** 걷는 속도 4.5km/h · 도시 주행 25km/h(신호·정체 포함). 대중교통은 추정 안 함(임시값) */
const SPEED_KMH = { walk: 4.5, drive: 25, transit: 25 } as const

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
  const name = mode === "walk" ? "도보" : mode === "transit" ? "대중교통" : "차"
  if (realMinutes != null) return `${dist} · ${name} ${formatMinutes(realMinutes)}`
  /*
    ⚠️ 대중교통은 추정치를 만들지 않는다. 배차·환승은 지역마다 달라서
       지어낸 숫자가 되기 때문이다. 실제 값이 없으면 도보 추정으로 대신한다.
  */
  if (mode === "transit") return `${dist} · 도보 약 ${formatMinutes(roughMinutes(km, "walk"))}`
  return `${dist} · ${name} 약 ${formatMinutes(roughMinutes(km, mode))}`
}

/**
 * 공항에서 뜨고 내리는 일정인가.
 *
 * 교통편을 등록하면 「인천국제공항 출발」 같은 일정이 자동으로 만들어진다.
 * 이제 여기에 좌표가 있어서 지도에 찍히는데, 그 구간을 **다른 이동과 똑같이
 * 다루면 안 된다.**
 *
 * ⚠️ 비행 구간을 "총 이동거리" 에 넣으면 도쿄 여행이 **28km 에서 1,200km 로**
 *    바뀐다. 그 숫자는 원래 "오늘 시내를 얼마나 도나" 를 보려던 것이라
 *    쓸모가 없어진다. 지도에는 그리되 거리에서는 뺀다.
 *
 * ⚠️ 구글에 길을 묻지도 않는다. 인천→나리타를 "자동차로" 물으면 답이 없거나
 *    배를 타고 도는 엉뚱한 경로가 나온다. 돈만 나가고 쓸 데가 없다.
 *
 * ⚠️ **거리로 판단하지 않는다.** "300km 넘으면 비행기" 로 했다가는 제주–서울
 *    배편이나 KTX 가 전부 비행기가 된다. 자동 생성된 일정의 **생김새**로 본다.
 */
export function isAirportStop(category: string | null | undefined, placeName: string | null | undefined): boolean {
  if ((category ?? "") !== "이동") return false
  return /공항|airport/i.test(placeName ?? "")
}

/**
 * 두 일정 사이가 비행 구간인가.
 *
 * 두 곳이 다 공항이면 당연히 비행이다. 그런데 **그 사이에 다른 일정이 끼어
 * 있는 경우**가 있다 — 시각을 잘못 넣어 "10:00 우동 신" 이 이륙과 착륙 사이에
 * 들어가면, 인천공항 → 우동 신이 한 구간이 되어 **1,199km 를 걸어간다**고
 * 나온다(실기기에서 그대로 봤다. "도보 약 346시간 24분").
 *
 * 그래서 **한쪽만 공항이어도 300km 를 넘으면** 비행으로 본다.
 *
 * ⚠️ 이건 "300km 넘으면 비행기" 와 다르다. 그 규칙은 제주–서울 배편이나
 *    서울–부산 KTX 까지 비행기로 만든다. 여기서는 **한쪽이 공항일 때만**
 *    본다 — 공항에서 300km 떨어진 곳을 그날 안에 차로 갈 수는 없다.
 */
const FLIGHT_MIN_KM = 300

export function isFlightLeg(
  a: { category?: string | null; place_name?: string | null },
  b: { category?: string | null; place_name?: string | null },
  km?: number
): boolean {
  const aAir = isAirportStop(a.category, a.place_name)
  const bAir = isAirportStop(b.category, b.place_name)
  if (aAir && bAir) return true
  if (!aAir && !bAir) return false
  return typeof km === "number" && km >= FLIGHT_MIN_KM
}
