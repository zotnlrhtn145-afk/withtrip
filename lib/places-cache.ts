import { kindFromGoogleTypes } from "@/shared/place-subcategories"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

/**
 * 구글 Places 캐시 (public.places) 읽기/쓰기 헬퍼.
 *
 * 설계 원칙:
 *  - 이 모듈은 **절대 throw 하지 않는다.** 캐시가 죽어도 호출부는 구글 직접 호출로
 *    그대로 진행되어야 한다 (기존 기능 무중단).
 *  - 구글 정책: place_id는 영구 저장 가능, 나머지 필드는 30일 이내 갱신.
 *    → STALE_DAYS 지난 행은 캐시 미스로 취급해 다시 받아온다.
 *  - 사진은 파일로 저장하지 않고 photo_reference만 저장한다.
 */

/** 구글 정책상 허용되는 캐시 수명. 크론은 주 1회 갱신하므로 평소엔 여유가 크다. */
export const STALE_DAYS = 30

export type CachedPlace = {
  id: number
  google_place_id: string
  name: string
  address: string | null
  lat: number
  lng: number
  rating: number | null
  rating_count: number | null
  category: string | null
  sub_category: string | null
  price_level: number | null
  google_types: string[] | null
  photo_references: string[] | null
  phone: string | null
  is_closed: boolean
  last_refreshed_at: string
}

export type PlaceCacheInput = {
  googlePlaceId: string
  name: string
  address?: string | null
  lat: number
  lng: number
  rating?: number | null
  ratingCount?: number | null
  category?: string | null
  subCategory?: string | null
  priceLevel?: number | null
  googleTypes?: string[] | null
  photoReferences?: string[] | null
  phone?: string | null
  /*
    영업시간. **상세를 열 때만 들어온다** — 검색 결과에는 없다.
    ⚠️ `undefined` 와 `null` 이 다르다. `undefined` 면 **손대지 않고**,
       `null` 이면 지운다. 검색으로 캐시를 덮어쓸 때 애써 받아 둔 영업시간이
       날아가면 안 된다.
  */
  openingPeriods?: unknown[] | null
  hoursText?: string[] | null
  utcOffsetMin?: number | null
}

const SELECT_COLS =
  "id,google_place_id,name,address,lat,lng,rating,rating_count,category,sub_category,price_level,google_types,photo_references,phone,is_closed,last_refreshed_at"

function isFresh(row: CachedPlace): boolean {
  const ts = Date.parse(row.last_refreshed_at)
  if (!Number.isFinite(ts)) return false
  return Date.now() - ts < STALE_DAYS * 24 * 60 * 60 * 1000
}

/**
 * google_place_id 목록으로 캐시를 한 번에 조회한다.
 * 신선한(30일 이내) 행만 돌려준다. 실패하면 빈 Map.
 */
export async function readPlacesByGoogleIds(
  googlePlaceIds: string[]
): Promise<Map<string, CachedPlace>> {
  const out = new Map<string, CachedPlace>()
  const ids = Array.from(new Set(googlePlaceIds.filter(Boolean)))
  if (!ids.length) return out

  const db = getSupabaseAdmin()
  if (!db) return out

  try {
    const { data, error } = await db
      .from("places")
      .select(SELECT_COLS)
      .in("google_place_id", ids)

    if (error) {
      console.warn("[places-cache] read 실패 — 구글 직접 호출로 진행:", error.message)
      return out
    }

    for (const row of (data ?? []) as CachedPlace[]) {
      if (isFresh(row)) out.set(row.google_place_id, row)
    }
  } catch (err) {
    console.warn("[places-cache] read 예외 — 구글 직접 호출로 진행:", err)
  }

  return out
}

/**
 * 구글 types로 위드트립 카테고리(kind)를 추정한다.
 *
 * ⚠️ 규칙은 **`shared/place-subcategories` 한 곳**에 있다. 여기 따로 적으면
 *    웹과 앱이 다르게 분류한다. 예전에 이 자리에 세 줄짜리 규칙이 박혀 있었고,
 *    거기엔 **관광지가 아예 없었다**(박물관·공원·절이 전부 레스토랑이 됐다).
 */
