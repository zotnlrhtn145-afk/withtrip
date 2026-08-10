import { getCurrentUserId } from "@/lib/auth-session"
import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/trips-api"

/** 이동수단 종류 — 비행기 / 기차 / 자가용. */
export type TransportType = "FLIGHT" | "TRAIN" | "CAR"
/** 여정 방향 — 가는 편 / 오는 편 / 경유(환승). */
export type TransportRole = "OUTBOUND" | "RETURN" | "LAYOVER"

export type TripTransport = {
  id: string
  tripId: string
  userId: string
  createdBy: string
  passengerIds: string[]
  transportType: TransportType
  /** 항공사 / 열차 종류 / 차량 정보 */
  carrierName: string
  /** 편명 / 열차번호 / 차량번호 */
  vehicleNo: string
  /** 출발지 (공항 코드 / 역 이름 / 장소) */
  fromLabel: string
  /** 도착지 (공항 코드 / 역 이름 / 장소) */
  toLabel: string
  departTime: string
  arriveTime: string
  duration: string
  departDate: string
  arriveDate: string
  transportRole: TransportRole
  segmentOrder: number
  createdAt: string
}

export type TripTransportRow = {
  id: string
  trip_id: string
  user_id?: string | null
  created_by?: string | null
  passenger_ids?: string[] | null
  transport_type?: string | null
  carrier_name?: string | null
  vehicle_no?: string | null
  from_label?: string | null
  to_label?: string | null
  depart_time?: string | null
  arrive_time?: string | null
  duration?: string | null
  depart_date?: string | null
  arrive_date?: string | null
  transport_role?: string | null
  segment_order?: number | null
  created_at?: string | null
}

export type CreateTripTransportInput = {
  tripId: string
  transportType: TransportType
  carrierName: string
  vehicleNo: string
  fromLabel: string
  toLabel: string
  departTime: string
  arriveTime: string
  duration?: string
  departDate?: string
  arriveDate?: string
  transportRole?: TransportRole
  segmentOrder?: number
  userId?: string | null
  createdBy?: string | null
  passengerIds?: string[] | null
}

const TRANSPORT_ROLE_RANK: Record<TransportRole, number> = {
  OUTBOUND: 0,
  LAYOVER: 1,
  RETURN: 2,
}

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

function normalizeTransportType(value: unknown): TransportType {
  const raw = String(value ?? "").trim().toUpperCase()
  if (raw === "TRAIN" || raw === "CAR" || raw === "FLIGHT") return raw
  return "FLIGHT"
}

