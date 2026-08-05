export type NearbySpot = {
  id: string
  name: string
  nameLocal: string
  category: string
  address: string
  lat: number
  lng: number
  rating: number
  image: string
  imageAlt: string
  /** Author (profiles) — null when seed / anonymous. */
  userId?: string | null
  authorNickname?: string | null
  authorAvatarUrl?: string | null
  /** Trip-less "나의 관심 맛집" — marker gets a distinct border color on the map. */
  isInterest?: boolean
  /** 여행클립(trip) — 주변스팟을 여행별로 묶기 위한 값. */
  tripId?: string | null
  tripTitle?: string | null
}

/** Fallback when `avatar_url` is missing. */
export const DEFAULT_SPOT_AVATAR = "/placeholder-logo.svg"

/** Fallback “my location” pin (Osaka Umeda). Prefer live GPS via `useGeolocation`. */
export const currentLocation = {
  lat: 34.702485,
  lng: 135.495951,
  label: "현재 위치",
}

/** No local seed places — spots come only from the signed-in user's rows. */
export const nearbySpots: NearbySpot[] = []
