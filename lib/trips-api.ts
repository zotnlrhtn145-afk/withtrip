import { getCurrentUserId } from "@/lib/auth-session"
import { supabase, type TripRow } from "@/lib/supabase"
import { FALLBACK_TRIP_COVER, getCityImage, withUnsplashQuality } from "@/lib/getCityImage"
import { generateTripCoverImage } from "@/lib/trip-cover-ai"
import { type Trip } from "@/lib/trip-data"
import { fetchGroupMembersByTripIds } from "@/lib/trip-members-api"
import { createClient } from "@/utils/supabase/client"

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
  if (!Array.isArray(members)) return []
  const ids = members
    .map((item) => {
      if (typeof item === "string") return item
      if (item && typeof item === "object" && "id" in item) {
        return String((item as { id: string }).id)
      }
      return null
    })
    .filter((id): id is string => Boolean(id))
  return ids
}

async function fetchMemberTripIds(userId: string): Promise<string[]> {
  const client = createClient()
  // Prefer accepted memberships only (pending invites must not appear as joined trips)
  const accepted = await client
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", userId)
    .eq("status", "accepted")

  if (!accepted.error) {
    return [
      ...new Set(
        ((accepted.data as Array<{ trip_id?: string }> | null) ?? [])
          .map((row) => String(row.trip_id ?? "").trim())
          .filter(Boolean)
      ),
    ]
  }

  // Legacy DBs without status column — fall back to all memberships
  if (!/status|column .* does not exist/i.test(accepted.error.message ?? "")) {
    console.error("[fetchMemberTripIds]", accepted.error.message)
    return []
  }

  const { data, error } = await client
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", userId)

  if (error) {
    console.error("[fetchMemberTripIds] legacy:", error.message)
    return []
  }

  return [
    ...new Set(
      ((data as Array<{ trip_id?: string }> | null) ?? [])
        .map((row) => String(row.trip_id ?? "").trim())
        .filter(Boolean)
    ),
  ]
}

async function enrichTripsWithGroupMembers(trips: Trip[]): Promise<Trip[]> {
  if (trips.length === 0) return trips
  const byTrip = await fetchGroupMembersByTripIds(trips.map((trip) => trip.id))
  return trips.map((trip) => {
    const groupMembers = byTrip[trip.id] ?? []
    if (groupMembers.length === 0) return trip
    return {
      ...trip,
      groupMembers,
      memberIds: groupMembers.map((member) => member.userId || member.id),
    }
  })
}

function mergeTripsById(rows: TripRow[]): Trip[] {
  const map = new Map<string, Trip>()
  for (const row of rows) {
    const trip = mapTripRowToTrip(row)
    map.set(trip.id, trip)
  }
  return [...map.values()]
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
    ownerId: String(row.user_id ?? "").trim() || undefined,
    inviteCode: String(row.invite_code ?? "").trim() || undefined,
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
    isSettled: Boolean(row.is_settled),
    isCompleted: Boolean(row.is_settled),
    settledAt: row.settled_at ?? null,
    settlementStatus: row.is_settled ? "SETTLED" : "open",
  }
}

