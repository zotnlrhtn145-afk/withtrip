import { resolveAvatarUrl } from "@/lib/avatar"
import { getCurrentUserId } from "@/lib/auth-session"
import { curatePlaceCoverImage } from "@/lib/place-cover-curation"
import { resolveCoverImageUrl } from "@/lib/place-cover-image"
import { supabase } from "@/lib/supabase"
import {
  SCHEDULE_CATEGORIES,
  type ScheduleCategory,
} from "@/lib/schedules-api"
import { toWishlistKind } from "@/lib/trip-itinerary"
import { getErrorMessage } from "@/lib/trips-api"

/** Client model for Supabase `saved_places` (가고 싶은 곳). */
export type SavedPlace = {
  id: string
  tripId: string | null
  userId: string
  createdBy: string
  authorId: string
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
  lat: number | null
  lng: number | null
  createdAt: string
  recommendedBy: string | null
  recommender: { nickname: string | null; avatarUrl: string | null } | null
}

export type SavedPlaceRow = {
  id: string
  trip_id: string | null
  user_id?: string | null
  created_by?: string | null
  author_id?: string | null
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
  lat?: number | null
  lng?: number | null
  created_at?: string | null
  recommended_by?: string | null
  recommender?: { nickname?: string | null; avatar_url?: string | null } | null
}

export type CreateSavedPlaceInput = {
  /** null/omitted → trip-less "관심 맛집" (interest place), not yet assigned to a trip. */
  tripId?: string | null
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
  lat?: number | null
  lng?: number | null
  /** 대표 이미지 후보(최대 4장, DB에는 저장 안 됨) — AI가 실내/음식 사진을 골라 대표 이미지를 승격할 때만 쓰인다. */
  photoUrls?: string[]
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
    createdBy: String(row.created_by ?? "").trim(),
    authorId: String(row.author_id ?? "").trim(),
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
    lat: typeof row.lat === "number" ? row.lat : null,
    lng: typeof row.lng === "number" ? row.lng : null,
    createdAt: String(row.created_at ?? ""),
    recommendedBy: row.recommended_by ? String(row.recommended_by) : null,
    recommender: row.recommender
      ? {
          nickname: row.recommender.nickname ?? null,
          avatarUrl: resolveAvatarUrl(row.recommender.avatar_url) ?? null,
        }
      : null,
  }
}