export function inferCategoryFromTypes(types: string[] | undefined | null): string {
  return kindFromGoogleTypes(types)
}

/** 단건 조회 (상세 API용). */
export async function readPlaceByGoogleId(googlePlaceId: string): Promise<CachedPlace | null> {
  const map = await readPlacesByGoogleIds([googlePlaceId])
  return map.get(googlePlaceId) ?? null
}

/**
 * 이름(+좌표)으로 캐시에서 google_place_id를 찾는다.
 *
 * 상세 API가 placeId 없이 호출될 때, place_id를 알아내려고 Text Search를
 * 한 번 더 부르는 걸 없애기 위한 용도. **오탐을 막으려고 조건을 빡빡하게 건다**:
 *   - 이름이 대소문자 무시하고 정확히 일치
 *   - 좌표가 주어졌다면 약 200m 이내
 * 조금이라도 애매하면 null을 돌려주고 호출부는 기존대로 구글에 물어본다.
 */
export async function findCachedPlaceIdByName(
  name: string,
  lat?: number,
  lng?: number
): Promise<string | null> {
  const q = String(name ?? "").trim()
  if (!q) return null

  const db = getSupabaseAdmin()
  if (!db) return null

  try {
    let query = db
      .from("places")
      .select("google_place_id,name,lat,lng,last_refreshed_at")
      .ilike("name", q)
      .limit(5)

    // 약 200m ≒ 위도 0.0018도. 경도는 위도에 따라 달라지므로 넉넉히 잡고
    // 아래에서 실제 거리로 다시 거른다.
    if (typeof lat === "number" && typeof lng === "number") {
      const pad = 0.003
      query = query
        .gte("lat", lat - pad)
        .lte("lat", lat + pad)
        .gte("lng", lng - pad)
        .lte("lng", lng + pad)
    }

    const { data, error } = await query
    if (error || !data?.length) return null

    const rows = data as Pick<
      CachedPlace,
      "google_place_id" | "name" | "lat" | "lng" | "last_refreshed_at"
    >[]

    // 이름이 정확히 일치하는 것만 (ilike는 패턴 문자에 관대하므로 한 번 더 확인)
    const exact = rows.filter((r) => r.name.trim().toLowerCase() === q.toLowerCase())
    if (exact.length !== 1) return null

    const hit = exact[0]
    if (typeof lat === "number" && typeof lng === "number") {
      const dLat = (hit.lat - lat) * 111_000
      const dLng = (hit.lng - lng) * 111_000 * Math.cos((lat * Math.PI) / 180)
      if (Math.hypot(dLat, dLng) > 200) return null
    }

    return hit.google_place_id
  } catch (err) {
    console.warn("[places-cache] 이름 조회 예외(무시):", err)
    return null
  }
}

/**
 * 구글에서 새로 받아온 장소를 캐시에 기록한다 (google_place_id 기준 upsert).
 * 같은 장소를 여러 명이 저장해도 행은 1개만 생긴다.
 * 실패해도 조용히 넘어간다 — 캐시 쓰기는 부가 작업이다.
 */
export async function writePlaces(inputs: PlaceCacheInput[]): Promise<void> {
  const rows = inputs.filter(
    (p) => p.googlePlaceId && p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  )
  if (!rows.length) return

  const db = getSupabaseAdmin()
  if (!db) return

  // 같은 배치 안에서 place_id가 중복되면 upsert가 에러를 내므로 미리 접는다.
  const deduped = new Map<string, PlaceCacheInput>()
  for (const r of rows) deduped.set(r.googlePlaceId, r)

  const payload = Array.from(deduped.values()).map((p) => ({
    google_place_id: p.googlePlaceId,
    name: p.name,
    address: p.address ?? null,
    lat: p.lat,
    lng: p.lng,
    rating: p.rating ?? null,
    rating_count: p.ratingCount ?? null,
    category: p.category ?? null,
    sub_category: p.subCategory ?? null,
    price_level: p.priceLevel ?? null,
    google_types: p.googleTypes ?? null,
    photo_references: p.photoReferences ?? null,
    phone: p.phone ?? null,
    is_closed: false,
    last_refreshed_at: new Date().toISOString(),
    /*
      ⚠️ 영업시간은 **받아 왔을 때만** 적는다. 검색 결과에는 영업시간이 없어서,
         늘 적으면 상세에서 받아 둔 값을 검색이 지워 버린다.
    */
    ...(p.openingPeriods !== undefined
      ? {
          opening_periods: p.openingPeriods,
          hours_text: p.hoursText ?? null,
          utc_offset_min: p.utcOffsetMin ?? null,
          hours_refreshed_at: new Date().toISOString(),
        }
      : {}),
  }))

  try {
    const { error } = await db
      .from("places")
      .upsert(payload, { onConflict: "google_place_id" })
    if (error) console.warn("[places-cache] write 실패(무시):", error.message)
  } catch (err) {
    console.warn("[places-cache] write 예외(무시):", err)
  }
}

