import { createClient } from "@/utils/supabase/client"
import { nearbySpots, type NearbySpot } from "@/lib/spots-data"

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

function unwrapProfile(
  profiles: ProfileJoin | ProfileJoin[] | null | undefined
): ProfileJoin | null {
  if (!profiles) return null
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles
}

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const n = Number(value)
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

/**
 * Fetch nearby spots with author profile (avatar_url, nickname) joined.
 * Falls back to local seed data when the table is missing / empty / errors.
 */
export async function fetchNearbySpots(): Promise<NearbySpot[]> {
  try {
    const client = createClient()
    const { data, error } = await client
      .from("spots")
      .select(SPOT_SELECT)
      .order("created_at", { ascending: false })

    if (error) {
      console.warn("[fetchNearbySpots]", error.message)
      return nearbySpots
    }

    const rows = (data as SpotRow[] | null) ?? []
    const mapped = rows
      .map(mapSpotRowToNearbySpot)
      .filter((spot): spot is NearbySpot => Boolean(spot))

    return mapped.length > 0 ? mapped : nearbySpots
  } catch (err) {
    console.warn("[fetchNearbySpots] unexpected:", err)
    return nearbySpots
  }
}
