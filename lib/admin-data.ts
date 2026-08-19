import "server-only"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

/**
 * 관리자 화면이 읽는 값들. **서버에서만** 부른다(`server-only`).
 *
 * ⚠️ 전부 service_role 로 읽는다 — RLS 를 지나가지 않는다는 뜻이다.
 *    그러니 **이 파일의 함수는 절대 라우트 핸들러에서 그대로 열어 두면 안 된다.**
 *    출입은 middleware 의 `/_admin` 검사 하나로 통제한다.
 */

function db() {
  const c = getSupabaseAdmin()
  if (!c) throw new Error("SUPABASE_SERVICE_ROLE_KEY 가 없습니다 — 관리자 화면을 열 수 없습니다")
  return c
}

export type Overview = {
  users: number
  users_new_30d: number
  trips: number
  places: number
  messages: number
  clips: number
  reviews: number
  reports_open: number
  hidden: number
  views_yesterday: number
  visitors_yesterday: number
}

export async function fetchOverview(): Promise<Overview> {
  const { data, error } = await db().rpc("admin_overview")
  if (error) throw new Error(error.message)
  return data as Overview
}

export type DailyVisit = { day: string; views: number; visitors: number; users: number }

export async function fetchDailyVisits(from: string, to: string): Promise<DailyVisit[]> {
  const { data, error } = await db().rpc("admin_daily_visits", { p_from: from, p_to: to })
  if (error) throw new Error(error.message)
  return (data ?? []) as DailyVisit[]
}

export type CategoryVisit = { category: string; views: number; visitors: number }

export async function fetchCategoryVisits(from: string, to: string): Promise<CategoryVisit[]> {
  const { data, error } = await db().rpc("admin_category_visits", { p_from: from, p_to: to })
  if (error) throw new Error(error.message)
  return (data ?? []) as CategoryVisit[]
}

export type Cost = {
  id: string
  month: string
  vendor: string
  label: string | null
  amount: number
  currency: string
  krw: number | null
  source: string
  note: string | null
  updated_at: string
}

