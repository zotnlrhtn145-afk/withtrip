import { getCurrentUserId } from "@/lib/auth-session"
import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/trips-api"

export type FlightType = "OUTBOUND" | "RETURN" | "LAYOVER"

export type TripFlight = {
  id: string
  tripId: string
  userId: string
  createdBy: string
  passengerIds: string[]
  airlineName: string
  flightNo: string
  fromCode: string
  toCode: string
  departTime: string
  arriveTime: string
  duration: string
  departDate: string
  arriveDate: string
  flightType: FlightType
  segmentOrder: number
  createdAt: string
}

export type TripFlightRow = {
  id: string
  trip_id: string
  user_id?: string | null
  created_by?: string | null
  passenger_ids?: string[] | null
  passengers?: string[] | null
  airline_name?: string | null
  airline?: string | null
  flight_no?: string | null
  flight_number?: string | null
  from_code?: string | null
  to_code?: string | null
  departure_airport?: string | null
  arrival_airport?: string | null
  depart_time?: string | null
  /** Legacy alias for depart_time */
  departure_time?: string | null
  arrive_time?: string | null
  /** Legacy alias for arrive_time */
  arrival_time?: string | null
  duration?: string | null
  duration_label?: string | null
  depart_date?: string | null
  arrive_date?: string | null
  flight_type?: string | null
  segment_order?: number | null
  created_at?: string | null
}

export type CreateTripFlightInput = {
  tripId: string
  airlineName: string
  flightNo: string
  fromCode: string
  toCode: string
  departTime: string
  arriveTime: string
  duration?: string
  departDate?: string
  arriveDate?: string
  flightType?: FlightType
  segmentOrder?: number
  userId?: string | null
  createdBy?: string | null
  passengerIds?: string[] | null
}

const FLIGHT_TYPE_RANK: Record<FlightType, number> = {
  OUTBOUND: 0,
  LAYOVER: 1,
  RETURN: 2,
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim()
  )
}

function normalizeCode(value: string) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 3)
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

function normalizeFlightType(value: unknown): FlightType {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase()
  if (raw === "RETURN" || raw === "LAYOVER" || raw === "OUTBOUND") return raw
  return "OUTBOUND"
}