function normalizeTransportRole(value: unknown): TransportRole {
  const raw = String(value ?? "").trim().toUpperCase()
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

/** True only when auth user id matches a non-empty transport author field. */
export function isTransportAuthor(
  transport: Pick<TripTransport, "userId" | "createdBy">,
  authUserId: string | null | undefined
): boolean {
  const uid = String(authUserId ?? "").trim()
  if (!uid) return false
  return (
    (Boolean(transport.userId) && transport.userId === uid) ||
    (Boolean(transport.createdBy) && transport.createdBy === uid)
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

export function sortTripTransports(transports: TripTransport[]): TripTransport[] {
  return [...transports].sort((a, b) => {
    if (a.transportType !== b.transportType) {
      return a.transportType.localeCompare(b.transportType)
    }
    const rankDiff = TRANSPORT_ROLE_RANK[a.transportRole] - TRANSPORT_ROLE_RANK[b.transportRole]
    if (rankDiff !== 0) return rankDiff
    return a.segmentOrder - b.segmentOrder
  })
}

export function mapTransportRow(row: TripTransportRow): TripTransport {
  const departTime = normalizeTime(row.depart_time ?? "")
  const arriveTime = normalizeTime(row.arrive_time ?? "")
  const storedDuration = String(row.duration ?? "").trim()
  const segmentOrder = Number(row.segment_order)
  const createdBy = String(row.created_by ?? "").trim()
  const userId = createdBy || String(row.user_id ?? "").trim()

  return {
    id: row.id,
    tripId: row.trip_id,
    userId,
    createdBy: createdBy || userId,
    passengerIds: normalizePassengerIds(row.passenger_ids),
    transportType: normalizeTransportType(row.transport_type),
    carrierName: String(row.carrier_name ?? "").trim(),
    vehicleNo: String(row.vehicle_no ?? "").trim().toUpperCase(),
    fromLabel: String(row.from_label ?? "").trim(),
    toLabel: String(row.to_label ?? "").trim(),
    departTime,
    arriveTime,
    duration: storedDuration || computeDurationLabel(departTime, arriveTime),
    departDate: String(row.depart_date ?? "").trim(),
    arriveDate: String(row.arrive_date ?? "").trim(),
    transportRole: normalizeTransportRole(row.transport_role),
    segmentOrder: Number.isFinite(segmentOrder) && segmentOrder > 0 ? segmentOrder : 1,
    createdAt: String(row.created_at ?? ""),
  }
}

function buildInsertPayload(
  input: CreateTripTransportInput,
  segmentOrder: number,
  authorUserId: string | null,
  passengerIds: string[]
) {
  const tripId = String(input.tripId ?? "").trim()
  const transportType = normalizeTransportType(input.transportType)
  const carrierValue = String(input.carrierName ?? "").trim()
  const vehicleNoValue = String(input.vehicleNo ?? "").trim().toUpperCase()
  const fromValue = String(input.fromLabel ?? "").trim()
  const toValue = String(input.toLabel ?? "").trim()
  const departTimeValue = normalizeTime(input.departTime) || "09:00"
  const arriveTimeValue = normalizeTime(input.arriveTime) || "11:00"
  const durationValue =
    String(input.duration ?? "").trim() ||
    computeDurationLabel(departTimeValue, arriveTimeValue)
  const transportRole = normalizeTransportRole(input.transportRole ?? "OUTBOUND")

  return {
    trip_id: tripId,
    transport_type: transportType,
    carrier_name: carrierValue,
    vehicle_no: vehicleNoValue || null,
    from_label: fromValue,
    to_label: toValue,
    depart_time: departTimeValue,
    arrive_time: arriveTimeValue,
    duration: durationValue || null,
    depart_date: String(input.departDate ?? "").trim() || null,
    arrive_date: String(input.arriveDate ?? "").trim() || null,
    transport_role: transportRole,
    segment_order: segmentOrder,
    created_by: authorUserId,
    passenger_ids: passengerIds,
  }
}

function formatTransportDbError(error: unknown): string {
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
    /schema cache|could not find.*(created_by|passenger_ids|transport_type|carrier_name)|pgrst204|column .* does not exist/.test(
      raw
    )
  ) {
    return "이동수단 스키마가 아직 반영되지 않았어요. Supabase에서 trip_transports 테이블 스키마 캐시를 확인해 주세요."
  }
  return message || "이동수단 저장에 실패했어요."
}

async function resolveAuthorUserId(explicit?: string | null): Promise<string | null> {
  const fromInput = String(explicit ?? "").trim()
  if (fromInput && isValidUuid(fromInput)) return fromInput
  const authId = await getCurrentUserId()
  if (authId && isValidUuid(authId)) return authId
  return null
}

export async function fetchTransportsByTripId(tripId: string): Promise<TripTransport[]> {
  const id = String(tripId ?? "").trim()
  if (!id) return []

  try {
    const { data, error } = await supabase
      .from("trip_transports")
      .select("*")
      .eq("trip_id", id)
      .order("transport_type", { ascending: true })
      .order("transport_role", { ascending: true })
      .order("segment_order", { ascending: true })

    if (error) {
      console.error("[fetchTransportsByTripId] Supabase error:", error)
      console.error("[fetchTransportsByTripId] error.message:", error.message)
      return []
    }

    return sortTripTransports(((data as TripTransportRow[] | null) ?? []).map(mapTransportRow))
  } catch (err) {
    console.error("[fetchTransportsByTripId] unexpected error:", err)
    return []
  }
}

export async function insertTripTransport(
  input: CreateTripTransportInput
): Promise<TripTransport> {
  const rows = await insertTripTransports([input])
  const first = rows[0]
  if (!first) throw new Error("이동수단 저장에 실패했어요.")
  return first
}

/** Insert one or more transport segments in a single request. */
export async function insertTripTransports(
  inputs: CreateTripTransportInput[]
): Promise<TripTransport[]> {
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
    throw new Error("로그인이 필요해요. 로그인 후 이동수단을 등록해 주세요.")
  }

  const payloads = inputs.map((input, index) =>
    buildInsertPayload(
      { ...input, tripId },
      input.segmentOrder && input.segmentOrder > 0 ? input.segmentOrder : index + 1,
      authorUserId,
      normalizePassengerIds(input.passengerIds ?? passengerIds)
    )
  )

  const { data, error } = await supabase.from("trip_transports").insert(payloads).select("*")

  if (error) {
    console.error("[insertTripTransports] Supabase error:", error)
    console.error("[insertTripTransports] payloads:", payloads)
    throw new Error(formatTransportDbError(error))
  }

  return sortTripTransports(((data as TripTransportRow[] | null) ?? []).map(mapTransportRow))
}

/** 호스트(방장) = trips.user_id. 방장은 작성자가 아니어도 수정·삭제할 수 있다. */
async function isTripHost(tripId: string, authUserId: string | null): Promise<boolean> {
  const uid = String(authUserId ?? "").trim()
  const tid = String(tripId ?? "").trim()
  if (!uid || !tid) return false
  const { data } = await supabase.from("trips").select("user_id").eq("id", tid).maybeSingle()
  return String((data as { user_id?: string | null } | null)?.user_id ?? "").trim() === uid
}

export async function updateTripTransport(
  transportId: string,
  input: CreateTripTransportInput
): Promise<TripTransport> {
  const id = String(transportId ?? "").trim()
  if (!id) throw new Error("transportId가 필요합니다.")

  const tripId = String(input.tripId ?? "").trim()
  if (!tripId) throw new Error("tripId가 필요합니다.")

  const authUserId = await getCurrentUserId()
  const { data: existing, error: lookupError } = await supabase
    .from("trip_transports")
    .select("id, created_by, trip_id")
    .eq("id", id)
    .maybeSingle()

  if (lookupError) {
    console.error("[updateTripTransport] lookup:", lookupError.message)
    throw new Error(formatTransportDbError(lookupError))
  }
  if (!existing) throw new Error("이동수단을 찾을 수 없어요.")

  const authorId = String((existing as { created_by?: string | null }).created_by ?? "").trim()
  const authorFields = { userId: authorId, createdBy: authorId }
  const existingTripId = String((existing as { trip_id?: string | null }).trip_id ?? tripId).trim()
  // 작성자 또는 방장(호스트)만 수정 가능
  if (!isTransportAuthor(authorFields, authUserId) && !(await isTripHost(existingTripId, authUserId))) {
    throw new Error("작성자 또는 방장만 이동수단을 수정할 수 있어요.")
  }

  const segmentOrder = input.segmentOrder && input.segmentOrder > 0 ? input.segmentOrder : 1
  const passengerIds = normalizePassengerIds(input.passengerIds)
  const payload = buildInsertPayload(
    { ...input, tripId },
    segmentOrder,
    authorId || authUserId,
    passengerIds
  )

  const { data, error } = await supabase
    .from("trip_transports")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    console.error("[updateTripTransport] Supabase error:", error)
    console.error("[updateTripTransport] payload:", payload)
    throw new Error(formatTransportDbError(error))
  }

  return mapTransportRow(data as TripTransportRow)
}

