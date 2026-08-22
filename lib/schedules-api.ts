import { getCurrentUserId } from "@/lib/auth-session"
import { dayDate } from "@/shared/trip-days"
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
  /** 이동수단/숙소에서 자동 생성된 일정의 원본 종류. 수동 일정은 "". */
  sourceType: string
  /** 원본(이동수단/숙소) row id. */
  sourceId: string
  /** 이 일정에 함께하는 멤버(탑승자/투숙객) user id 목록. */
  memberIds: string[]
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
  source_type?: string | null
  source_id?: string | null
  member_ids?: string[] | null
}

/** 자동 동기화(이동수단/숙소) 일정인지 — 수동 편집/삭제 잠금 판단에 사용. */
export function isAutoSchedule(schedule: Pick<TripSchedule, "sourceType">): boolean {
  return Boolean(String(schedule.sourceType ?? "").trim())
}

/** trip_schedules 조회/저장 시 사용하는 컬럼 목록. */
const SCHEDULE_SELECT =
  "id, trip_id, created_by, day_number, category, place_name, visit_time, address, phone_number, memo, source_type, source_id, member_ids, created_at, lat, lng"

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
  /*
    좌표. 장소 검색·찜에서 고른 경우 이미 손에 있는 값이라 그대로 넘긴다.
    ⚠️ 없으면 넣지 않는다 — 주소로 추측해서 채우면 엉뚱한 곳까지의 거리를
       그럴듯하게 보여 주게 된다.
  */
  lat?: number | null
  lng?: number | null
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
  /*
    ⚠️ 날짜 계산은 **공통 파일 하나**에서만 한다(`shared/trip-days.ts`).
       앱에도 같은 계산이 필요한데, 각자 하면 한쪽이 하루씩 밀려도
       한참 모른다(날짜만 있는 문자열을 그대로 Date 에 넣으면 UTC 자정으로
       읽혀 한국에서 하루 밀린다 — 실제로 밟기 쉬운 함정이다).
       **보여 주는 모양은 각자** 정한다 — 웹은 `08.27 목`, 앱은 `8/27 (목)`.
  */
  const date = dayDate(tripStartDate, day) ?? new Date(start.getFullYear(), start.getMonth(), start.getDate() + (day - 1))
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
    sourceType: String(row.source_type ?? "").trim(),
    sourceId: String(row.source_id ?? "").trim(),
    memberIds: Array.isArray(row.member_ids)
      ? row.member_ids.map((id) => String(id ?? "").trim()).filter(Boolean)
      : [],
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
  const tripId = String(input.tripId ?? "").trim()
  const placeName = String(input.placeName ?? "").trim()

  return {
    trip_id: tripId,
    day_number: clampDayNumber(input.dayNumber),
    category: normalizeCategory(input.category),
    place_name: placeName,
    visit_time: normalizeTime(input.visitTime ?? "") || null,
    address: String(input.address ?? "").trim() || null,
    phone_number: String(input.phoneNumber ?? "").trim() || null,
    memo: String(input.memo ?? "").trim() || null,
    /*
      ⚠️ 일정에 좌표를 같이 남긴다. 앱과 웹이 **같은 칸**을 채워야 한다 —
         한쪽만 채우면 그쪽에서 만든 일정만 거리가 나오고 다른 쪽은 빈다.
    */
    lat: Number.isFinite(Number(input.lat)) ? Number(input.lat) : null,
    lng: Number.isFinite(Number(input.lng)) ? Number(input.lng) : null,
    // Always send created_by (trip_schedules schema)
    created_by: authorUserId,
  }
}

function formatScheduleDbError(error: unknown): string {
  const message = getErrorMessage(error)
  const raw = [
    message,
    error && typeof error === "object"
      ? String((error as { details?: unknown }).details ?? "")
      : "",
    error && typeof error === "object"
      ? String((error as { hint?: unknown }).hint ?? "")
      : "",
    error && typeof error === "object"
      ? String((error as { code?: unknown }).code ?? "")
      : "",
  ]
    .join(" ")
    .toLowerCase()

  if (
    /schema cache|could not find.*created_by|pgrst204|column .*created_by.* does not exist/.test(
      raw
    )
  ) {
    return "일정 스키마가 아직 반영되지 않았어요. Supabase에서 trip_schedules.created_by 컬럼과 API 스키마 캐시를 확인해 주세요."
  }
  return message || "일정 저장에 실패했어요."
}

