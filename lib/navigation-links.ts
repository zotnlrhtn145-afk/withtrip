export type NavDestination = {
  name: string
  /** 좌표는 선택 — 없으면 업장 이름으로 검색 기반 길찾기를 연다. */
  lat?: number | null
  lng?: number | null
}

/** 좌표가 유효한 숫자로 둘 다 있는지 확인. */
function hasCoords(dest: NavDestination): dest is NavDestination & { lat: number; lng: number } {
  return typeof dest.lat === "number" && typeof dest.lng === "number"
}

const TMAP_ANDROID_PACKAGE = "com.skt.tmap.ku"
const TMAP_IOS_APP_ID = "431589174"

function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") return false
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false
  return /android/i.test(navigator.userAgent)
}

/** Tmap's app-scheme deep link — unofficial but long-standing, no API key needed.
 *  좌표가 있으면 경로안내, 없으면 업장 이름으로 검색을 연다. */
export function buildTmapAppUrl(dest: NavDestination): string {
  if (hasCoords(dest)) {
    return `tmap://route?goalname=${encodeURIComponent(dest.name)}&goalx=${dest.lng}&goaly=${dest.lat}`
  }
  return `tmap://search?name=${encodeURIComponent(dest.name)}`
}

function buildTmapStoreUrl(): string {
  return isAndroid()
    ? `market://details?id=${TMAP_ANDROID_PACKAGE}`
    : `https://apps.apple.com/app/id${TMAP_IOS_APP_ID}`
}

/** Kakao Map's official universal link — opens the app if installed, the web map otherwise.
 *  좌표가 있으면 경로안내, 없으면 업장 이름으로 검색을 연다. */
export function buildKakaoMapUrl(dest: NavDestination): string {
  if (hasCoords(dest)) {
    return `https://map.kakao.com/link/to/${encodeURIComponent(dest.name)},${dest.lat},${dest.lng}`
  }
  return `https://map.kakao.com/link/search/${encodeURIComponent(dest.name)}`
}

export const isNavAppAvailable = isMobileUserAgent

/**
 * Tmap has no public web fallback, so we attempt the app scheme and, if the
 * tab is still visible after a beat (meaning nothing intercepted it), assume
 * the app isn't installed and send the user to its store listing.
 */
export function openTmapDirections(dest: NavDestination) {
  if (typeof window === "undefined") return

  if (!isMobileUserAgent()) {
    window.open(buildKakaoMapUrl(dest), "_blank", "noopener,noreferrer")
    return
  }

  const timer = window.setTimeout(() => {
    if (document.visibilityState === "visible") {
      window.location.href = buildTmapStoreUrl()
    }
  }, 1500)

  document.addEventListener(
    "visibilitychange",
    () => window.clearTimeout(timer),
    { once: true }
  )

  window.location.href = buildTmapAppUrl(dest)
}

export function openKakaoMapDirections(dest: NavDestination) {
  if (typeof window === "undefined") return
  window.open(buildKakaoMapUrl(dest), "_blank", "noopener,noreferrer")
}

/** Rough bounding box for South Korea (mainland + Jeju) — good enough to decide 국내/해외 UI.
 *  좌표를 모르면 국내로 간주(티맵·카카오·구글 모두 노출)한다. */
export function isInKorea(lat?: number | null, lng?: number | null): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return true
  return lat >= 33 && lat <= 38.7 && lng >= 124.5 && lng <= 131.9
}

/**
 * Uber's universal deep link (pickup = live GPS, dropoff = destination).
 * Requires a free Uber developer app's client_id — returns null until one
 * is configured, so callers can hide the option instead of shipping a dead link.
 */
export function buildUberUrl(dest: NavDestination): string | null {
  const clientId = process.env.NEXT_PUBLIC_UBER_CLIENT_ID
  if (!clientId || !hasCoords(dest)) return null

  const query = [
    "action=setPickup",
    `client_id=${encodeURIComponent(clientId)}`,
    "pickup=my_location",
    `dropoff[latitude]=${dest.lat}`,
    `dropoff[longitude]=${dest.lng}`,
    `dropoff[nickname]=${encodeURIComponent(dest.name)}`,
  ].join("&")

  return `https://m.uber.com/ul/?${query}`
}

export function openUberDirections(dest: NavDestination) {
  if (typeof window === "undefined") return
  const url = buildUberUrl(dest)
  if (!url) return
  window.open(url, "_blank", "noopener,noreferrer")
}

/**
 * Universal, worldwide Google Maps directions.
 * 목적지를 좌표 대신 업장 이름으로 넣어 이름이 표시되게 한다(없으면 좌표).
 *
 * ⚠️ 구글은 한국 내 자동차·도보 경로를 제공하지 않는다(지도 데이터 반출 규제 → 국내는 대중교통만).
 *   travelmode 를 강제하지 않는 이유: 현재 위치가 한국이면 자가용 경로가 "범위 초과" 오류를 낸다.
 *   미지정 시 구글이 지역에 맞게(국내=대중교통, 사용자가 있는 해외=자가용) 알아서 고른다.
 *   국내 자가용/도보 길찾기는 티맵·카카오맵이 담당한다.
 */
export function buildGoogleMapsDirectionsUrl(dest: NavDestination): string {
  const name = dest.name?.trim()
  const destination = name ? encodeURIComponent(name) : `${dest.lat},${dest.lng}`
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`
}

export function openGoogleMapsDirections(dest: NavDestination) {
  if (typeof window === "undefined") return
  window.open(buildGoogleMapsDirectionsUrl(dest), "_blank", "noopener,noreferrer")
}
