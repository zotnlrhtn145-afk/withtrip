import { getCurrentUserId } from "@/lib/auth-session"
import { createClient } from "@/utils/supabase/client"
import { type NearbySpot } from "@/lib/spots-data"

type ProfileJoin = {
  nickname?: string | null
  avatar_url?: string | null
}

type SpotRow = {
  id: string
  name: string
  name_local?: string | null
  category?: string | null
  address?: string | null
  lat: number | string
  lng: number | string
  rating?: number | null
  image_url?: string | null
  user_id?: string | null
  profiles?: ProfileJoin | ProfileJoin[] | null
}

type SavedPlaceRow = {
  id: string
  trip_id?: string | null
  place_name?: string | null
  local_name?: string | null
  category?: string | null
  address?: string | null
  lat?: number | string | null
  lng?: number | string | null
  rating?: number | null
  image_url?: string | null
  user_id?: string | null
  profiles?: ProfileJoin | ProfileJoin[] | null
}

function unwrapProfile(
  profiles: ProfileJoin | ProfileJoin[] | null | undefined
): ProfileJoin | null {
  if (!profiles) return null
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export function mapSpotRowToNearbySpot(row: SpotRow): NearbySpot | null {
  const lat = toNumber(row.lat)
  const lng = toNumber(row.lng)
  if (lat == null || lng == null) return null

  const profile = unwrapProfile(row.profiles)
  const nickname = String(profile?.nickname ?? "").trim()
  const avatarUrl = String(profile?.avatar_url ?? "").trim()
  const image = String(row.image_url ?? "").trim() || "/images/place-sushi.png"
  const name = String(row.name ?? "").trim() || "이름 없는 장소"

  return {
    id: String(row.id),
    name,
    nameLocal: String(row.name_local ?? "").trim() || name,
    category: String(row.category ?? "").trim() || "스팟",
    address: String(row.address ?? "").trim() || "주소 미정",
    lat,
    lng,
    rating: typeof row.rating === "number" ? row.rating : 0,
    image,
    imageAlt: `${name} 사진`,
    userId: String(row.user_id ?? "").trim() || null,
    authorNickname: nickname || null,
    authorAvatarUrl: avatarUrl || null,
  }
}

const SPOT_SELECT = `
  id,
  name,
  name_local,
  category,
  address,
  lat,
  lng,
  rating,
  image_url,
  user_id,
  profiles:user_id (
    nickname,
    avatar_url
  )
`

const SAVED_PLACE_SELECT = `
  id,
  trip_id,
  place_name,
  local_name,
  category,
  address,
  lat,
  lng,
  rating,
  image_url,
  user_id,
  profiles:user_id (
    nickname,
    avatar_url
  )
`

export function mapSavedPlaceRowToNearbySpot(
  row: SavedPlaceRow,
  options?: { isInterest?: boolean }
): NearbySpot | null {
  const lat = toNumber(row.lat)
  const lng = toNumber(row.lng)
  if (lat == null || lng == null) return null

  const profile = unwrapProfile(row.profiles)
  const nickname = String(profile?.nickname ?? "").trim()
  const avatarUrl = String(profile?.avatar_url ?? "").trim()
  const image = String(row.image_url ?? "").trim() || "/images/place-sushi.png"
  const name = String(row.place_name ?? "").trim() || "이름 없는 장소"

  return {
    id: String(row.id),
    name,
    nameLocal: String(row.local_name ?? "").trim() || name,
    category: String(row.category ?? "").trim() || "스팟",
    address: String(row.address ?? "").trim() || "주소 미정",
    lat,
    lng,
    rating: typeof row.rating === "number" ? row.rating : 0,
    image,
    imageAlt: `${name} 사진`,
    userId: String(row.user_id ?? "").trim() || null,
    authorNickname: nickname || null,
    authorAvatarUrl: avatarUrl || null,
    isInterest: options?.isInterest ?? false,
  }
}

/**
 * Fetch nearby spots — every "가고 싶은 곳" (saved_places) with coordinates,
 * across all trips the current user participates in (owner or accepted member).
 * Legacy `spots` table rows (if any) are included too for backward compatibility.
 * Logged-out / empty → [] so the UI shows Empty State.
 */
export async function fetchNearbySpots(): Promise<NearbySpot[]> {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return []

    const client = createClient()

    // Get all trip IDs where user is owner or accepted member
    const [{ data: ownedTrips }, { data: memberTrips }] = await Promise.all([
      client.from("trips").select("id").eq("user_id", userId),
      client.from("trip_members").select("trip_id").eq("user_id", userId).eq("status", "accepted"),
    ])

    const tripIds = [
      ...new Set([
        ...(ownedTrips ?? []).map((t: { id: string }) => t.id),
        ...(memberTrips ?? []).map((t: { trip_id: string }) => t.trip_id),
      ]),
    ]

    const [savedPlacesResult, legacySpotsResult, interestPlacesResult] = await Promise.all([
      tripIds.length > 0
        ? client
            .from("saved_places")
            .select(SAVED_PLACE_SELECT)
            .in("trip_id", tripIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as SavedPlaceRow[], error: null }),
      tripIds.length > 0
        ? client
            .from("spots")
            .select(SPOT_SELECT)
            .or(`trip_id.in.(${tripIds.join(",")}),user_id.eq.${userId}`)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as SpotRow[], error: null }),
      // 여행에 속하지 않은 "나의 관심 맛집" — 지도에도 함께 표시 (테두리 색으로 구분).
      client
        .from("saved_places")
        .select(SAVED_PLACE_SELECT)
        .is("trip_id", null)
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ])

    if (savedPlacesResult.error) {
      console.warn("[fetchNearbySpots] saved_places:", savedPlacesResult.error.message)
    }
    if (legacySpotsResult.error) {
      console.warn("[fetchNearbySpots] spots:", legacySpotsResult.error.message)
    }
    if (interestPlacesResult.error) {
      console.warn("[fetchNearbySpots] interest saved_places:", interestPlacesResult.error.message)
    }

    const savedRows = (savedPlacesResult.data as SavedPlaceRow[] | null) ?? []
    const legacyRows = (legacySpotsResult.data as SpotRow[] | null) ?? []
    const interestRows = (interestPlacesResult.data as SavedPlaceRow[] | null) ?? []

    const fromSaved = savedRows
      .map((row) => mapSavedPlaceRowToNearbySpot(row))
      .filter((spot): spot is NearbySpot => Boolean(spot))
    const fromLegacy = legacyRows
      .map(mapSpotRowToNearbySpot)
      .filter((spot): spot is NearbySpot => Boolean(spot))
    const fromInterest = interestRows
      .map((row) => mapSavedPlaceRowToNearbySpot(row, { isInterest: true }))
      .filter((spot): spot is NearbySpot => Boolean(spot))

    return [...fromSaved, ...fromLegacy, ...fromInterest]
  } catch (err) {
    console.warn("[fetchNearbySpots] unexpected:", err)
    return []
  }
}
