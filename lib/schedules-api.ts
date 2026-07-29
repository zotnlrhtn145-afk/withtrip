import { getCurrentUserId } from "@/lib/auth-session"
import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/trips-api"

export const SCHEDULE_CATEGORIES = ["이동", "숙소", "관광", "식사", "카페"] as const
export type ScheduleCategory = (typeof SCHEDULE_CATEGORIES)[number]

export type TripSchedule = {
  id: string
  tripId: string
  userId: string
  createdBy: string
  dayNumber: number
  category: ScheduleCategory
  placeName: string
  visitTime: string
  address: string
  phoneNumber: string
  memo: string
  createdAt: string
}

export type TripScheduleRow = {
  id: string
  trip_id: string
  user_id?: string | null
  created_by?: string | null
  day_number?: number | null
  category?: string | null
  place_name?: string | null
  visit_time?: string | null
  address?: string | null
  phone_number?: string | null
  memo?: string | null
  created_at?: string | null
}

export type CreateTripScheduleInput = {
  tripId: string
  dayNumber: number
  category?: ScheduleCategory
  placeName: string
  visitTime?: string
  address?: string
  phoneNumber?: string
  memo?: string
  createdBy?: string | null
  userId?: string | null
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim()
  )
}

function normalizeTime(value: string) {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  const match = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return raw
  const h = Math.min(23, Math.max(0, Number(match[1])))
  const m = Math.min(59, Math.max(0, Number(match[2])))
  return `${`${h}`.padStart(2, "0")}:${`${m}`.padStart(2, "0")}`
}

function clampDayNumber(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.min(7, Math.max(1, Math.round(n)))
}

function normalizeCategory(value: unknown): ScheduleCategory {
  const raw = String(value ?? "").trim()
  if ((SCHEDULE_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as ScheduleCategory
  }
  return "관광"
}

/** Log Postgrest / Supabase errors with readable fields (avoids empty `{}`). */
function logSupabaseError(scope: string, error: unknown, extra?: Record<string, unknown>) {
  const err = error as {
    message?: unknown
    details?: unknown
    hint?: unknown
    code?: unknown
  } | null

  const message =
    (err && typeof err === "object" && err.message != null && String(err.message)) ||
    getErrorMessage(error) ||
    "(no message)"

  console.error(`[${scope}] error.message:`, message)
  if (err && typeof err === "object") {
    if (err.details != null) console.error(`[${scope}] error.details:`, err.details)
    if (err.hint != null) console.error(`[${scope}] error.hint:`, err.hint)
    if (err.code != null) console.error(`[${scope}] error.code:`, err.code)
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      console.error(`[${scope}] ${key}:`, value)
    }
  }
}

export function isScheduleAuthor(
  schedule: Pick<TripSchedule, "userId" | "createdBy">,
  authUserId: string | null | undefined
): boolean {
  const uid = String(authUserId ?? "").trim()
  if (!uid) return false
  return (
    (Boolean(schedule.createdBy) && schedule.createdBy === uid) ||
    (Boolean(schedule.userId) && schedule.userId === uid)
  )
}

export function parseScheduleStartDate(value: string): Date | null {
  const raw = String(value ?? "").trim()
  const match = raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** Day N meta from trip start date (1-based). */
export function getScheduleDayMeta(tripStartDate: string, dayNumber: number) {
  const start = parseScheduleStartDate(tripStartDate)
  const day = clampDayNumber(dayNumber)
  if (!start) {
    return { dayNumber: day, dateLabel: "", weekday: "", visitDate: "", subtitle: `Day ${day}` }
  }
  const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (day - 1))
  const dateLabel = `${`${date.getMonth() + 1}`.padStart(2, "0")}.${`${date.getDate()}`.padStart(2, "0")}`
  const weekday = WEEKDAYS[date.getDay()] ?? ""
  return {
    dayNumber: day,
    dateLabel,
    weekday,
    visitDate: dateLabel,
    subtitle: `Day ${day} · ${dateLabel} ${weekday}`,
  }
}

export function mapScheduleRow(row: TripScheduleRow): TripSchedule {
  const createdBy = String(row.created_by ?? "").trim()
  const userId = createdBy || String(row.user_id ?? "").trim()

  return {
    id: row.id,
    tripId: row.trip_id,
    userId,
    createdBy: createdBy || userId,
    dayNumber: clampDayNumber(row.day_number),
    category: normalizeCategory(row.category),
    placeName: String(row.place_name ?? "").trim(),
    visitTime: normalizeTime(row.visit_time ?? ""),
    address: String(row.address ?? "").trim(),
    phoneNumber: String(row.phone_number ?? "").trim(),
    memo: String(row.memo ?? "").trim(),
    createdAt: String(row.created_at ?? ""),
  }
}

export function sortSchedules(items: TripSchedule[]): TripSchedule[] {
  return [...items].sort((a, b) => {
    if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber
    const ta = a.visitTime || "99:99"
    const tb = b.visitTime || "99:99"
    if (ta !== tb) return ta.localeCompare(tb)
    return a.createdAt.localeCompare(b.createdAt)
  })
}

