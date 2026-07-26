import { supabase, type TripRow } from "@/lib/supabase"
import { FALLBACK_TRIP_COVER, getCityImage, withUnsplashQuality } from "@/lib/getCityImage"
import { type Trip } from "@/lib/trip-data"

const DAY_MS = 24 * 60 * 60 * 1000

export type CreateTripInput = {
  title: string
  /** Optional free-form location. Prefer country + city when available. */
  location?: string
  country?: string
  city?: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDisplayDate(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${date.getFullYear()}.${month}.${day}`
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function memberIdsFromRow(members: unknown): string[] {
  if (!Array.isArray(members)) return ["m1"]
  const ids = members
    .map((item) => {
      if (typeof item === "string") return item
      if (item && typeof item === "object" && "id" in item) {
        return String((item as { id: string }).id)
      }
      return null
    })
    .filter((id): id is string => Boolean(id))
  return ids.length > 0 ? ids : ["m1"]
}

/** Combine country + city into a single location string, or omit when empty. */
export function buildTripLocation(input: {
  location?: string | null
  country?: string | null
  city?: string | null
}): string | undefined {
  const explicit = String(input.location ?? "").trim()
  if (explicit) return explicit

  const city = String(input.city ?? "").trim()
  const country = String(input.country ?? "").trim()

  if (city && country) return `${city} · ${country}`
  if (city) return city
  if (country) return country
  return undefined
}

export function mapTripRowToTrip(row: TripRow): Trip {
  const start = parseIsoDate(row.start_date) ?? startOfDay(new Date())
  const end = parseIsoDate(row.end_date) ?? start
  const nights = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS))
  const dDay = Math.max(
    0,
    Math.round((start.getTime() - startOfDay(new Date()).getTime()) / DAY_MS)
  )
  const location = row.location?.trim() || "미정"
  // Stored as "city · country" from buildTripLocation
  const parts = location
    .split(/[·,\/]/)
    .map((part) => part.trim())
    .filter(Boolean)
  const city = parts[0] || location
  const countryLabel = parts.length > 1 ? parts.slice(1).join(" · ") : parts[0] || "미정"
  // Prefer persisted cover from create flow; otherwise resolve dynamically.
  const stored = String(row.cover_image ?? "").trim()
  const cover =
    stored.startsWith("http")
      ? withUnsplashQuality(stored)
      : getCityImage({
          city,
          country: countryLabel,
          location,
          title: row.title,
        }) || FALLBACK_TRIP_COVER

  return {
    id: row.id,
    title: row.title,
    country: countryLabel || "미정",
    region: city || location,
    startDate: formatDisplayDate(start),
    endDate: formatDisplayDate(end),
    nights,
    days: nights + 1,
    dDay,
    heroImage: cover,
    heroImageAlt: `${row.title} 여행 커버`,
    weather: "예보 준비 중",
    weatherIcon: "cloud-sun",
    flight: row.flight_info?.trim() || "항공편 미정",
    memberIds: memberIdsFromRow(row.members),
    readiness: 5,
  }
}

export async function fetchTripsFromSupabase(): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[fetchTripsFromSupabase] Supabase error:", error)
    console.error("[fetchTripsFromSupabase] error.message:", error.message)
    throw error
  }
  return (data as TripRow[] | null)?.map(mapTripRowToTrip) ?? []
}

export async function fetchTripById(id: string): Promise<Trip | null> {
  const tripId = String(id ?? "").trim()
  if (!tripId) return null

  const { data, error } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle()

  if (error) {
    console.error("[fetchTripById] Supabase error:", error)
    console.error("[fetchTripById] error.message:", error.message)
    throw error
  }
  if (!data) return null
  return mapTripRowToTrip(data as TripRow)
}

export async function insertTripToSupabase(input: CreateTripInput): Promise<Trip> {
  const title = String(input.title ?? "").trim()
  if (!title) {
    throw new Error("여행 제목은 필수입니다.")
  }

  const payload: Record<string, unknown> = {
    title,
    start_date: input.startDate,
    end_date: input.endDate,
    members: [],
  }

  const location = buildTripLocation(input)
  // location is optional — only include when we have a meaningful value
  if (location) {
    payload.location = location
  }

  // All-weather cinematic cover → persisted on trips.cover_image
  payload.cover_image = getCityImage({
    city: input.city,
    country: input.country,
    location: location ?? input.location,
    title,
  })

  const { data, error } = await supabase.from("trips").insert(payload).select("*").single()

  if (error) {
    console.error("[insertTripToSupabase] Supabase error:", error)
    console.error("[insertTripToSupabase] error.message:", error.message)
    console.error("[insertTripToSupabase] insert payload:", payload)
    throw error
  }

  return mapTripRowToTrip(data as TripRow)
}

export function toIsoDate(date: Date) {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, "0")
  const d = `${date.getDate()}`.padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function getErrorMessage(err: unknown) {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message ?? "알 수 없는 오류")
  }
  if (err instanceof Error) return err.message
  return "알 수 없는 오류"
}
