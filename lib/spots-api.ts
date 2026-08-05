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
  options?: { isInterest?: boolean; tripTitle?: string | null }
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
    tripId: (row.trip_id as string | null) ?? null,
    tripTitle: options?.tripTitle ?? null,
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
      client.from("trips").select("id, title").eq("user_id", userId),
      client.from("trip_members").select("trip_id").eq("user_id", userId).eq("status", "accepted"),
    ])

    const tripIds = [
      ...new Set([
        ...(ownedTrips ?? []).map((t: { id: string }) => t.id),
        ...(memberTrips ?? []).map((t: { trip_id: string }) => t.trip_id),
      ]),
    ]

    // 여행 제목 맵 (주변스팟을 여행클립별로 묶어 보여주기 위함).
    const titleById = new Map<string, string>()
    for (const t of (ownedTrips ?? []) as { id: string; title?: string | null }[]) {
      if (t.title) titleById.set(t.id, t.title)
    }
    const missingTitleIds = tripIds.filter((id) => !titleById.has(id))
    if (missingTitleIds.length > 0) {
      const { data: moreTrips } = await client.from("trips").select("id, title").in("id", missingTitleIds)
      for (const t of (moreTrips ?? []) as { id: string; title?: string | null }[]) {
        if (t.title) titleById.set(t.id, t.title)
      }
    }

    // 주변스팟 = 여행클립에 등록된 "가고 싶은 곳"만 (관심 맛집은 제외 — 앱과 동일).
    const [savedPlacesResult, legacySpotsResult] = await Promise.all([
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
    ])

    if (savedPlacesResult.error) {
      console.warn("[fetchNearbySpots] saved_places:", savedPlacesResult.error.message)
    }
    if (legacySpotsResult.error) {
      console.warn("[fetchNearbySpots] spots:", legacySpotsResult.error.message)
    }

    const savedRows = (savedPlacesResult.data as SavedPlaceRow[] | null) ?? []
    const legacyRows = (legacySpotsResult.data as SpotRow[] | null) ?? []

    const fromSaved = savedRows
      .map((row) => mapSavedPlaceRowToNearbySpot(row, { tripTitle: row.trip_id ? titleById.get(row.trip_id) ?? null : null }))
      .filter((spot): spot is NearbySpot => Boolean(spot))
    const fromLegacy = legacyRows
      .map(mapSpotRowToNearbySpot)
      .filter((spot): spot is NearbySpot => Boolean(spot))

    return [...fromSaved, ...fromLegacy]
  } catch (err) {
    console.warn("[fetchNearbySpots] unexpected:", err)
    return []
  }
}
