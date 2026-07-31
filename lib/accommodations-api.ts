import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/trips-api"

export type Accommodation = {
  id: string
  tripId: string
  name: string
  address: string
  checkInDate: string
  checkInTime: string
  checkOutDate: string
  checkOutTime: string
  phoneNumber: string
  memo: string
  createdAt: string
  createdBy: string
  guestIds: string[]
  lat: number | null
  lng: number | null
}

export type AccommodationRow = {
  id: string
  trip_id: string
  name?: string | null
  address?: string | null
  check_in_date?: string | null
  check_in_time?: string | null
  check_out_date?: string | null
  check_out_time?: string | null
  phone_number?: string | null
  /** @deprecated legacy column — read fallback only */
  booking_code?: string | null
  memo?: string | null
  created_at?: string | null
  created_by?: string | null
  guest_ids?: string[] | null
  lat?: number | null
  lng?: number | null
}

export type CreateAccommodationInput = {
  tripId: string
  name: string
  address?: string
  checkInDate: string
  checkInTime?: string
  checkOutDate: string
  checkOutTime?: string
  phoneNumber?: string
  memo?: string
  createdBy?: string | null
  guestIds?: string[]
  lat?: number | null
  lng?: number | null
}

const DAY_MS = 24 * 60 * 60 * 1000

function normalizeTime(value: string) {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  const match = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return raw
  const h = Math.min(23, Math.max(0, Number(match[1])))
  const m = Math.min(59, Math.max(0, Number(match[2])))
  return `${`${h}`.padStart(2, "0")}:${`${m}`.padStart(2, "0")}`
}

function normalizeDate(value: string) {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  const dotted = raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/)
  if (!dotted) return raw
  const y = dotted[1]
  const m = `${Number(dotted[2])}`.padStart(2, "0")
  const d = `${Number(dotted[3])}`.padStart(2, "0")
  return `${y}-${m}-${d}`
}

