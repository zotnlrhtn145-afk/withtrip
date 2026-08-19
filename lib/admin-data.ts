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
 *
 * ⚠️ **한 번에 조금씩만 가져온다.** 예전엔 표 4개에서 150건씩 긁어 와서 첫 화면이
 *    느렸다. 검열은 위에서부터 훑는 일이라 아래쪽 100건은 대개 안 본다 —
 *    보이는 만큼만 가져오고 스크롤하면 이어서 준다.
 *
 * ⚠️ 기본은 **최근 한 달**이다. 오래된 글까지 매번 훑으면 표가 커질수록
 *    느려지는데, 검열에서 중요한 건 갓 올라온 글이다.
 */
export async function fetchContent(
  kind: ContentKind | "all",
  opts: {
    /** 한 번에 몇 건 */
    limit?: number
    /** 이 시각보다 **이전** 것만 (스크롤해서 더 볼 때 쓴다) */
    before?: string
    /** 며칠 치까지 볼 것인가 */
    days?: number
  } = {}
): Promise<ContentItem[]> {
  const limit = opts.limit ?? 15
  const days = opts.days ?? 30
  const c = db()
  const hidden = await fetchHiddenKeys()
  const want = (k: ContentKind) => kind === "all" || kind === k

  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  /*
    ⚠️ 표마다 `limit` 건씩 가져와서 합친 뒤 다시 자른다.
       표마다 limit/4 씩 가져오면 안 된다 — 한 종류만 몰려 있는 구간에서
       가져올 게 남았는데도 빈손으로 돌아와 목록이 끝난 것처럼 보인다.
  */
  const one = async (table: string, cols: string, extra?: (q: never) => never) => {
    let q = c.from(table).select(cols).gte("created_at", since)
    if (opts.before) q = q.lt("created_at", opts.before)
    if (table === "trip_messages") q = q.is("deleted_at", null)
    const { data } = await q.order("created_at", { ascending: false }).limit(limit)
    void extra
    return { data: (data ?? []) as unknown as Record<string, unknown>[] }
  }

  const [clips, reviews, messages, places] = await Promise.all([
    want("clip")
      ? one("trip_clips", "id,caption,media_url,media_type,created_at,user_id,trip_id")
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    want("review")
      ? one("place_reviews", "id,body,photos,rating,created_at,user_id,google_place_id")
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    want("message")
      ? one("trip_messages", "id,content,kind,created_at,user_id,trip_id,deleted_at")
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    want("place")
      ? one("saved_places", "id,place_name,memo,image_url,category,created_at,user_id,address")
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])

  type Row = Record<string, unknown>
  const rows = [
    ...((clips.data ?? []) as Row[]).map((r) => ({ kind: "clip" as const, r })),
    ...((reviews.data ?? []) as Row[]).map((r) => ({ kind: "review" as const, r })),
    ...((messages.data ?? []) as Row[]).map((r) => ({ kind: "message" as const, r })),
    ...((places.data ?? []) as Row[]).map((r) => ({ kind: "place" as const, r })),
  ]
    .sort((a, b) => String(b.r.created_at ?? "").localeCompare(String(a.r.created_at ?? "")))
    .slice(0, limit)

  if (rows.length === 0) return []

  // 글쓴이 이름과 여행 제목은 한 번에 몰아서 가져온다 (줄마다 조회하면 그만큼 왕복한다)
  const userIds = [...new Set(rows.map(({ r }) => r.user_id as string).filter(Boolean))]
  const tripIds = [...new Set(rows.map(({ r }) => r.trip_id as string).filter(Boolean))]
  const [{ data: profs }, { data: trips }] = await Promise.all([
    userIds.length ? c.from("profiles").select("id,nickname,email").in("id", userIds) : Promise.resolve({ data: [] }),
    tripIds.length ? c.from("trips").select("id,title").in("id", tripIds) : Promise.resolve({ data: [] }),
  ])
  const nameOf = new Map((profs ?? []).map((p) => [p.id as string, (p.nickname as string) || (p.email as string) || "이름 없음"]))
  const tripOf = new Map((trips ?? []).map((t) => [t.id as string, t.title as string]))

  return rows.map(({ kind: k, r }) => {
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
      return { ...base, text: messageText(r), media: null, where: tripOf.get(r.trip_id as string) ?? null }
    return {
      ...base,
      text: [r.place_name, r.memo].filter(Boolean).join(" — "),
      media: (r.image_url as string) ?? null,
      where: (r.address as string) ?? null,
    }
  })
}

