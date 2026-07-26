import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/trips-api"

export type FlightType = "OUTBOUND" | "RETURN" | "LAYOVER"

export type TripFlight = {
  id: string
  tripId: string
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
}

const FLIGHT_TYPE_RANK: Record<FlightType, number> = {
  OUTBOUND: 0,
  LAYOVER: 1,
  RETURN: 2,
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

  return {
    id: row.id,
    tripId: row.trip_id,
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

function buildInsertPayload(input: CreateTripFlightInput, segmentOrder: number) {
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
  }
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

  const payloads = inputs.map((input, index) =>
    buildInsertPayload(
      { ...input, tripId },
      input.segmentOrder && input.segmentOrder > 0 ? input.segmentOrder : index + 1
    )
  )

  const { data, error } = await supabase.from("trip_flights").insert(payloads).select("*")

  if (error) {
    console.error("[insertTripFlights] Supabase error:", error)
    console.error("[insertTripFlights] error.message:", error.message)
    console.error("[insertTripFlights] error.details:", (error as { details?: unknown }).details)
    console.error("[insertTripFlights] error.hint:", (error as { hint?: unknown }).hint)
    console.error("[insertTripFlights] error.code:", (error as { code?: unknown }).code)
    console.error("[insertTripFlights] payloads:", payloads)
    throw error
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

  const segmentOrder =
    input.segmentOrder && input.segmentOrder > 0 ? input.segmentOrder : 1
  const payload = buildInsertPayload({ ...input, tripId }, segmentOrder)

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
    throw error
  }

  return mapFlightRow(data as TripFlightRow)
}

export async function deleteTripFlight(flightId: string): Promise<boolean> {
  const id = String(flightId ?? "").trim()
  if (!id) return false

  try {
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

export { getErrorMessage }
