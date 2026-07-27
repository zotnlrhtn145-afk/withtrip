import { getCurrentUserId } from "@/lib/auth-session"
import { resolveCoverImageUrl } from "@/lib/place-cover-image"
import { supabase } from "@/lib/supabase"
import {
  SCHEDULE_CATEGORIES,
  type ScheduleCategory,
} from "@/lib/schedules-api"
import { getErrorMessage } from "@/lib/trips-api"

/** Client model for Supabase `saved_places` (가고 싶은 곳). */
export type SavedPlace = {
  id: string
  tripId: string
  userId: string
  placeName: string
  category: string
  localName: string
  subCategory: string
  guideBadge: string
  priceRange: string
  address: string
  phoneNumber: string
  memo: string
  imageUrl: string
  rating: number | null
  reviewCount: number | null
  distanceKm: number | null
  createdAt: string
}

export type SavedPlaceRow = {
  id: string
  trip_id: string
  user_id?: string | null
  place_name?: string | null
  name?: string | null
  category?: string | null
  local_name?: string | null
  name_local?: string | null
  sub_category?: string | null
  guide_badge?: string | null
  badge?: string | null
  price_range?: string | null
  address?: string | null
  phone_number?: string | null
  phone?: string | null
  memo?: string | null
  image_url?: string | null
  rating?: number | null
  review_count?: number | null
  distance_km?: number | null
  created_at?: string | null
}

export type CreateSavedPlaceInput = {
  tripId: string
  userId?: string | null
  placeName: string
  category?: string
  localName?: string
  subCategory?: string
  guideBadge?: string
  priceRange?: string
  address?: string
  phoneNumber?: string
  memo?: string
  imageUrl?: string
  rating?: number | null
  reviewCount?: number | null
  distanceKm?: number | null
}

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

export function mapSavedPlaceRow(row: SavedPlaceRow): SavedPlace {
  const category = String(row.category ?? "").trim()
  const subCategory = String(row.sub_category ?? "").trim()
  const imageUrl = resolveCoverImageUrl({
    imageUrl: row.image_url,
    category,
    subCategory,
  })

  return {
    id: row.id,
    tripId: row.trip_id,
    userId: String(row.user_id ?? "").trim(),
    placeName: String(row.place_name ?? row.name ?? "").trim(),
    category,
    localName: String(row.local_name ?? row.name_local ?? "").trim(),
    subCategory,
    guideBadge: String(row.guide_badge ?? row.badge ?? "").trim(),
    priceRange: String(row.price_range ?? "").trim(),
    address: String(row.address ?? "").trim(),
    phoneNumber: String(row.phone_number ?? row.phone ?? "").trim(),
    memo: String(row.memo ?? "").trim(),
    imageUrl,
    rating: typeof row.rating === "number" ? row.rating : null,
    reviewCount: typeof row.review_count === "number" ? row.review_count : null,
    distanceKm: typeof row.distance_km === "number" ? row.distance_km : null,
    createdAt: String(row.created_at ?? ""),
  }
}

function isBlankUserId(value: unknown): boolean {
  if (value == null) return true
  const raw = String(value).trim()
  return !raw || raw === "undefined" || raw === "null"
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
}

/** Normalize user_id for Postgres uuid column: valid uuid, otherwise null (never ""). */
function normalizeUserIdForDb(value: unknown): string | null {
  if (isBlankUserId(value)) return null
  const raw = String(value).trim()
  return isValidUuid(raw) ? raw : null
}

/** Columns allowed on `saved_places` INSERT (matches supabase/saved_places.sql). */
const SAVED_PLACE_INSERT_COLUMNS = new Set([
  "trip_id",
  "user_id",
  "place_name",
  "category",
  "local_name",
  "sub_category",
  "guide_badge",
  "price_range",
  "address",
  "phone_number",
  "memo",
  "image_url",
  "rating",
  "review_count",
  "distance_km",
])

