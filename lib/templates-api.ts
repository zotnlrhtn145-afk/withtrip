import "server-only"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { durationLabel, slugIdPart, themeOf } from "@/shared/trip-templates"

/**
 * 공개 템플릿 자료층 — **여기가 스크러빙 경계다.**
 *
 * 공개 페이지(/templates, /share)는 전부 이 파일을 거친다. service role 로
 * 읽되(RLS 우회), 바깥으로는 아래 타입에 적힌 **공개 필드만** 나간다.
 *
 * ⚠️ 절대 나가면 안 되는 것: memo, member_ids, created_by, phone_number,
 *    notice, 정산 전부, flight_info, invite_code, share_token(재노출 금지),
 *    멤버 이름·아바타.
 * ⚠️ RLS 로는 이걸 못 한다 — RLS 는 행 단위라 열을 가릴 수 없다.
 *    그래서 anon 정책을 추가하지 않고 이 코드가 문지기를 맡는다.
 */

export type PublicStop = {
  dayNumber: number
  category: string | null
  placeName: string
  visitTime: string | null
  address: string | null
  lat: number | null
  lng: number | null
}

export type PublicTrip = {
  id: string
  slug: string | null
  title: string
  city: string | null
  countryCode: string | null
  location: string | null
  startDate: string | null
  endDate: string | null
  duration: string
  coverImage: string | null
  description: string | null
  themes: { key: string; label: string; emoji: string }[]
  forkCount: number
  publishedAt: string | null
  days: { day: number; stops: PublicStop[] }[]
  stopCount: number
}

export type TemplateCard = {
  id: string
  slug: string
  /** 발행한 사람 — 앱 프로필의 「이 사람의 공개 코스」 필터용. 화면에 그대로 노출하진 않는다 */
  ownerId: string | null
  title: string
  city: string | null
  countryCode: string | null
  duration: string
  coverImage: string | null
  themes: { key: string; label: string; emoji: string }[]
  forkCount: number
  stopCount: number
  /** 여행 종료일이 지났으면 「다녀온 코스」 */
  traveled: boolean
  travelYm: string | null
}

const TRIP_COLS =
  "id, slug, title, location, start_date, end_date, cover_image, description, tag_list, country_code, city, fork_count, published_at, is_public, user_id"

function mapThemes(tagList: unknown): PublicTrip["themes"] {
  if (!Array.isArray(tagList)) return []
  return tagList
    .map((k) => themeOf(String(k)))
    .filter((t): t is NonNullable<ReturnType<typeof themeOf>> => !!t)
    .map((t) => ({ key: t.key, label: t.label, emoji: t.emoji }))
}

function isPast(endDate?: string | null): boolean {
  if (!endDate) return false
  return endDate < new Date().toISOString().slice(0, 10)
}

/** 일정을 공개 필드만 남겨 일차별로 묶는다 */
async function fetchStops(tripId: string): Promise<{ days: PublicTrip["days"]; count: number }> {
  const db = getSupabaseAdmin()
  if (!db) return { days: [], count: 0 }
  const { data, error } = await db
    .from("trip_schedules")
    .select("day_number, category, place_name, visit_time, address, lat, lng")
    .eq("trip_id", tripId)
    .order("day_number", { ascending: true })
    .order("visit_time", { ascending: true })
  if (error || !data) return { days: [], count: 0 }

  const byDay = new Map<number, PublicStop[]>()
  for (const r of data) {
    const stop: PublicStop = {
      dayNumber: Number(r.day_number ?? 1),
      category: r.category ?? null,
      placeName: String(r.place_name ?? "").trim(),
      visitTime: r.visit_time ?? null,
      address: r.address ?? null,
      lat: typeof r.lat === "number" ? r.lat : null,
      lng: typeof r.lng === "number" ? r.lng : null,
    }
    if (!stop.placeName) continue
    const list = byDay.get(stop.dayNumber) ?? []
    list.push(stop)
    byDay.set(stop.dayNumber, list)
  }
  const days = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, stops]) => ({ day, stops }))
  return { days, count: data.length }
}