export type Report = {
  id: string
  at: string
  reason: string
  detail: string | null
  /** "user" | "profile" | "dm_message" | "trip_message" | "saved_place" | "spot" */
  contentType: string
  contentId: string | null
  /** 신고 당시 글 내용 — 원본이 지워져도 무엇을 보고 신고했는지 남는다 */
  excerpt: string | null
  reporter: string
  target: string
  targetId: string | null
  status: string
  /** 이 글이 지금 가려져 있는가 */
  hidden: boolean
  /** 신고당한 사람이 여태 몇 번 신고됐나 — 한 번인지 상습인지 */
  targetReportCount: number
}

const REASON_LABEL: Record<string, string> = {
  spam: "스팸·광고",
  harassment: "욕설·괴롭힘",
  inappropriate: "부적절한 내용",
  hate: "혐오 발언",
  violence: "폭력·위협",
  illegal: "불법 정보",
  other: "기타",
}

export const CONTENT_TYPE_LABEL: Record<string, string> = {
  user: "사용자",
  profile: "프로필",
  dm_message: "1:1 대화",
  trip_message: "대화",
  saved_place: "맛집",
  spot: "스팟",
}

/**
 * 신고 내용은 **`content_hides` 의 종류 이름과 다르다.**
 * (신고는 `trip_message`, 가리기는 `message` 로 부른다)
 * 여기 한 곳에서만 옮겨 준다 — 화면마다 따로 바꾸면 언젠가 어긋난다.
 */
export function hideKindOf(contentType: string): string | null {
  switch (contentType) {
    case "trip_message":
      return "message"
    case "dm_message":
      return "dm"
    case "saved_place":
      return "place"
    case "spot":
      return "spot"
    default:
      // 사용자·프로필 신고는 가릴 글이 없다 — 사람에게 조치한다
      return null
  }
}

export function reasonLabel(reason: string): string {
  return REASON_LABEL[reason] ?? reason
}

export async function fetchReports(status: string | "all" = "open"): Promise<Report[]> {
  const c = db()
  let q = c.from("reports").select("*").order("created_at", { ascending: false }).limit(200)
  if (status !== "all") q = q.eq("status", status)
  const { data, error } = await q
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Record<string, unknown>[]
  if (rows.length === 0) return []

  const ids = [
    ...new Set(rows.flatMap((r) => [r.reporter_id as string, r.target_user_id as string]).filter(Boolean)),
  ]
  const [{ data: profs }, { data: hides }, { data: allTargets }] = await Promise.all([
    c.from("profiles").select("id,nickname,email").in("id", ids),
    c.from("content_hides").select("kind,target_id"),
    // 상습인지 보려면 처리한 것까지 포함해 전부 세어야 한다
    c.from("reports").select("target_user_id"),
  ])

  const nameOf = new Map(
    (profs ?? []).map((p) => [p.id as string, (p.nickname as string) || (p.email as string) || "이름 없음"])
  )
  const hidden = new Set((hides ?? []).map((h) => `${h.kind}:${h.target_id}`))
  const perTarget = new Map<string, number>()
  for (const r of (allTargets ?? []) as { target_user_id: string }[]) {
    if (r.target_user_id) perTarget.set(r.target_user_id, (perTarget.get(r.target_user_id) ?? 0) + 1)
  }

  return rows.map((r) => {
    const contentType = r.content_type as string
    const kind = hideKindOf(contentType)
    const contentId = (r.content_id as string) ?? null
    return {
      id: r.id as string,
      at: r.created_at as string,
      reason: reasonLabel(r.reason as string),
      detail: (r.detail as string) ?? null,
      contentType,
      contentId,
      excerpt: (r.content_excerpt as string) ?? null,
      reporter: nameOf.get(r.reporter_id as string) ?? "알 수 없음",
      target: nameOf.get(r.target_user_id as string) ?? "알 수 없음",
      targetId: (r.target_user_id as string) ?? null,
      status: (r.status as string) ?? "open",
      hidden: Boolean(kind && contentId && hidden.has(`${kind}:${contentId}`)),
      targetReportCount: perTarget.get(r.target_user_id as string) ?? 0,
    }
  })
}

/** 지금 정지된 사람들 */
export async function fetchBannedIds(): Promise<Set<string>> {
  const { data } = await db().auth.admin.listUsers({ page: 1, perPage: 1000 })
  const now = Date.now()
  const out = new Set<string>()
  for (const u of data?.users ?? []) {
    // banned_until 이 미래면 정지 중
    const until = (u as unknown as { banned_until?: string }).banned_until
    if (until && new Date(until).getTime() > now) out.add(u.id)
  }
  return out
}