/** True only when auth user id exactly matches a non-empty place author field. */
export function isSavedPlaceAuthor(
  place: Pick<SavedPlace, "userId" | "createdBy" | "authorId">,
  authUserId: string | null | undefined
): boolean {
  const uid = String(authUserId ?? "").trim()
  if (!uid) return false
  return (
    (Boolean(place.userId) && place.userId === uid) ||
    (Boolean(place.createdBy) && place.createdBy === uid) ||
    (Boolean(place.authorId) && place.authorId === uid)
  )
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
  "lat",
  "lng",
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
 * `place_name` is kept even when empty so the API can still surface validation
 * errors. `trip_id` is nullable — an empty value becomes `null` (trip-less
 * "관심 맛집"), never an empty string, since the column is a uuid type.
 */
function sanitizeInsertPayload(
  raw: Record<string, string | number | null | undefined>
): Record<string, string | number | null> {
  const cleaned: Record<string, string | number | null> = {}

  for (const [key, value] of Object.entries(raw)) {
    if (!SAVED_PLACE_INSERT_COLUMNS.has(key)) continue
    if (key === "place_name") {
      if (typeof value === "string") cleaned[key] = value.trim()
      else if (typeof value === "number" && Number.isFinite(value)) cleaned[key] = value
      continue
    }
    if (key === "trip_id") {
      const trimmed = typeof value === "string" ? value.trim() : ""
      cleaned[key] = trimmed || null
      continue
    }
    if (!hasInsertValue(value)) continue
    cleaned[key] = value as string | number
  }

  return cleaned
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function toReviewCount(value: unknown): number {
  const n = toFiniteNumber(value)
  if (n == null) return 0
  return Math.max(0, Math.floor(n))
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
    rating: toFiniteNumber(input.rating),
    // Always send a number — omit/undefined/null → 0 (avoids NOT NULL / type errors).
    review_count: toReviewCount(input.reviewCount),
    distance_km: toFiniteNumber(input.distanceKm),
    lat: toFiniteNumber(input.lat),
    lng: toFiniteNumber(input.lng),
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

/**
 * 여행에 아직 배정하지 않은 "나의 관심 맛집" 목록 (trip_id IS NULL, 본인 소유).
 */
export async function fetchInterestPlacesByUserId(userId: string): Promise<SavedPlace[]> {
  const id = String(userId ?? "").trim()
  if (!id) return []

  const { data, error } = await supabase
    .from("saved_places")
    .select("*, recommender:profiles!saved_places_recommended_by_fkey(nickname, avatar_url)")
    .is("trip_id", null)
    .eq("user_id", id)
    .order("created_at", { ascending: false })

  if (error) {
    logSupabaseError("fetchInterestPlacesByUserId", error, { user_id: id })
    return []
  }

  return ((data as unknown as SavedPlaceRow[] | null) ?? [])
    .map(mapSavedPlaceRow)
    .filter((place) => Boolean(place.placeName))
}

/** 트립 없는 "관심 맛집"을 특정 여행의 "가고 싶은 곳"으로 옮긴다 (trip_id 배정). */
export async function assignSavedPlaceToTrip(
  placeId: string,
  tripId: string
): Promise<SavedPlace> {
  const id = String(placeId ?? "").trim()
  const nextTripId = String(tripId ?? "").trim()
  if (!id) throw new Error("placeId가 필요합니다.")
  if (!nextTripId) throw new Error("tripId가 필요합니다.")

  const { data, error } = await supabase
    .from("saved_places")
    .update({ trip_id: nextTripId })
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    logSupabaseError("assignSavedPlaceToTrip", error, { place_id: id, trip_id: nextTripId })
    throw error
  }

  return mapSavedPlaceRow(data as SavedPlaceRow)
}

/**
 * `saved_places` INSERT — `user_id` may be null; never blocks insert.
 * `tripId` may be null/omitted → saved as a trip-less "관심 맛집" (interest
 * place), later assignable to a trip via `assignSavedPlaceToTrip`.
 */
export async function insertSavedPlace(input: CreateSavedPlaceInput): Promise<SavedPlace> {
  const tripId = String(input.tripId ?? "").trim() || null
  const placeName = String(input.placeName ?? "").trim()
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

  const saved = mapSavedPlaceRow(data as SavedPlaceRow)

  if (input.photoUrls && input.photoUrls.length >= 2) {
    void upgradeSavedPlaceCoverWithAI(saved.id, {
      photoUrls: input.photoUrls,
      placeName: saved.placeName,
      kind: toWishlistKind(saved.category),
      subCategory: saved.subCategory,
    })
  }

  return saved
}

/** 같은 장소가 (user, trip) 조합으로 이미 저장돼 있는지 — place_name 기준. trip_id NULL = 나의 찜. */
export async function savedPlaceExists(params: {
  userId: string | null
  tripId: string | null
  placeName: string
}): Promise<boolean> {
  const name = String(params.placeName ?? "").trim()
  const uid = normalizeUserIdForDb(params.userId)
  if (!name || !uid) return false
  let query = supabase.from("saved_places").select("id").eq("user_id", uid).eq("place_name", name).limit(1)
  query = params.tripId ? query.eq("trip_id", params.tripId) : query.is("trip_id", null)
  const { data, error } = await query
  if (error) {
    logSupabaseError("savedPlaceExists", error)
    return false
  }
  return (data?.length ?? 0) > 0
}

/**
 * 일정에 등록한 장소를 (a) 나의 찜(trip_id NULL) + (b) 여행클립 찜(trip_id) 두 곳에 자동 등록.
 * 중복 규칙:
 * - 나의 찜: 내가 이미 올린 같은 장소면 건너뜀(내 것끼리 중복 방지).
 * - 여행클립 찜: 내가 이 여행에 이미 올린 같은 장소면 건너뜀. 다른 유저가 올린 건 무관하게 등록됨
 *   (여행클립 찜은 user_id별 개별 row라, 내 것만 중복 체크한다).
 * 자동 등록 실패는 조용히 무시(일정 저장 자체엔 영향 없음).
 */
export async function autoSaveScheduledPlace(input: {
  tripId: string
  userId: string | null
  place: {
    placeName: string
    localName?: string
    subCategory?: string
    category?: string
    address?: string
    phoneNumber?: string
    imageUrl?: string
    rating?: number | null
    reviewCount?: number | null
    lat?: number | null
    lng?: number | null
    photoUrls?: string[]
  }
}): Promise<{ mine: boolean; trip: boolean }> {
  const uid = normalizeUserIdForDb(input.userId)
  const name = String(input.place.placeName ?? "").trim()
  const result = { mine: false, trip: false }
  if (!uid || !name || !input.tripId) return result

  const base: CreateSavedPlaceInput = {
    userId: uid,
    placeName: name,
    category: input.place.category,
    subCategory: input.place.subCategory,
    localName: input.place.localName,
    address: input.place.address,
    phoneNumber: input.place.phoneNumber,
    imageUrl: input.place.imageUrl,
    rating: input.place.rating ?? null,
    reviewCount: input.place.reviewCount ?? null,
    lat: input.place.lat ?? null,
    lng: input.place.lng ?? null,
    photoUrls: input.place.photoUrls,
  }

  // (a) 나의 찜 — 내 것끼리 중복이면 skip
  if (!(await savedPlaceExists({ userId: uid, tripId: null, placeName: name }))) {
    try {
      await insertSavedPlace({ ...base })
      result.mine = true
    } catch (err) {
      logSupabaseError("autoSaveScheduledPlace.mine", err)
    }
  }
  // (b) 여행클립 찜 — 내가 이 여행에 이미 올린 같은 장소면 skip
  if (!(await savedPlaceExists({ userId: uid, tripId: input.tripId, placeName: name }))) {
    try {
      await insertSavedPlace({ ...base, tripId: input.tripId })
      result.trip = true
    } catch (err) {
      logSupabaseError("autoSaveScheduledPlace.trip", err)
    }
  }
  return result
}

/**
 * Background upgrade — AI가 후보 사진 중 업장 내부/음식 사진을 골라 대표
 * 이미지로 교체한다. 저장은 이미 끝난 뒤 호출되므로 실패해도 기존 대표
 * 이미지가 그대로 유지된다.
 */
async function upgradeSavedPlaceCoverWithAI(
  placeId: string,
  input: { photoUrls: string[]; placeName: string; kind: string; subCategory: string }
): Promise<void> {
  try {
    const curated = await curatePlaceCoverImage(input)
    if (!curated) return

    const { error } = await supabase
      .from("saved_places")
      .update({ image_url: curated })
      .eq("id", placeId)

    if (error) {
      console.warn("[upgradeSavedPlaceCoverWithAI] update failed:", error.message)
      return
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("withtrip:saved-place-cover-ready", { detail: { placeId } })
      )
    }
  } catch (err) {
    console.warn("[upgradeSavedPlaceCoverWithAI] unexpected:", err)
  }
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