/* ────────────────────────────────────────────────────────────
   검색어 캐시 (Text Search 아끼기)

   Places 요금에서 Text Search 가 가장 비싸다(1000회당 $32).
   Details 는 위에서 이미 캐시하고 있었지만 **Text Search 는 매번 그대로
   나가고 있었다.** 사람들이 찾는 곳은 크게 겹치므로, 한 번 받아 두면
   두 번째부터는 공짜다.
   ──────────────────────────────────────────────────────────── */

/**
 * 검색어 캐시 수명.
 *
 * ⚠️ 길수록 돈은 아끼지만 **새로 생긴 가게가 늦게 보인다.** 품질을 지키는 쪽으로
 *    보름을 잡았다 — 같은 검색이 몰리는 건 대개 며칠 안이라 이 정도면 대부분
 *    잡히고, 새 가게도 반달 안에는 들어온다.
 */
export const SEARCH_STALE_DAYS = 14

/**
 * 검색어를 캐시 열쇠로 바꾼다.
 *
 * ⚠️ "강남 라멘" · "강남라멘" · "  강남   라멘 " 은 **같은 검색이다.**
 *    그대로 열쇠로 쓰면 띄어쓰기만 다른 검색이 저마다 구글을 부른다.
 */
export function searchCacheKey(query: string, kind?: string | null): string {
  const q = String(query ?? "")
    .toLowerCase()
    .normalize("NFKC")
    // 한글·영문·숫자만 남긴다 (띄어쓰기·기호 차이를 없앤다)
    .replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]+/g, "")
  return `${kind || "any"}:${q}`
}

/** 캐시된 place_id 목록. 없거나 오래됐으면 null */
export async function getCachedSearch(key: string): Promise<string[] | null> {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) return null
    const { data, error } = await admin
      .from("place_search_cache")
      .select("place_ids,at")
      .eq("q_key", key)
      .maybeSingle()
    if (error || !data) return null

    const ts = Date.parse(data.at as string)
    if (!Number.isFinite(ts) || Date.now() - ts > SEARCH_STALE_DAYS * 86_400_000) return null

    const ids = (data.place_ids as string[]) ?? []
    if (ids.length === 0) return null

    /*
      ⚠️ **`void admin.rpc(...)` 로 두면 안 된다.** supabase-js 의 질의 객체는
         `await` 하거나 `.then()` 을 붙이기 전까지 **아예 실행되지 않는다.**
         그래서 적중 횟수가 영영 0으로 남고, 아낀 돈이 항상 0원으로 보였다.
         (실제로 그렇게 만들었다가 확인 중에 잡았다)
         구글 호출 하나를 아낀 참이라 이 작은 UPDATE 를 기다릴 값은 충분하다.
    */
    await admin.rpc("bump_search_cache_hit", { p_key: key })
    return ids
  } catch {
    // ⚠️ 캐시가 죽어도 검색은 되어야 한다 — 조용히 미스로 취급한다
    return null
  }
}

/** 구글에서 받은 결과를 캐시에 넣는다 */
export async function putCachedSearch(key: string, placeIds: string[]): Promise<void> {
  try {
    const admin = getSupabaseAdmin()
    if (!admin || placeIds.length === 0) return
    await admin
      .from("place_search_cache")
      .upsert(
        { q_key: key, place_ids: placeIds, at: new Date().toISOString() },
        { onConflict: "q_key" }
      )
  } catch {
    /* 못 넣어도 다음에 다시 받으면 된다 */
  }
}