function hasInsertValue(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === "string") {
    const trimmed = value.trim()
    return Boolean(trimmed) && trimmed !== "undefined" && trimmed !== "null"
  }
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value === "boolean") return true
  return false
}

/**
 * Drop unknown columns and empty values before Supabase insert.
 * Required keys (`trip_id`, `place_name`) are kept if present even when empty
 * so the API can still surface validation errors.
 */
function sanitizeInsertPayload(
  raw: Record<string, string | number | null | undefined>
): Record<string, string | number> {
  const required = new Set(["trip_id", "place_name"])
  const cleaned: Record<string, string | number> = {}

  for (const [key, value] of Object.entries(raw)) {
    if (!SAVED_PLACE_INSERT_COLUMNS.has(key)) continue
    if (required.has(key)) {
      if (typeof value === "string") cleaned[key] = value.trim()
      else if (typeof value === "number" && Number.isFinite(value)) cleaned[key] = value
      continue
    }
    if (!hasInsertValue(value)) continue
    cleaned[key] = value as string | number
  }

  return cleaned
}

function buildPayload(input: CreateSavedPlaceInput & { userId?: string | null }) {
  const category = String(input.category ?? "").trim()
  const subCategory = String(input.subCategory ?? "").trim()
  const imageUrl = resolveCoverImageUrl({
    imageUrl: input.imageUrl,
    category,
    subCategory,
  })

  return sanitizeInsertPayload({
    trip_id: String(input.tripId ?? "").trim(),
    place_name: String(input.placeName ?? "").trim(),
    category: category || null,
    local_name: String(input.localName ?? "").trim() || null,
    sub_category: subCategory || null,
    guide_badge: String(input.guideBadge ?? "").trim() || null,
    price_range: String(input.priceRange ?? "").trim() || null,
    address: String(input.address ?? "").trim() || null,
    phone_number: String(input.phoneNumber ?? "").trim() || null,
    memo: String(input.memo ?? "").trim() || null,
    image_url: imageUrl || null,
    user_id: normalizeUserIdForDb(input.userId),
    rating: typeof input.rating === "number" ? input.rating : null,
    review_count: typeof input.reviewCount === "number" ? input.reviewCount : null,
    distance_km: typeof input.distanceKm === "number" ? input.distanceKm : null,
  })
}

/** Map wishlist / free-text category → schedule chips (식사, 카페 …). */
export function toScheduleCategory(value: unknown, kind?: string): ScheduleCategory {
  const raw = String(value ?? "").trim()
  if ((SCHEDULE_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as ScheduleCategory
  }

  const hay = `${kind ?? ""} ${raw}`.toLowerCase()
  if (/숙소|hotel|stay|숙박|bed|lodging|resort/.test(hay) || kind === "stay") return "숙소"
  if (/이동|flight|공항|교통|버스|기차|ferry|항공/.test(hay)) return "이동"
  if (/카페|cafe|coffee|바\b|bar|라운지|lounge/.test(hay) || kind === "bar") return "카페"
  if (
    /식사|맛집|레스토랑|restaurant|food|미슐랭|갓포|프렌치|스시|dining/.test(hay) ||
    kind === "restaurant"
  ) {
    return "식사"
  }
  if (/관광|명소|spot|관광지|temple|공원|park/.test(hay)) return "관광"
  return "관광"
}

async function fetchFromTable(table: string, tripId: string): Promise<SavedPlace[] | null> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })

  if (error) {
    logSupabaseError(`fetchSavedPlaces(${table})`, error, { trip_id: tripId })
    return null
  }

  return ((data as SavedPlaceRow[] | null) ?? [])
    .map(mapSavedPlaceRow)
    .filter((place) => Boolean(place.placeName))
}

/**
 * 현재 여행의 저장된 장소(가고 싶은 곳) 목록.
 * `saved_places` 우선, 테이블이 없으면 `bookmarks` 폴백.
 */