async function resolveAuthorUserId(explicit?: string | null): Promise<string | null> {
  const fromInput = String(explicit ?? "").trim()
  if (fromInput && isValidUuid(fromInput)) return fromInput

  try {
    const authId = await getCurrentUserId()
    if (authId && isValidUuid(authId)) return authId
  } catch (err) {
    console.warn("[resolveAuthorUserId] getCurrentUserId:", err)
  }

  return null
}

export async function fetchSchedulesByTripId(tripId: string): Promise<TripSchedule[]> {
  const id = String(tripId ?? "").trim()
  if (!id) return []

  try {
    const { data, error } = await supabase
      .from("trip_schedules")
      .select(SCHEDULE_SELECT
      )
      .eq("trip_id", id)
      .order("day_number", { ascending: true })
      .order("visit_time", { ascending: true })

    if (error) {
      // Fallback for older schema-cache snapshots without created_by in select list
      if (/created_by|schema cache|pgrst204/i.test(error.message ?? "")) {
        const fallback = await supabase
          .from("trip_schedules")
          .select("*")
          .eq("trip_id", id)
          .order("day_number", { ascending: true })
          .order("visit_time", { ascending: true })
        if (!fallback.error) {
          return sortSchedules(
            ((fallback.data as TripScheduleRow[] | null) ?? []).map(mapScheduleRow)
          )
        }
      }
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
  console.info("[insertSchedule] created_by:", payload.created_by)

  const { data, error } = await supabase
    .from("trip_schedules")
    .insert(payload)
    .select(SCHEDULE_SELECT
    )
    .single()

  if (error) {
    logSupabaseError("insertSchedule", error, { payload })
    throw new Error(formatScheduleDbError(error))
  }

  return mapScheduleRow(data as TripScheduleRow)
}

/** 호스트(방장) = trips.user_id. 방장은 작성자가 아니어도 수정·삭제할 수 있다. */
async function isTripHost(tripId: string, authUserId: string | null): Promise<boolean> {
  const uid = String(authUserId ?? "").trim()
  const tid = String(tripId ?? "").trim()
  if (!uid || !tid) return false
  const { data } = await supabase.from("trips").select("user_id").eq("id", tid).maybeSingle()
  return String((data as { user_id?: string | null } | null)?.user_id ?? "").trim() === uid
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
    .select("id, created_by, trip_id")
    .eq("id", id)
    .maybeSingle()

  if (lookupError) {
    logSupabaseError("updateSchedule lookup", lookupError, { schedule_id: id })
    throw new Error(formatScheduleDbError(lookupError))
  }
  if (!existing) throw new Error("일정을 찾을 수 없어요.")

  const authorId = String((existing as { created_by?: string | null }).created_by ?? "").trim()
  const authorFields = { createdBy: authorId, userId: authorId }
  const existingTripId = String((existing as { trip_id?: string | null }).trip_id ?? tripId).trim()
  // 작성자 또는 방장(호스트)만 수정 가능
  if (!isScheduleAuthor(authorFields, authUserId) && !(await isTripHost(existingTripId, authUserId))) {
    throw new Error("작성자 또는 방장만 일정을 수정할 수 있어요.")
  }

  // Keep original author; never blank created_by on update
  const payload = buildPayload({ ...input, tripId }, authorId || authUserId)
  console.info("[updateSchedule] created_by:", payload.created_by)

  const { data, error } = await supabase
    .from("trip_schedules")
    .update(payload)
    .eq("id", id)
    .select(SCHEDULE_SELECT
    )
    .single()

  if (error) {
    logSupabaseError("updateSchedule", error, { schedule_id: id, payload })
    throw new Error(formatScheduleDbError(error))
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
      .select("id, created_by, trip_id")
      .eq("id", id)
      .maybeSingle()

    if (lookupError) {
      logSupabaseError("deleteSchedule lookup", lookupError, { schedule_id: id })
      return false
    }
    if (!existing) return false

    const authorId = String((existing as { created_by?: string | null }).created_by ?? "").trim()
    const authorFields = { createdBy: authorId, userId: authorId }
    const existingTripId = String((existing as { trip_id?: string | null }).trip_id ?? "").trim()
    // 작성자 또는 방장(호스트)만 삭제 가능
    if (!isScheduleAuthor(authorFields, authUserId) && !(await isTripHost(existingTripId, authUserId))) {
      console.warn("[deleteSchedule] blocked: not author or host")
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

export { getErrorMessage, formatScheduleDbError as getScheduleErrorMessage }
