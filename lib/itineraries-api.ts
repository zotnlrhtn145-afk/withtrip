import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/trips-api"

export const ITINERARY_CATEGORIES = ["이동", "식사", "관광", "숙소", "카페"] as const

export type ItineraryCategory = (typeof ITINERARY_CATEGORIES)[number]

export type ItineraryItem = {
  id: string
  tripId: string
  dayIndex: number
  time: string
  title: string
  category: ItineraryCategory
  memo: string
  estimatedCost: number
  imageUrl: string | null
  createdAt: string
}

export type ItineraryRow = {
  id: string
  trip_id: string
  /** Canonical day column */
  day_index?: number | null
  /** Legacy alias — read-only fallback when day_index is missing */
  day_number?: number | null
  time: string
  title: string
  category: string
  memo: string | null
  estimated_cost?: number | string | null
  /** Legacy alias for estimated_cost */
  cost?: number | string | null
  image_url: string | null
  created_at: string
}

export type CreateItineraryInput = {
  tripId: string
  dayIndex: number
  time: string
  title: string
  category: ItineraryCategory
  memo?: string
  estimatedCost?: number | null
  imageUrl?: string | null
}

function normalizeCategory(value: string): ItineraryCategory {
  const raw = String(value ?? "").trim()
  if (raw === "식당") return "식사"
  if ((ITINERARY_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as ItineraryCategory
  }
  return "관광"
}

function normalizeTime(value: string): string {
  const raw = String(value ?? "").trim()
  const match = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return "09:00"
  const h = Math.min(23, Math.max(0, Number(match[1])))
  const m = Math.min(59, Math.max(0, Number(match[2])))
  return `${`${h}`.padStart(2, "0")}:${`${m}`.padStart(2, "0")}`
}

/** Prefer day_index; fall back to legacy day_number; default 1. */
function resolveDayIndex(row: { day_index?: unknown; day_number?: unknown }): number {
  const raw = row.day_index ?? row.day_number ?? 1
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.round(n)
}

/** Prefer estimated_cost; fall back to legacy cost; default 0. */
function resolveEstimatedCost(row: {
  estimated_cost?: unknown
  cost?: unknown
}): number {
  const raw = row.estimated_cost ?? row.cost ?? 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function mapItineraryRow(row: ItineraryRow): ItineraryItem {
  return {
    id: row.id,
    tripId: row.trip_id,
    dayIndex: resolveDayIndex(row),
    time: normalizeTime(row.time),
    title: String(row.title ?? "").trim() || "일정",
    category: normalizeCategory(row.category),
    memo: String(row.memo ?? "").trim(),
    estimatedCost: resolveEstimatedCost(row),
    imageUrl: row.image_url?.trim() || null,
    createdAt: row.created_at,
  }
}

/** Sort by day then clock time. */
export function sortItineraryItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex
    return a.time.localeCompare(b.time)
  })
}

/** Display "10:00 AM" from "10:00" / "14:30". */
export function formatItineraryTime(time: string): string {
  const [hRaw, mRaw] = normalizeTime(time).split(":").map(Number)
  const hour24 = hRaw ?? 0
  const minute = mRaw ?? 0
  const period = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${hour12}:${`${minute}`.padStart(2, "0")} ${period}`
}

export function formatWon(amount: number | null | undefined): string | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) {
    return null
  }
  return `${Math.round(amount).toLocaleString("ko-KR")}원`
}

export async function fetchItinerariesByTripId(tripId: string): Promise<ItineraryItem[]> {
  const id = String(tripId ?? "").trim()
  if (!id) return []

  try {
    const { data, error } = await supabase
      .from("trip_itineraries")
      .select("*")
      .eq("trip_id", id)
      .order("day_index", { ascending: true })
      .order("time", { ascending: true })

    if (error) {
      console.error("[fetchItinerariesByTripId] Supabase error:", error)
      console.error("[fetchItinerariesByTripId] error.message:", error.message)
      return []
    }

    return sortItineraryItems((data as ItineraryRow[] | null)?.map(mapItineraryRow) ?? [])
  } catch (err) {
    console.error("[fetchItinerariesByTripId] unexpected error:", err)
    return []
  }
}

export async function insertItinerary(input: CreateItineraryInput): Promise<ItineraryItem> {
  const title = String(input.title ?? "").trim()
  if (!title) throw new Error("장소/일정명은 필수입니다.")
  if (!input.tripId) throw new Error("tripId가 필요합니다.")

  // Persist only the canonical column name `day_index`
  const payload = {
    trip_id: input.tripId,
    day_index: resolveDayIndex({ day_index: input.dayIndex }),
    time: normalizeTime(input.time),
    title,
    category: normalizeCategory(input.category),
    memo: String(input.memo ?? "").trim() || null,
    estimated_cost:
      input.estimatedCost === null ||
      input.estimatedCost === undefined ||
      Number.isNaN(Number(input.estimatedCost))
        ? null
        : Number(input.estimatedCost),
    image_url: input.imageUrl?.trim() || null,
  }

  const { data, error } = await supabase.from("trip_itineraries").insert(payload).select("*").single()

  if (error) {
    console.error("[insertItinerary] Supabase error:", error)
    console.error("[insertItinerary] error.message:", error.message)
    console.error("[insertItinerary] payload:", payload)
    throw error
  }

  return mapItineraryRow(data as ItineraryRow)
}

export { getErrorMessage }