export async function fetchSavedPlacesByTripId(tripId: string): Promise<SavedPlace[]> {
  const id = String(tripId ?? "").trim()
  if (!id) return []

  try {
    const primary = await fetchFromTable("saved_places", id)
    if (primary !== null) return primary

    const bookmarks = await fetchFromTable("bookmarks", id)
    return bookmarks ?? []
  } catch (err) {
    logSupabaseError("fetchSavedPlacesByTripId", err, { trip_id: id, note: "unexpected" })
    return []
  }
}

/** `saved_places` INSERT — `user_id` may be null; never blocks insert. */
export async function insertSavedPlace(input: CreateSavedPlaceInput): Promise<SavedPlace> {
  const tripId = String(input.tripId ?? "").trim()
  const placeName = String(input.placeName ?? "").trim()
  if (!tripId) throw new Error("tripId가 필요합니다.")
  if (!placeName) throw new Error("장소명을 입력해 주세요.")

  // Prefer explicit input, then auth session. Missing/invalid → null (no throw).
  let resolvedUserId: string | null = normalizeUserIdForDb(input.userId)
  if (!resolvedUserId) {
    try {
      resolvedUserId = normalizeUserIdForDb(await getCurrentUserId(null))
    } catch (err) {
      console.warn("[insertSavedPlace] getCurrentUserId skipped:", err)
      resolvedUserId = null
    }
  }

  const payload = buildPayload({ ...input, tripId, placeName, userId: resolvedUserId })
  console.info("[insertSavedPlace] sanitized payload keys:", Object.keys(payload))
  console.info("[insertSavedPlace] payload.user_id:", payload.user_id ?? "(omitted)")

  const { data, error } = await supabase
    .from("saved_places")
    .insert(payload)
    .select("*")
    .single()

  if (error) {
    logSupabaseError("insertSavedPlace", error, { payload })
    throw error
  }

  return mapSavedPlaceRow(data as SavedPlaceRow)
}

/** `saved_places` UPDATE */
export async function updateSavedPlace(
  placeId: string,
  input: Omit<CreateSavedPlaceInput, "tripId">
): Promise<SavedPlace> {
  const id = String(placeId ?? "").trim()
  if (!id) throw new Error("placeId가 필요합니다.")

  const payload: Record<string, string | null> = {
    place_name: String(input.placeName ?? "").trim(),
    category: String(input.category ?? "").trim() || null,
    local_name: String(input.localName ?? "").trim() || null,
    sub_category: String(input.subCategory ?? "").trim() || null,
    guide_badge: String(input.guideBadge ?? "").trim() || null,
    price_range: String(input.priceRange ?? "").trim() || null,
    address: String(input.address ?? "").trim() || null,
    phone_number: String(input.phoneNumber ?? "").trim() || null,
    memo: String(input.memo ?? "").trim() || null,
  }

  if (!payload.place_name) throw new Error("장소명을 입력해 주세요.")

  try {
    payload.user_id = normalizeUserIdForDb(await getCurrentUserId(input.userId))
  } catch {
    payload.user_id = null
  }

  const { data, error } = await supabase
    .from("saved_places")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    logSupabaseError("updateSavedPlace", error, { place_id: id, payload })
    throw error
  }

  return mapSavedPlaceRow(data as SavedPlaceRow)
}

/** `saved_places` DELETE (bookmarks 폴백) */
export async function deleteSavedPlace(placeId: string): Promise<boolean> {
  const id = String(placeId ?? "").trim()
  if (!id) return false

  try {
    const { error } = await supabase.from("saved_places").delete().eq("id", id)
    if (!error) return true

    const fallback = await supabase.from("bookmarks").delete().eq("id", id)
    if (!fallback.error) return true

    logSupabaseError("deleteSavedPlace", error, { place_id: id })
    return false
  } catch (err) {
    logSupabaseError("deleteSavedPlace", err, { place_id: id, note: "unexpected" })
    return false
  }
}

export { getErrorMessage }
