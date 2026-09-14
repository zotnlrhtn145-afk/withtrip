/** Public place information only: never include private saved IDs, notes or photo URLs. */
export type ExternalPlace = { name?: string | null; address?: string | null; lat?: number | null; lng?: number | null }
export function externalPlaceShare(place: ExternalPlace) {
  const name = place.name?.trim() || "추천 장소"
  const address = place.address?.trim() || ""
  const { lat, lng } = place
  const valid = typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) <= 90 && typeof lng === "number" && Number.isFinite(lng) && Math.abs(lng) <= 180
  const korea = valid && lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132
  const url = valid
    ? korea ? `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`
      : `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
    : `https://map.kakao.com/link/search/${encodeURIComponent([name, address].filter(Boolean).join(" "))}`
  return { title: `${name} | 위드트립`, text: ["위드트립에서 발견한 장소", name, address, url].filter(Boolean).join("\n") }
}