function toPublicTrip(row: Record<string, unknown>, days: PublicTrip["days"], count: number): PublicTrip {
  return {
    id: String(row.id),
    slug: (row.slug as string) ?? null,
    title: String(row.title ?? "여행"),
    city: (row.city as string) ?? null,
    countryCode: (row.country_code as string) ?? null,
    location: (row.location as string) ?? null,
    startDate: (row.start_date as string) ?? null,
    endDate: (row.end_date as string) ?? null,
    duration: durationLabel(row.start_date as string, row.end_date as string),
    coverImage: (row.cover_image as string) ?? null,
    description: (row.description as string) ?? null,
    themes: mapThemes(row.tag_list),
    forkCount: Number(row.fork_count ?? 0),
    publishedAt: (row.published_at as string) ?? null,
    days,
    stopCount: count,
  }
}

/**
 * slug 로 공개 템플릿 하나.
 * ⚠️ 조회 열쇠는 slug 끝의 id 8자다 — 제목 부분은 나중에 바뀔 수 있어서
 *    전체 문자열 일치로 찾으면 옛 링크가 다 죽는다.
 */
export async function fetchTemplateBySlug(slug: string): Promise<PublicTrip | null> {
  const db = getSupabaseAdmin()
  const idPart = slugIdPart(decodeURIComponent(slug))
  if (!db || !idPart) return null
  /*
    ⚠️ uuid 컬럼에는 like 를 못 쓴다(42883 — 실측). 공개 여행의 slug 는
       "…-{id 앞 8자}" 로 끝나므로, slug 뒷조각 일치로 찾는 게 정확하고
       인덱스(idx_trips_public_slug)도 탄다.
  */
  const { data } = await db
    .from("trips")
    .select(TRIP_COLS)
    .eq("is_public", true)
    .like("slug", `%${idPart}`)
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const { days, count } = await fetchStops(String(data.id))
  return toPublicTrip(data, days, count)
}

/** 공유 토큰으로 하나 — 비공개여도 링크 받은 사람은 본다. 검색엔진에는 안 보인다(noindex) */
export async function fetchTripByToken(token: string): Promise<PublicTrip | null> {
  const db = getSupabaseAdmin()
  const t = String(token ?? "").trim()
  if (!db || t.length < 16) return null
  const { data } = await db.from("trips").select(TRIP_COLS).eq("share_token", t).limit(1).maybeSingle()
  if (!data) return null
  const { days, count } = await fetchStops(String(data.id))
  return toPublicTrip(data, days, count)
}

/** 허브 목록 — 복제 수 순. 일정 수는 한 번에 세어 온다 */
export async function fetchTemplateCards(limit = 60): Promise<TemplateCard[]> {
  const db = getSupabaseAdmin()
  if (!db) return []
  const { data } = await db
    .from("trips")
    .select(TRIP_COLS)
    .eq("is_public", true)
    .order("fork_count", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(limit)
  if (!data || data.length === 0) return []

  const ids = data.map((r) => String(r.id))
  const counts = new Map<string, number>()
  const { data: stops } = await db.from("trip_schedules").select("trip_id").in("trip_id", ids)
  for (const s of stops ?? []) {
    const k = String(s.trip_id)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  return data
    .filter((r) => r.slug)
    .map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      ownerId: (r.user_id as string) ?? null,
      title: String(r.title ?? "여행"),
      city: (r.city as string) ?? null,
      countryCode: (r.country_code as string) ?? null,
      duration: durationLabel(r.start_date as string, r.end_date as string),
      coverImage: (r.cover_image as string) ?? null,
      themes: mapThemes(r.tag_list),
      forkCount: Number(r.fork_count ?? 0),
      stopCount: counts.get(String(r.id)) ?? 0,
      traveled: isPast(r.end_date as string),
      travelYm: r.end_date ? String(r.end_date).slice(0, 7).replace("-", ".") : null,
    }))
}

/** 도시 허브 — 같은 도시 템플릿. 3개 이상일 때만 허브 페이지가 열린다 */
export async function fetchCityCards(city: string): Promise<TemplateCard[]> {
  const all = await fetchTemplateCards(120)
  return all.filter((c) => c.city === city)
}