export function normalizePassengerIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    const id = String(item ?? "").trim()
    if (!id || !isValidUuid(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** True only when auth user id matches a non-empty flight author field. */
export function isFlightAuthor(
  flight: Pick<TripFlight, "userId" | "createdBy">,
  authUserId: string | null | undefined
): boolean {
  const uid = String(authUserId ?? "").trim()
  if (!uid) return false
  return (
    (Boolean(flight.userId) && flight.userId === uid) ||
    (Boolean(flight.createdBy) && flight.createdBy === uid)
  )
}

/** Derive "1시간 55분" from clock times when duration is empty. */
export function computeDurationLabel(departTime: string, arriveTime: string): string {
  if (!departTime || !arriveTime) return ""
  const [dh, dm] = normalizeTime(departTime).split(":").map(Number)
  const [ah, am] = normalizeTime(arriveTime).split(":").map(Number)
  let minutes = ah * 60 + am - (dh * 60 + dm)
  if (!Number.isFinite(minutes)) return ""
  if (minutes < 0) minutes += 24 * 60
  if (minutes <= 0) return ""
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours <= 0) return `${rest}분`
  if (rest <= 0) return `${hours}시간`
  return `${hours}시간 ${rest}분`
}

export function sortTripFlights(flights: TripFlight[]): TripFlight[] {
  return [...flights].sort((a, b) => {
    const rankDiff = FLIGHT_TYPE_RANK[a.flightType] - FLIGHT_TYPE_RANK[b.flightType]
    if (rankDiff !== 0) return rankDiff
    return a.segmentOrder - b.segmentOrder
  })
}

export function mapFlightRow(row: TripFlightRow): TripFlight {
  const departTime = normalizeTime(row.depart_time ?? row.departure_time ?? "")
  const arriveTime = normalizeTime(row.arrive_time ?? row.arrival_time ?? "")
  const storedDuration = String(row.duration ?? row.duration_label ?? "").trim()
  const segmentOrder = Number(row.segment_order)
  const createdBy = String(row.created_by ?? "").trim()
  // Prefer created_by (current schema); fall back to legacy user_id if present.
  const userId = createdBy || String(row.user_id ?? "").trim()

  return {
    id: row.id,
    tripId: row.trip_id,
    userId,
    createdBy: createdBy || userId,
    passengerIds: normalizePassengerIds(row.passenger_ids ?? row.passengers),
    airlineName: String(row.airline_name ?? row.airline ?? "").trim(),
    flightNo: String(row.flight_no ?? row.flight_number ?? "").trim().toUpperCase(),
    fromCode: normalizeCode(row.from_code ?? row.departure_airport ?? ""),
    toCode: normalizeCode(row.to_code ?? row.arrival_airport ?? ""),
    departTime,
    arriveTime,
    duration: storedDuration || computeDurationLabel(departTime, arriveTime),
    departDate: String(row.depart_date ?? "").trim(),
    arriveDate: String(row.arrive_date ?? "").trim(),
    flightType: normalizeFlightType(row.flight_type),
    segmentOrder: Number.isFinite(segmentOrder) && segmentOrder > 0 ? segmentOrder : 1,
    createdAt: String(row.created_at ?? ""),
  }
}

function buildInsertPayload(
  input: CreateTripFlightInput,
  segmentOrder: number,
  authorUserId: string | null,
  passengerIds: string[]
) {
  const tripId = String(input.tripId ?? "").trim()
  const airlineValue = String(input.airlineName ?? "").trim()
  const flightNoValue = String(input.flightNo ?? "").trim().toUpperCase()
  const departureAirportValue = normalizeCode(input.fromCode)
  const arrivalAirportValue = normalizeCode(input.toCode)
  const departTimeValue = normalizeTime(input.departTime) || "09:00"
  const arriveTimeValue = normalizeTime(input.arriveTime) || "11:00"
  const durationValue =
    String(input.duration ?? "").trim() ||
    computeDurationLabel(departTimeValue, arriveTimeValue)
  const flightType = normalizeFlightType(input.flightType ?? "OUTBOUND")

  // Schema: created_by (author) + passenger_ids (uuid[])
  return {
    trip_id: tripId,
    airline: airlineValue,
    airline_name: airlineValue,
    flight_number: flightNoValue || null,
    flight_no: flightNoValue || null,
    departure_airport: departureAirportValue,
    arrival_airport: arrivalAirportValue,
    depart_time: departTimeValue,
    departure_time: departTimeValue,
    arrive_time: arriveTimeValue,
    arrival_time: arriveTimeValue,
    duration: durationValue || null,
    flight_type: flightType,
    segment_order: segmentOrder,
    created_by: authorUserId,
    passenger_ids: passengerIds,
  }
}

function formatFlightDbError(error: unknown): string {
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
    /schema cache|could not find.*(created_by|passenger_ids|user_id)|pgrst204|column .* does not exist/.test(
      raw
    )
  ) {
    return "항공권 스키마가 아직 반영되지 않았어요. Supabase에서 created_by·passenger_ids 컬럼과 API 스키마 캐시를 확인해 주세요."
  }
  return message || "항공권 저장에 실패했어요."
}

async function resolveAuthorUserId(explicit?: string | null): Promise<string | null> {
  const fromInput = String(explicit ?? "").trim()
  if (fromInput && isValidUuid(fromInput)) return fromInput
  const authId = await getCurrentUserId()
  if (authId && isValidUuid(authId)) return authId
  return null
}

export async function fetchFlightsByTripId(tripId: string): Promise<TripFlight[]> {
  const id = String(tripId ?? "").trim()
  if (!id) return []

  try {
    const { data, error } = await supabase
      .from("trip_flights")
      .select("*")
      .eq("trip_id", id)
      .order("flight_type", { ascending: true })
      .order("segment_order", { ascending: true })

    if (error) {
      console.error("[fetchFlightsByTripId] Supabase error:", error)
      console.error("[fetchFlightsByTripId] error.message:", error.message)
      return []
    }

    return sortTripFlights(((data as TripFlightRow[] | null) ?? []).map(mapFlightRow))
  } catch (err) {
    console.error("[fetchFlightsByTripId] unexpected error:", err)
    return []
  }
}

export async function insertTripFlight(input: CreateTripFlightInput): Promise<TripFlight> {
  const rows = await insertTripFlights([input])
  const first = rows[0]
  if (!first) throw new Error("항공권 저장에 실패했어요.")
  return first
}