export async function fetchTripsFromSupabase(): Promise<Trip[]> {
  const userId = await getCurrentUserId()
  if (!userId) {
    // Not signed in — home shows empty state (no mock trips).
    return []
  }

  const client = createClient()
  /**
   * ⚠️ 단톡방(kind='chat')은 아직 여행이 아니다 — 여행 목록에 끼면 안 된다.
   *    앱에서 친구들과 먼저 모여 이야기하는 방으로, 여행이 정해지면 그때
   *    kind='trip' 이 되어 여기 나타난다. (대화 화면은 앱에만 있다)
   */
  const owned = await client
    .from("trips")
    .select("*")
    .eq("user_id", userId)
    .eq("kind", "trip")
    .order("created_at", { ascending: false })

  if (owned.error) {
    console.error("[fetchTripsFromSupabase] Supabase error:", owned.error)
    console.error("[fetchTripsFromSupabase] error.message:", owned.error.message)
    // Fail closed — never fall back to fetching every trip in the table.
    return []
  }

  const ownedRows = (owned.data as TripRow[] | null) ?? []

  // Also include trips where the user is an invited member.
  const memberTripIds = await fetchMemberTripIds(userId)
  const missingIds = memberTripIds.filter((id) => !ownedRows.some((row) => row.id === id))

  let memberRows: TripRow[] = []
  if (missingIds.length > 0) {
    const memberTrips = await client.from("trips").select("*").eq("kind", "trip").in("id", missingIds)
    if (memberTrips.error) {
      console.error("[fetchTripsFromSupabase] member trips:", memberTrips.error.message)
    } else {
      memberRows = (memberTrips.data as TripRow[] | null) ?? []
    }
  }

  const merged = mergeTripsById([...ownedRows, ...memberRows])
  merged.sort((a, b) => a.title.localeCompare(b.title, "ko"))

  return enrichTripsWithGroupMembers(merged)
}

export async function fetchTripById(id: string): Promise<Trip | null> {
  const tripId = String(id ?? "").trim()
  if (!tripId) return null

  const userId = await getCurrentUserId()
  if (!userId) return null

  const client = createClient()
  const { data, error } = await client.from("trips").select("*").eq("id", tripId).maybeSingle()

  if (error) {
    console.error("[fetchTripById] Supabase error:", error)
    console.error("[fetchTripById] error.message:", error.message)
    return null
  }
  if (!data) return null

  const row = data as TripRow
  const ownerId = String(row.user_id ?? "").trim()
  const isOwner = ownerId === userId
  if (!isOwner) {
    const memberIds = await fetchMemberTripIds(userId)
    if (!memberIds.includes(tripId)) return null
  }

  const [enriched] = await enrichTripsWithGroupMembers([mapTripRowToTrip(row)])
  return enriched ?? null
}

export async function insertTripToSupabase(input: CreateTripInput): Promise<Trip> {
  const title = String(input.title ?? "").trim()
  if (!title) {
    throw new Error("여행 제목은 필수입니다.")
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error("로그인이 필요해요. 로그인 후 여행을 만들어 주세요.")
  }

  const payload: Record<string, unknown> = {
    title,
    start_date: input.startDate,
    end_date: input.endDate,
    members: [],
    user_id: userId,
  }

  const location = buildTripLocation(input)
  // location is optional — only include when we have a meaningful value
  if (location) {
    payload.location = location
  }

  // Instant cinematic cover so trip creation never waits on AI generation.
  const coverInput = {
    city: input.city,
    country: input.country,
    location: location ?? input.location,
    title,
  }
  payload.cover_image = getCityImage(coverInput)

  const { data, error } = await supabase.from("trips").insert(payload).select("*").single()

  if (error) {
    console.error("[insertTripToSupabase] Supabase error:", error)
    console.error("[insertTripToSupabase] error.message:", error.message)
    console.error("[insertTripToSupabase] insert payload:", payload)
    throw error
  }

  // Upgrade to an AI-generated cinematic cover of the destination's most
  // iconic spot in the background — never blocks trip creation. On success,
  // the trip row is updated and a "cover ready" event lets the UI re-fetch.
  const insertedTripId = String((data as TripRow)?.id ?? "").trim()
  if (insertedTripId) {
    void upgradeTripCoverWithAI(insertedTripId, coverInput)
  }

  return mapTripRowToTrip(data as TripRow)
}

/**
 * Background upgrade — generates the AI cinematic cover and swaps it in once
 * ready. Never throws; failures just leave the instant fallback cover in place.
 */