export async function fetchCosts(months: string[]): Promise<Cost[]> {
  const { data, error } = await db()
    .from("admin_costs")
    .select("*")
    .in("month", months)
    .order("month", { ascending: false })
    .order("amount", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Cost[]
}

export type Subscriber = {
  id: string
  email: string | null
  nickname: string | null
  avatar_url: string | null
  created_at: string
  last_sign_in_at: string | null
  provider: string | null
  deletion_requested_at: string | null
  trips: number
  places: number
  reviews: number
}

/**
 * 가입자 목록.
 *
 * ⚠️ 이메일·마지막 접속은 `auth.users` 에만 있고, 별명·탈퇴요청은 `profiles` 에만 있다.
 *    한쪽만 읽으면 **가입했지만 프로필을 안 만든 사람이 통째로 사라진다** —
 *    auth 를 기준으로 두고 프로필을 얹는다.
 */
export async function fetchSubscribers(): Promise<Subscriber[]> {
  const c = db()
  const { data: authList, error: authErr } = await c.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (authErr) throw new Error(authErr.message)

  const ids = authList.users.map((u) => u.id)
  const [{ data: profiles }, { data: trips }, { data: places }, { data: reviews }] = await Promise.all([
    c.from("profiles").select("id,nickname,avatar_url,deletion_requested_at").in("id", ids),
    c.from("trips").select("user_id").in("user_id", ids),
    c.from("saved_places").select("user_id").in("user_id", ids),
    c.from("place_reviews").select("user_id").in("user_id", ids),
  ])

  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]))
  const count = (rows: { user_id: string }[] | null) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1)
    return m
  }
  const tripN = count(trips as { user_id: string }[] | null)
  const placeN = count(places as { user_id: string }[] | null)
  const reviewN = count(reviews as { user_id: string }[] | null)

  return authList.users
    .map((u) => {
      const p = byId.get(u.id)
      return {
        id: u.id,
        email: u.email ?? null,
        nickname: (p?.nickname as string) ?? null,
        avatar_url: (p?.avatar_url as string) ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        provider: (u.app_metadata?.provider as string) ?? null,
        deletion_requested_at: (p?.deletion_requested_at as string) ?? null,
        trips: tripN.get(u.id) ?? 0,
        places: placeN.get(u.id) ?? 0,
        reviews: reviewN.get(u.id) ?? 0,
      }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export type ContentKind = "clip" | "review" | "message" | "place"

export type ContentItem = {
  kind: ContentKind
  id: string
  at: string
  author: string
  authorId: string | null
  /** 화면에 보여 줄 본문 (없으면 빈 문자열) */
  text: string
  /** 사진·영상 미리보기 */
  media: string | null
  /** 어디에 속한 글인지 — 여행 제목 · 장소 이름 */
  where: string | null
  hidden: boolean
}

/**
 * 대화 한 줄을 읽을 수 있는 글로.
 *
 * ⚠️ 앱이 이모티콘을 `[emoticon:bv1_abs]` 같은 **코드로 저장한다.** 그대로 두면
 *    목록이 암호문처럼 보여서 훑기가 안 된다 — 여기서 풀어 준다.
 */
function messageText(r: Record<string, unknown>): string {
  const kind = r.kind as string | null
  if (kind && kind !== "text") return `[${kind}]`
  const body = (r.content as string) ?? ""
  return body.replace(/\[emoticon:([a-z0-9_]+)\]/gi, "(이모티콘)")
}

/** 가려 둔 것들의 열쇠 모음 (`kind:id`) */
export async function fetchHiddenKeys(): Promise<Set<string>> {
  const { data } = await db().from("content_hides").select("kind,target_id")
  return new Set((data ?? []).map((r) => `${r.kind}:${r.target_id}`))
}

/**
 * 검열용 글 목록.
 *
 * 종류를 한 줄기로 합쳐서 준다 — 관리자가 "대화 / 클립 / 맛집"을 따로 오가지 않고
 * **한 화면에서 최근 순으로 훑다가 이상한 것만 가리게** 하려는 것이다.
 */
export async function fetchContent(kind: ContentKind | "all", limit = 100): Promise<ContentItem[]> {
  const c = db()
  const hidden = await fetchHiddenKeys()
  const want = (k: ContentKind) => kind === "all" || kind === k

  const [clips, reviews, messages, places] = await Promise.all([
    want("clip")
      ? c.from("trip_clips").select("id,caption,media_url,media_type,created_at,user_id,trip_id").order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] }),
    want("review")
      ? c.from("place_reviews").select("id,body,photos,rating,created_at,user_id,google_place_id").order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] }),
    want("message")
      ? c.from("trip_messages").select("id,content,kind,created_at,user_id,trip_id,deleted_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] }),
    want("place")
      ? c.from("saved_places").select("id,place_name,memo,image_url,category,created_at,user_id,address").order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] }),
  ])

  type Row = Record<string, unknown>
  const rows = [
    ...((clips.data ?? []) as Row[]).map((r) => ({ kind: "clip" as const, r })),
    ...((reviews.data ?? []) as Row[]).map((r) => ({ kind: "review" as const, r })),
    ...((messages.data ?? []) as Row[]).map((r) => ({ kind: "message" as const, r })),
    ...((places.data ?? []) as Row[]).map((r) => ({ kind: "place" as const, r })),
  ]

  // 글쓴이 이름과 여행 제목은 한 번에 몰아서 가져온다 (줄마다 조회하면 100번 왕복한다)
  const userIds = [...new Set(rows.map(({ r }) => r.user_id as string).filter(Boolean))]
  const tripIds = [...new Set(rows.map(({ r }) => r.trip_id as string).filter(Boolean))]
  const [{ data: profs }, { data: trips }] = await Promise.all([
    userIds.length ? c.from("profiles").select("id,nickname,email").in("id", userIds) : Promise.resolve({ data: [] }),
    tripIds.length ? c.from("trips").select("id,title").in("id", tripIds) : Promise.resolve({ data: [] }),
  ])
  const nameOf = new Map((profs ?? []).map((p) => [p.id as string, (p.nickname as string) || (p.email as string) || "이름 없음"]))
  const tripOf = new Map((trips ?? []).map((t) => [t.id as string, t.title as string]))

  const items: ContentItem[] = rows.map(({ kind: k, r }) => {
    const base = {
      kind: k,
      id: r.id as string,
      at: r.created_at as string,
      authorId: (r.user_id as string) ?? null,
      author: nameOf.get(r.user_id as string) ?? "알 수 없음",
      hidden: hidden.has(`${k}:${r.id}`),
    }
    if (k === "clip")
      return { ...base, text: (r.caption as string) ?? "", media: (r.media_url as string) ?? null, where: tripOf.get(r.trip_id as string) ?? null }
    if (k === "review") {
      const photos = (r.photos as string[] | null) ?? []
      return { ...base, text: (r.body as string) ?? "", media: photos[0] ?? null, where: `별점 ${r.rating ?? "-"}` }
    }
    if (k === "message")
      return {
        ...base,
        text: messageText(r),
        media: null,
        where: tripOf.get(r.trip_id as string) ?? null,
      }
    return {
      ...base,
      text: [r.place_name, r.memo].filter(Boolean).join(" — "),
      media: (r.image_url as string) ?? null,
      where: (r.address as string) ?? null,
    }
  })

  return items.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")).slice(0, limit)
}
