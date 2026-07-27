/** Clean white card surface used by accommodation cards. */
export const ACCOMMODATION_CARD_BG = "#FFFFFF"

/** @deprecated Use ACCOMMODATION_CARD_BG */
export const ACCOMMODATION_CARD_CREAM = ACCOMMODATION_CARD_BG

export type HotelImagePromptOptions = {
  /** Optional city / region hint (e.g. Osaka, Paris). */
  city?: string
  /** Card background hex for color-matching instructions. */
  cardBackground?: string
  /** @deprecated Prefer cardBackground */
  cardCream?: string
}

/**
 * Build a cinematic hotel exterior prompt for AI image APIs (DALL·E, etc.).
 * Cool night cityscape grading so the result sits cleanly on a white card.
 */
export function generateHotelImagePrompt(
  hotelName: string,
  options: HotelImagePromptOptions = {}
): string {
  const name = String(hotelName ?? "").trim() || "a boutique city hotel"
  const city = String(options.city ?? "").trim()
  const cardBg = options.cardBackground ?? options.cardCream ?? ACCOMMODATION_CARD_BG
  const locationClause = city ? ` in ${city}` : ""

  return [
    `Create a cinematic architectural photograph of ${name}${locationClause} at night.`,
    "Cinematic architectural photography.",
    "Dark cityscape with cool blue night tones and clean ambient light from windows.",
    "Detailed facade details — stone, glass, and metal textures.",
    "Atmospheric lighting and shadows with deep depth of field.",
    `Color grade must harmonize with a clean modern white card background (${cardBg}): natural cool night palette, crisp contrast, no warm sepia or cream wash.`,
    "Clean contemporary look suitable for a white UI card.",
    "Cinematic low angle, high-resolution, detailed hotel exterior.",
  ].join(" ")
}

/** Cool night / modern hotel exterior Unsplash IDs (stable). */
const HOTEL_BANNER_POOL = [
  "photo-1542314831-068cd1dbfeeb", // luxury hotel exterior
  "photo-1566073771259-6a8506099945", // resort evening
  "photo-1551882547-ff40c63fe5fa", // hotel facade
  "photo-1520250497591-112f2f40a3f4", // boutique hotel
  "photo-1618773928121-c32242e63f39", // modern hotel
  "photo-1582719508461-905c673771fd", // hotel interior cool ambient
  "photo-1445019980597-93fa8acb246c", // hotel lobby
  "photo-1571896349842-33c89424de2d", // resort pool night-leaning
] as const

function hashName(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

/**
 * Deterministic placeholder banner until a real AI image URL is stored.
 */
export function resolveHotelBannerSrc(
  hotelName: string,
  options?: { aiImageUrl?: string | null }
): string {
  const ai = String(options?.aiImageUrl ?? "").trim()
  if (ai) return ai

  const key = String(hotelName ?? "").trim() || "hotel"
  const id = HOTEL_BANNER_POOL[hashName(key) % HOTEL_BANNER_POOL.length]
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`
}

/**
 * Optional helper for calling an image API later.
 */
export function buildHotelImageGenerationRequest(
  hotelName: string,
  options: HotelImagePromptOptions = {}
) {
  const prompt = generateHotelImagePrompt(hotelName, options)
  const slug = String(hotelName ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)

  return {
    prompt,
    suggestedFileName: `hotel-${slug || "banner"}.png`,
    cardBackground: options.cardBackground ?? options.cardCream ?? ACCOMMODATION_CARD_BG,
  }
}
