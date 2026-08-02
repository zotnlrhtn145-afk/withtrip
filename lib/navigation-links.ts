export type NavDestination = {
  name: string
  lat: number
  lng: number
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

/** Tmap's app-scheme deep link — unofficial but long-standing, no API key needed. */
export function buildTmapAppUrl(dest: NavDestination): string {
  return `tmap://route?goalname=${encodeURIComponent(dest.name)}&goalx=${dest.lng}&goaly=${dest.lat}`
}

function buildTmapStoreUrl(): string {
  return isAndroid()
    ? `market://details?id=${TMAP_ANDROID_PACKAGE}`
    : `https://apps.apple.com/app/id${TMAP_IOS_APP_ID}`
}

/** Kakao Map's official universal link — opens the app if installed, the web map otherwise. */
export function buildKakaoMapUrl(dest: NavDestination): string {
  return `https://map.kakao.com/link/to/${encodeURIComponent(dest.name)},${dest.lat},${dest.lng}`
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

/** Rough bounding box for South Korea (mainland + Jeju) — good enough to decide 국내/해외 UI. */
export function isInKorea(lat: number, lng: number): boolean {
  return lat >= 33 && lat <= 38.7 && lng >= 124.5 && lng <= 131.9
}

/**
 * Uber's universal deep link (pickup = live GPS, dropoff = destination).
 * Requires a free Uber developer app's client_id — returns null until one
 * is configured, so callers can hide the option instead of shipping a dead link.
 */
export function buildUberUrl(dest: NavDestination): string | null {
  const clientId = process.env.NEXT_PUBLIC_UBER_CLIENT_ID
  if (!clientId) return null

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

/** Universal, worldwide fallback for destinations outside Korea. */
export function buildGoogleMapsDirectionsUrl(dest: NavDestination): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`
}

export function openGoogleMapsDirections(dest: NavDestination) {
  if (typeof window === "undefined") return
  window.open(buildGoogleMapsDirectionsUrl(dest), "_blank", "noopener,noreferrer")
}
