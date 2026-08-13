/**
 * Cinematic cover images for wishlist cards.
 * Prefer Google Places photo URL; otherwise pick Unsplash by category keywords.
 */

export const COVER_FALLBACK = {
  restaurantFineDining:
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
  sushiOmakase:
    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=80",
  french:
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80",
  korean:
    "https://images.unsplash.com/photo-1498654896293-37aacf7507d1?auto=format&fit=crop&w=1200&q=80",
  barLounge:
    "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80",
  cocktail:
    "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80",
  cafe:
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
  luxuryHotel:
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  luxuryResort:
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80",
  defaultDining:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
  landmark:
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80",
} as const

export function resolveCoverImageUrl(input: {
  imageUrl?: string | null
  category?: string | null
  subCategory?: string | null
  kind?: "restaurant" | "bar" | "stay" | "attraction" | string | null
}): string {
  // 예전에 저장된 "키가 박힌" 구글 사진 URL은 여기서 프록시 URL로 바꾼다.
  // (DB는 건드리지 않고 읽을 때만 변환 — 모든 화면이 이 함수를 거치므로 한 곳에서 처리된다)
  const primary = rewriteLegacyGooglePhotoUrl(input.imageUrl)
  if (primary && !isLocalPlaceholder(primary)) return primary

  const hay = `${input.kind ?? ""} ${input.category ?? ""} ${input.subCategory ?? ""}`.toLowerCase()

  if (
    /숙소|hotel|resort|lodging|stay|리조트|료칸|ryokan|모텔|inn|게스트하우스/.test(hay) ||
    input.kind === "stay"
  ) {
    return /resort|리조트|료칸|ryokan/.test(hay)
      ? COVER_FALLBACK.luxuryResort
      : COVER_FALLBACK.luxuryHotel
  }

  if (/관광|명소|랜드마크|landmark|공원|park|사원|temple|박물관|museum|전망대|타워|tower/.test(hay) || input.kind === "attraction") {
    return COVER_FALLBACK.landmark
  }

  if (/바\b|bar|라운지|lounge|칵테일|cocktail|위스키|하이볼/.test(hay) || input.kind === "bar") {
    return /칵테일|cocktail|하이볼/.test(hay)
      ? COVER_FALLBACK.cocktail
      : COVER_FALLBACK.barLounge
  }
  if (/스시|sushi|오마카세|omakase|일식|japanese/.test(hay)) {
    return COVER_FALLBACK.sushiOmakase
  }
  if (/프렌치|french|가이세키|kaiseki|파인|fine|코스|다이닝|michelin|미슐랭/.test(hay)) {
    return /프렌치|french/.test(hay) ? COVER_FALLBACK.french : COVER_FALLBACK.restaurantFineDining
  }
  if (/한식|korean|정식/.test(hay)) return COVER_FALLBACK.korean
  if (/카페|cafe|coffee/.test(hay)) return COVER_FALLBACK.cafe
  if (/레스토랑|restaurant|식사/.test(hay) || input.kind === "restaurant") {
    return COVER_FALLBACK.restaurantFineDining
  }

  return COVER_FALLBACK.defaultDining
}

function isLocalPlaceholder(url: string) {
  return (
    url.startsWith("/images/place-") ||
    url === "/placeholder.svg" ||
    url.includes("place-sushi") ||
    url.includes("place-bar")
  )
}

/**
 * 사진 프록시 URL의 기준 origin.
 *
 * **절대 URL이어야 하는 이유**: 이 URL이 saved_places.image_url로 DB에 저장되고,
 * 네이티브 앱(withtrip-app)이 그 값을 그대로 <Image>에 넣는다. 상대경로면 앱에서 깨진다.
 */
function resolveSiteOrigin(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (env) return env.replace(/\/+$/, "")
  if (typeof window !== "undefined") return window.location.origin
  return ""
}

/**
 * photo_reference로 우리 사진 프록시 URL을 만든다. **브라우저·앱으로 나가는 사진 URL은 전부 이것을 쓴다.**
 *
 * 구글 키는 프록시(app/api/places/photo)에서만 붙으므로 키가 클라이언트나
 * DB(saved_places.image_url)에 저장되지 않는다.
 *
 * @param origin 서버 라우트에서 요청 origin을 넘긴다. 없으면 NEXT_PUBLIC_SITE_URL → window 순으로 찾는다.
 */