/** Insert one or more flight segments in a single request. */
export async function insertTripFlights(inputs: CreateTripFlightInput[]): Promise<TripFlight[]> {
  if (!inputs.length) return []

  const tripId = String(inputs[0]?.tripId ?? "").trim()
  if (!tripId) throw new Error("tripId가 필요합니다.")

  const authorUserId = await resolveAuthorUserId(
    inputs[0]?.createdBy ?? inputs[0]?.userId
  )
  const passengerIds = normalizePassengerIds(
    inputs[0]?.passengerIds ?? (authorUserId ? [authorUserId] : [])
  )

  if (!authorUserId) {
    throw new Error("로그인이 필요해요. 로그인 후 항공권을 등록해 주세요.")
  }

  const payloads = inputs.map((input, index) =>
    buildInsertPayload(
      { ...input, tripId },
      input.segmentOrder && input.segmentOrder > 0 ? input.segmentOrder : index + 1,
      authorUserId,
      normalizePassengerIds(input.passengerIds ?? passengerIds)
    )
  )

  console.info("[insertTripFlights] created_by:", authorUserId)
  console.info("[insertTripFlights] passenger_ids:", passengerIds)

  const { data, error } = await supabase.from("trip_flights").insert(payloads).select("*")

  if (error) {
    console.error("[insertTripFlights] Supabase error:", error)
    console.error("[insertTripFlights] error.message:", error.message)
    console.error("[insertTripFlights] error.details:", (error as { details?: unknown }).details)
    console.error("[insertTripFlights] error.hint:", (error as { hint?: unknown }).hint)
    console.error("[insertTripFlights] error.code:", (error as { code?: unknown }).code)
    console.error("[insertTripFlights] payloads:", payloads)
    throw new Error(formatFlightDbError(error))
  }

  return sortTripFlights(((data as TripFlightRow[] | null) ?? []).map(mapFlightRow))
}

export async function updateTripFlight(
  flightId: string,
  input: CreateTripFlightInput
): Promise<TripFlight> {
  const id = String(flightId ?? "").trim()
  if (!id) throw new Error("flightId가 필요합니다.")

  const tripId = String(input.tripId ?? "").trim()
  if (!tripId) throw new Error("tripId가 필요합니다.")

  const authUserId = await getCurrentUserId()
  const { data: existing, error: lookupError } = await supabase
    .from("trip_flights")
    .select("id, created_by")
    .eq("id", id)
    .maybeSingle()

  if (lookupError) {
    console.error("[updateTripFlight] lookup:", lookupError.message)
    throw new Error(formatFlightDbError(lookupError))
  }
  if (!existing) throw new Error("항공권을 찾을 수 없어요.")

  const authorId = String((existing as { created_by?: string | null }).created_by ?? "").trim()
  const authorFields = {
    userId: authorId,
    createdBy: authorId,
  }
  if (!isFlightAuthor(authorFields, authUserId)) {
    throw new Error("작성자만 항공권을 수정할 수 있어요.")
  }

  const segmentOrder =
    input.segmentOrder && input.segmentOrder > 0 ? input.segmentOrder : 1
  const passengerIds = normalizePassengerIds(input.passengerIds)
  const payload = buildInsertPayload(
    { ...input, tripId },
    segmentOrder,
    authorId || authUserId,
    passengerIds
  )

  console.info("[updateTripFlight] created_by:", payload.created_by)
  console.info("[updateTripFlight] passenger_ids:", payload.passenger_ids)

  const { data, error } = await supabase
    .from("trip_flights")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    console.error("[updateTripFlight] Supabase error:", error)
    console.error("[updateTripFlight] error.message:", error.message)
    console.error("[updateTripFlight] error.details:", (error as { details?: unknown }).details)
    console.error("[updateTripFlight] error.hint:", (error as { hint?: unknown }).hint)
    console.error("[updateTripFlight] error.code:", (error as { code?: unknown }).code)
    console.error("[updateTripFlight] payload:", payload)
    throw new Error(formatFlightDbError(error))
  }

  return mapFlightRow(data as TripFlightRow)
}

export async function deleteTripFlight(flightId: string): Promise<boolean> {
  const id = String(flightId ?? "").trim()
  if (!id) return false

  try {
    const authUserId = await getCurrentUserId()
    const { data: existing, error: lookupError } = await supabase
      .from("trip_flights")
      .select("id, created_by")
      .eq("id", id)
      .maybeSingle()

    if (lookupError) {
      console.error("[deleteTripFlight] lookup:", lookupError.message)
      return false
    }
    if (!existing) return false

    const authorId = String((existing as { created_by?: string | null }).created_by ?? "").trim()
    const existingMapped = {
      userId: authorId,
      createdBy: authorId,
    }
    if (!isFlightAuthor(existingMapped, authUserId)) {
      console.warn("[deleteTripFlight] blocked: not flight author")
      return false
    }

    const { error } = await supabase.from("trip_flights").delete().eq("id", id)
    if (error) {
      console.error("[deleteTripFlight] Supabase error:", error)
      console.error("[deleteTripFlight] error.message:", error.message)
      return false
    }
    return true
  } catch (err) {
    console.error("[deleteTripFlight] unexpected error:", err)
    return false
  }
}

export { getErrorMessage, formatFlightDbError as getFlightErrorMessage }
