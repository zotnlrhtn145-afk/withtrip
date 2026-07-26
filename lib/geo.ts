export type LatLng = {
  lat: number
  lng: number
}

/** Osaka Station (Umeda) — used when geolocation is unavailable. */
export const FALLBACK_LOCATION: LatLng = {
  lat: 34.702485,
  lng: 135.495951,
}

const EARTH_RADIUS_M = 6371000

/** Haversine distance in meters between two WGS84 coordinates. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** e.g. 120m, 450m, 1.2km */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—"
  if (meters < 1000) return `${Math.round(meters)}m`
  const km = meters / 1000
  return km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`
}

/** Rough walk time at ~4.5 km/h. */
export function estimateWalkMinutes(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return 0
  return Math.max(1, Math.round(meters / 75))
}

export const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
}
