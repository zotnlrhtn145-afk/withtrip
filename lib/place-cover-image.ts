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
} as const

export function resolveCoverImageUrl(input: {
  imageUrl?: string | null
  category?: string | null
  subCategory?: string | null
  kind?: "restaurant" | "bar" | "stay" | string | null
}): string {
  const primary = String(input.imageUrl ?? "").trim()
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

/** Build Google Places Photo API URL from photo_reference. */
export function buildGooglePlacePhotoUrl(
  photoReference: string,
  apiKey: string,
  maxWidth = 1200
): string {
  const ref = String(photoReference ?? "").trim()
  const key = String(apiKey ?? "").trim()
  if (!ref || !key) return ""
  const url = new URL("https://maps.googleapis.com/maps/api/place/photo")
  url.searchParams.set("maxwidth", String(maxWidth))
  url.searchParams.set("photo_reference", ref)
  url.searchParams.set("key", key)
  return url.toString()
}