function buildPayload(input: CreateTripScheduleInput, authorUserId: string | null) {
  return {
    trip_id: String(input.tripId ?? "").trim(),
    day_number: clampDayNumber(input.dayNumber),
    category: normalizeCategory(input.category),
    place_name: String(input.placeName ?? "").trim(),
    visit_time: normalizeTime(input.visitTime ?? "") || null,
    address: String(input.address ?? "").trim() || null,
    phone_number: String(input.phoneNumber ?? "").trim() || null,
    memo: String(input.memo ?? "").trim() || null,
    created_by: authorUserId,
  }
}

async function resolveAuthorUserId(explicit?: string | null): Promise<string | null> {
  const fromInput = String(explicit ?? "").trim()
  if (fromInput && isValidUuid(fromInput)) return fromInput
  const authId = await getCurrentUserId()
  if (authId && isValidUuid(authId)) return authId
  return null
}

export async function fetchSchedulesByTripId(tripId: string): Promise<TripSchedule[]> {
  const id = String(tripId ?? "").trim()
  if (!id) return []

  try {
    const { data, error } = await supabase
      .from("trip_schedules")
      .select("*")
      .eq("trip_id", id)
      .order("day_number", { ascending: true })
      .order("visit_time", { ascending: true })

    if (error) {
      logSupabaseError("fetchSchedulesByTripId", error, { trip_id: id })
      return []
    }

    return sortSchedules(((data as TripScheduleRow[] | null) ?? []).map(mapScheduleRow))
  } catch (err) {
    logSupabaseError("fetchSchedulesByTripId", err, { trip_id: id, note: "unexpected" })
    return []
  }
}

export async function insertSchedule(input: CreateTripScheduleInput): Promise<TripSchedule> {
  const tripId = String(input.tripId ?? "").trim()
  if (!tripId) throw new Error("tripId가 필요합니다.")
  if (!String(input.placeName ?? "").trim()) throw new Error("장소명을 입력해 주세요.")

  const authorUserId = await resolveAuthorUserId(input.createdBy ?? input.userId)
  if (!authorUserId) {
    throw new Error("로그인이 필요해요. 로그인 후 일정을 등록해 주세요.")
  }

  const payload = buildPayload({ ...input, tripId }, authorUserId)
  const { data, error } = await supabase
    .from("trip_schedules")
    .insert(payload)
    .select("*")
    .single()

  if (error) {
    logSupabaseError("insertSchedule", error, { payload })
    throw error
  }

  return mapScheduleRow(data as TripScheduleRow)
}

export async function updateSchedule(
  scheduleId: string,
  input: CreateTripScheduleInput
): Promise<TripSchedule> {
  const id = String(scheduleId ?? "").trim()
  if (!id) throw new Error("scheduleId가 필요합니다.")

  const tripId = String(input.tripId ?? "").trim()
  if (!tripId) throw new Error("tripId가 필요합니다.")
  if (!String(input.placeName ?? "").trim()) throw new Error("장소명을 입력해 주세요.")

  const authUserId = await getCurrentUserId()
  const { data: existing, error: lookupError } = await supabase
    .from("trip_schedules")
    .select("id, created_by")
    .eq("id", id)
    .maybeSingle()

  if (lookupError) {
    logSupabaseError("updateSchedule lookup", lookupError, { schedule_id: id })
    throw lookupError
  }
  if (!existing) throw new Error("일정을 찾을 수 없어요.")

  const authorId = String((existing as { created_by?: string | null }).created_by ?? "").trim()
  const authorFields = { createdBy: authorId, userId: authorId }
  if (!isScheduleAuthor(authorFields, authUserId)) {
    throw new Error("작성자만 일정을 수정할 수 있어요.")
  }

  const payload = buildPayload({ ...input, tripId }, authorId || authUserId)

  const { data, error } = await supabase
    .from("trip_schedules")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    logSupabaseError("updateSchedule", error, { schedule_id: id, payload })
    throw error
  }

  return mapScheduleRow(data as TripScheduleRow)
}

export async function deleteSchedule(scheduleId: string): Promise<boolean> {
  const id = String(scheduleId ?? "").trim()
  if (!id) return false

  try {
    const authUserId = await getCurrentUserId()
    const { data: existing, error: lookupError } = await supabase
      .from("trip_schedules")
      .select("id, created_by")
      .eq("id", id)
      .maybeSingle()

    if (lookupError) {
      logSupabaseError("deleteSchedule lookup", lookupError, { schedule_id: id })
      return false
    }
    if (!existing) return false

    const authorId = String((existing as { created_by?: string | null }).created_by ?? "").trim()
    const authorFields = { createdBy: authorId, userId: authorId }
    if (!isScheduleAuthor(authorFields, authUserId)) {
      console.warn("[deleteSchedule] blocked: not schedule author")
      return false
    }

    const { error } = await supabase.from("trip_schedules").delete().eq("id", id)
    if (error) {
      logSupabaseError("deleteSchedule", error, { schedule_id: id })
      return false
    }
    return true
  } catch (err) {
    logSupabaseError("deleteSchedule", err, { schedule_id: id, note: "unexpected" })
    return false
  }
}

export { getErrorMessage }