async function upgradeTripCoverWithAI(
  tripId: string,
  coverInput: { city?: string; country?: string; location?: string; title: string }
): Promise<void> {
  try {
    const aiCover = await generateTripCoverImage(coverInput)
    if (!aiCover) return

    const { error } = await supabase
      .from("trips")
      .update({ cover_image: aiCover })
      .eq("id", tripId)

    if (error) {
      console.warn("[upgradeTripCoverWithAI] update failed:", error.message)
      return
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("withtrip:trip-cover-ready", { detail: { tripId } }))
    }
  } catch (err) {
    console.warn("[upgradeTripCoverWithAI] unexpected:", err)
  }
}

/**
 * 여행 정보(제목·목적지·기간) 수정 → Supabase `trips` 갱신.
 * 기존에는 updateTrip 이 로컬 상태만 바꿔 새로고침 시 원복되던 문제를 해결한다.
 * 소유자만 수정 가능(RLS) — 커버/이월 update 와 동일 정책.
 */
export async function updateTripInSupabase(
  tripId: string,
  input: {
    title: string
    country?: string | null
    region?: string | null
    startDate: string
    endDate: string
  }
): Promise<void> {
  const id = String(tripId ?? "").trim()
  if (!id) throw new Error("수정할 여행이 없어요.")
  const title = String(input.title ?? "").trim()
  if (!title) throw new Error("여행 제목은 필수입니다.")

  const payload: Record<string, unknown> = {
    title,
    start_date: input.startDate,
    end_date: input.endDate,
  }
  // location 은 "region · country" 형태로 저장(mapTripRowToTrip 의 파싱 규칙과 일치).
  const location = buildTripLocation({ city: input.region, country: input.country })
  if (location) payload.location = location

  const { error } = await supabase.from("trips").update(payload).eq("id", id)
  if (error) {
    console.error("[updateTripInSupabase] error:", error.message)
    throw error
  }
}

export async function deleteTripFromSupabase(tripId: string): Promise<void> {
  const id = String(tripId ?? "").trim()
  if (!id) throw new Error("삭제할 여행이 없어요.")

  const userId = await getCurrentUserId()
  if (!userId) throw new Error("로그인이 필요해요.")

  const client = createClient()

  const { data: row, error: lookupError } = await client
    .from("trips")
    .select("id, user_id, title")
    .eq("id", id)
    .maybeSingle()

  if (lookupError) {
    console.error(
      "[deleteTripFromSupabase] lookup:",
      lookupError.message || lookupError.details || lookupError
    )
    throw new Error(getErrorMessage(lookupError) || "여행을 찾지 못했어요.")
  }

  if (!row) throw new Error("여행을 찾을 수 없어요.")

  const ownerId = String((row as { user_id?: string | null }).user_id ?? "").trim()
  if (ownerId && ownerId !== userId) {
    throw new Error("본인이 만든 여행만 삭제할 수 있어요.")
  }

  const { error } = await client.from("trips").delete().eq("id", id).eq("user_id", userId)

  if (error) {
    console.error(
      "[deleteTripFromSupabase]",
      error.message || error.details || error
    )
    throw new Error(getErrorMessage(error) || "여행 삭제에 실패했어요.")
  }
}

export function toIsoDate(date: Date) {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, "0")
  const d = `${date.getDate()}`.padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function getErrorMessage(err: unknown) {
  if (err == null) return "알 수 없는 오류"

  if (typeof err === "string") {
    const trimmed = err.trim()
    return trimmed || "알 수 없는 오류"
  }

  if (err instanceof Error && err.message) {
    return err.message
  }

  if (typeof err === "object") {
    const row = err as {
      message?: unknown
      details?: unknown
      hint?: unknown
      code?: unknown
      error_description?: unknown
    }
    const parts = [row.message, row.details, row.hint, row.error_description, row.code]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
    if (parts.length > 0) return parts.join(" | ")
  }

  try {
    const json = JSON.stringify(err)
    if (json && json !== "{}" && json !== "null") return json
  } catch {
    // ignore
  }

  return "알 수 없는 오류"
}