export function buildPlacePhotoProxyUrl(
  photoReference: string,
  maxWidth = 1200,
  origin?: string
): string {
  const ref = String(photoReference ?? "").trim()
  if (!ref) return ""
  const path = `/api/places/photo?ref=${encodeURIComponent(ref)}&w=${maxWidth}`
  const base = (origin ?? resolveSiteOrigin()).replace(/\/+$/, "")
  return base ? `${base}${path}` : path
}

/**
 * 상대 프록시 URL(`/api/places/photo?...`)을 절대 URL로 바꾼다. 그 외 URL은 그대로 둔다.
 *
 * API 라우트가 응답 직전에 한 번 적용한다 — 이 값이 DB에 저장되고 네이티브 앱이
 * 그대로 이미지 주소로 쓰기 때문에 반드시 절대 URL이어야 한다.
 */
export function toAbsolutePhotoUrl(url: string | null | undefined, origin: string): string {
  const raw = String(url ?? "").trim()
  if (!raw.startsWith("/api/places/photo")) return raw
  return `${String(origin ?? "").replace(/\/+$/, "")}${raw}`
}

/** API 라우트에서 쓸 기준 origin. 환경변수가 있으면 그것을, 없으면 요청 origin을 쓴다. */
export function resolveRequestOrigin(requestUrl: string): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (env) return env.replace(/\/+$/, "")
  try {
    return new URL(requestUrl).origin
  } catch {
    return ""
  }
}

/** 구글 사진 URL(키 포함)에서 photo_reference만 뽑아낸다. 아니면 null. */
export function extractGooglePhotoReference(url: string): string | null {
  const raw = String(url ?? "").trim()
  if (!raw.includes("maps.googleapis.com") || !raw.includes("photo_reference")) return null
  try {
    const ref = new URL(raw).searchParams.get("photo_reference")
    return ref ? ref : null
  } catch {
    return null
  }
}

/**
 * 예전에 DB나 캐시에 저장된 "키가 박힌" 구글 사진 URL을 프록시 URL로 바꾼다.
 *
 * saved_places 기존 행 대부분(153/156)의 image_url이 이 형태다. **DB는 수정하지 않고**
 * 화면에 뿌릴 때만 변환하므로, 나중에 유출된 키를 폐기해도 기존 사진이 계속 보인다.
 * 구글 사진 URL이 아니면 원본을 그대로 돌려준다.
 */
export function rewriteLegacyGooglePhotoUrl(
  url: string | null | undefined,
  origin?: string
): string {
  const raw = String(url ?? "").trim()
  if (!raw) return ""
  const ref = extractGooglePhotoReference(raw)
  if (!ref) return raw

  let width = 1200
  try {
    const w = Number(new URL(raw).searchParams.get("maxwidth"))
    if (Number.isFinite(w) && w > 0) width = w
  } catch {
    /* 기본값 사용 */
  }
  return buildPlacePhotoProxyUrl(ref, width, origin)
}

// ⚠️ 예전에 있던 buildGooglePlacePhotoUrl(ref, apiKey)는 삭제했다.
//    URL에 구글 키를 박아 넣어서, 그 URL이 클라이언트 응답과 DB(saved_places.image_url)에
//    그대로 저장되며 서버 키가 유출됐다. 사진 URL은 반드시 buildPlacePhotoProxyUrl()을 쓴다.

/**
 * 이미 만들어진 사진 URL 의 너비만 바꾼다.
 *
 * 목록 썸네일에 1200px 짜리를 그대로 쓰면 한 화면에 수십 MB를 받게 된다.
 * 화면에 그리는 크기에 맞춰 줄여서 요청한다 (PHOTO_W 참고).
 * 구글 사진이 아니면(Unsplash 등) 원본을 그대로 둔다.
 */
export function resizePlacePhotoUrl(url: string | null | undefined, width: number): string {
  const raw = String(url ?? "").trim()
  if (!raw || !Number.isFinite(width) || width <= 0) return raw
  const w = Math.round(width)

  // 우리 프록시 주소 — w 파라미터만 갈아끼운다
  if (raw.includes("/api/places/photo")) {
    return /[?&]w=\d+/.test(raw) ? raw.replace(/([?&]w=)\d+/, `$1${w}`) : `${raw}&w=${w}`
  }

  // 예전 구글 URL — photo_reference 를 뽑아 프록시 주소로 새로 만든다
  const ref = extractGooglePhotoReference(raw)
  if (ref) return buildPlacePhotoProxyUrl(ref, w)

  return raw
}