export async function deleteTripTransport(transportId: string): Promise<boolean> {
  const id = String(transportId ?? "").trim()
  if (!id) return false

  try {
    const authUserId = await getCurrentUserId()
    const { data: existing, error: lookupError } = await supabase
      .from("trip_transports")
      .select("id, created_by, trip_id")
      .eq("id", id)
      .maybeSingle()

    if (lookupError) {
      console.error("[deleteTripTransport] lookup:", lookupError.message)
      return false
    }
    if (!existing) return false

    const authorId = String((existing as { created_by?: string | null }).created_by ?? "").trim()
    const existingMapped = { userId: authorId, createdBy: authorId }
    const existingTripId = String((existing as { trip_id?: string | null }).trip_id ?? "").trim()
    // 작성자 또는 방장(호스트)만 삭제 가능
    if (!isTransportAuthor(existingMapped, authUserId) && !(await isTripHost(existingTripId, authUserId))) {
      console.warn("[deleteTripTransport] blocked: not author or host")
      return false
    }

    const { error } = await supabase.from("trip_transports").delete().eq("id", id)
    if (error) {
      console.error("[deleteTripTransport] Supabase error:", error)
      return false
    }
    return true
  } catch (err) {
    console.error("[deleteTripTransport] unexpected error:", err)
    return false
  }
}

export { getErrorMessage, formatTransportDbError as getTransportErrorMessage }
