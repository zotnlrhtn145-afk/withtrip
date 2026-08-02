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
