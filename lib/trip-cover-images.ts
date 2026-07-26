/**
 * Compatibility re-exports — canonical implementation lives in `lib/getCityImage.ts`.
 */
export {
  CITY_IMAGES,
  COUNTRY_IMAGES,
  FALLBACK_TRIP_COVER,
  getCityImage,
  resolveTripCoverImage,
  toEnglishKeywords,
  withUnsplashQuality,
} from "@/lib/getCityImage"

import { CITY_IMAGES, COUNTRY_IMAGES } from "@/lib/getCityImage"

/** @deprecated Prefer CITY_IMAGES / getCityImage */
export const tripCoverPresets: Record<string, string> = {
  ...COUNTRY_IMAGES,
  ...CITY_IMAGES,
}