function parseIsoDate(value: string): Date | null {
  const iso = normalizeDate(value)
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** e.g. "3박 4일" from check-in / check-out dates */
export function formatStayDuration(checkInDate: string, checkOutDate: string): string {
  const start = parseIsoDate(checkInDate)
  const end = parseIsoDate(checkOutDate)
  if (!start || !end) return ""
  const nights = Math.round((end.getTime() - start.getTime()) / DAY_MS)
  if (!Number.isFinite(nights) || nights < 0) return ""
  if (nights === 0) return "당일"
  return `${nights}박 ${nights + 1}일`
}

export function isCheckoutBeforeCheckin(checkInDate: string, checkOutDate: string): boolean {
  const start = parseIsoDate(checkInDate)
  const end = parseIsoDate(checkOutDate)
  if (!start || !end) return false
  return end.getTime() < start.getTime()
}

export function mapAccommodationRow(row: AccommodationRow): Accommodation {
  return {
    id: row.id,
    tripId: row.trip_id,
    name: String(row.name ?? "").trim(),
    address: String(row.address ?? "").trim(),
    checkInDate: normalizeDate(row.check_in_date ?? ""),
    checkInTime: normalizeTime(row.check_in_time ?? ""),
    checkOutDate: normalizeDate(row.check_out_date ?? ""),
    checkOutTime: normalizeTime(row.check_out_time ?? ""),
    phoneNumber: String(row.phone_number ?? row.booking_code ?? "").trim(),
    memo: String(row.memo ?? "").trim(),
    createdAt: String(row.created_at ?? ""),
    createdBy: String(row.created_by ?? "").trim(),
    guestIds: Array.isArray(row.guest_ids) ? row.guest_ids.filter(Boolean) : [],
    lat: typeof row.lat === "number" ? row.lat : null,
    lng: typeof row.lng === "number" ? row.lng : null,
  }
}

export function isAccommodationAuthor(
  item: Pick<Accommodation, "createdBy">,
  authUserId: string | null | undefined
): boolean {
  const uid = String(authUserId ?? "").trim()
  if (!uid) return false
  return Boolean(item.createdBy) && item.createdBy === uid
}

function buildPayload(input: CreateAccommodationInput) {
  const tripId = String(input.tripId ?? "").trim()
  return {
    trip_id: tripId,
    name: String(input.name ?? "").trim(),
    address: String(input.address ?? "").trim() || null,
    check_in_date: normalizeDate(input.checkInDate) || null,
    check_in_time: normalizeTime(input.checkInTime ?? "") || null,
    check_out_date: normalizeDate(input.checkOutDate) || null,
    check_out_time: normalizeTime(input.checkOutTime ?? "") || null,
    phone_number: String(input.phoneNumber ?? "").trim() || null,
    memo: String(input.memo ?? "").trim() || null,
    created_by: input.createdBy ?? null,
    guest_ids: Array.isArray(input.guestIds) ? input.guestIds.filter(Boolean) : [],
    lat: typeof input.lat === "number" ? input.lat : null,
    lng: typeof input.lng === "number" ? input.lng : null,
  }
}

export async function fetchAccommodationsByTripId(tripId: string): Promise<Accommodation[]> {
  const id = String(tripId ?? "").trim()
  if (!id) return []

  try {
    const { data, error } = await supabase
      .from("trip_accommodations")
      .select("*")
      .eq("trip_id", id)
      .order("check_in_date", { ascending: true })

    if (error) {
      console.error("[fetchAccommodationsByTripId] Supabase error:", error)
      console.error("[fetchAccommodationsByTripId] error.message:", error.message)
      return []
    }

    return ((data as AccommodationRow[] | null) ?? []).map(mapAccommodationRow)
  } catch (err) {
    console.error("[fetchAccommodationsByTripId] unexpected error:", err)
    return []
  }
}

export async function insertAccommodation(
  input: CreateAccommodationInput
): Promise<Accommodation> {
  const tripId = String(input.tripId ?? "").trim()
  if (!tripId) throw new Error("tripId가 필요합니다.")
  if (!String(input.name ?? "").trim()) throw new Error("숙소 이름이 필요합니다.")

  const payload = buildPayload({ ...input, tripId })
  const { data, error } = await supabase
    .from("trip_accommodations")
    .insert(payload)
    .select("*")
    .single()

  if (error) {
    console.error("[insertAccommodation] Supabase error:", error)
    console.error("[insertAccommodation] error.message:", error.message)
    console.error("[insertAccommodation] payload:", payload)
    throw error
  }

  return mapAccommodationRow(data as AccommodationRow)
}

export async function updateAccommodation(
  accommodationId: string,
  input: CreateAccommodationInput
): Promise<Accommodation> {
  const id = String(accommodationId ?? "").trim()
  if (!id) throw new Error("accommodationId가 필요합니다.")

  const tripId = String(input.tripId ?? "").trim()
  if (!tripId) throw new Error("tripId가 필요합니다.")
  if (!String(input.name ?? "").trim()) throw new Error("숙소 이름이 필요합니다.")

  const payload = buildPayload({ ...input, tripId })
  const { data, error } = await supabase
    .from("trip_accommodations")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    console.error("[updateAccommodation] Supabase error:", error)
    console.error("[updateAccommodation] error.message:", error.message)
    console.error("[updateAccommodation] payload:", payload)
    throw error
  }

  return mapAccommodationRow(data as AccommodationRow)
}

export async function deleteAccommodation(accommodationId: string): Promise<boolean> {
  const id = String(accommodationId ?? "").trim()
  if (!id) return false

  try {
    const { error } = await supabase.from("trip_accommodations").delete().eq("id", id)
    if (error) {
      console.error("[deleteAccommodation] Supabase error:", error)
      console.error("[deleteAccommodation] error.message:", error.message)
      return false
    }
    return true
  } catch (err) {
    console.error("[deleteAccommodation] unexpected error:", err)
    return false
  }
}

export { getErrorMessage }
