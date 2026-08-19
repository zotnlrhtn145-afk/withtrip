import "server-only"

import { createClient } from "@/utils/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

/**
 * 버그 신고 게시판이 읽는 값들.
 *
 * ⚠️ 여기서는 **로그인한 사람의 자격으로** 읽는다(service_role 아님).
 *    그래야 "관리자만 볼 것"이 DB 정책으로 걸러진다 — 화면에서 숨기는 건
 *    주소를 직접 두드리면 뚫린다.
 */

export type BugRow = {
  id: string
  title: string
  body: string | null
  severity: "low" | "mid" | "high"
  platform: "ios" | "android" | "web" | "both"
  device: string | null
  app_version: string | null
  status: "new" | "seen" | "queued" | "fixing" | "resolved" | "wontfix"
  reporter_name: string
  is_mine: boolean
  note_count: number
  media_count: number
  has_video: boolean
  resolution: string | null
  shipped: boolean
  created_at: string
  resolved_at: string | null
}

export type Me = { id: string; email: string | null; name: string; isAdmin: boolean } | null

/** 지금 로그인한 사람 + 관리자인지 */
export async function whoAmI(): Promise<Me> {
  const c = await createClient()
  const { data } = await c.auth.getUser()
  const u = data.user
  if (!u) return null

  const { data: admin } = await c.rpc("is_bug_admin")
  const { data: prof } = await c.from("profiles").select("nickname").eq("id", u.id).maybeSingle()

  return {
    id: u.id,
    email: u.email ?? null,
    name: (prof?.nickname as string) || (u.email ?? "").split("@")[0] || "이름 없음",
    isAdmin: Boolean(admin),
  }
}

export type BugPage = { me: NonNullable<Me>; counts: Record<string, number>; rows: BugRow[] }

/**
 * 목록 화면이 쓰는 것 **전부를 한 번에**.
 *
 * ⚠️ 예전엔 로그인한 사람 · 관리자 여부 · 개수 · 목록을 따로 물었다. 운영에서는
 *    왕복 하나가 수백 ms 라 그게 그대로 느린 체감이 됐다. 한 번으로 줄인다.
 */
export async function loadBugPage(status: string | null): Promise<BugPage | null> {
  const c = await createClient()
  const { data: auth } = await c.auth.getUser()
  if (!auth.user) return null

  const { data, error } = await c.rpc("bug_page", { p_status: status, p_limit: 60 })
  if (error) throw new Error(error.message)
  const d = data as { me: { id: string; isAdmin: boolean; name: string }; counts: Record<string, number>; rows: BugRow[] }
  return {
    me: { id: d.me.id, email: auth.user.email ?? null, name: d.me.name, isAdmin: Boolean(d.me.isAdmin) },
    counts: d.counts ?? {},
    rows: d.rows ?? [],
  }
}

export async function listBugs(status: string | null): Promise<BugRow[]> {
  const c = await createClient()
  const { data, error } = await c.rpc("bug_list", { p_status: status, p_limit: 60 })
  if (error) throw new Error(error.message)
  return (data ?? []) as BugRow[]
}

export type BugDetail = BugRow & {
  verification: string | null
  reporter_id: string
  os_version: string | null
  notes: { id: string; body: string; created_at: string; author: string }[]
  media: { id: string; kind: "image" | "video"; path: string; url: string | null; purged: boolean }[]
  queue: { state: string; requested_at: string; error: string | null } | null
}

export async function getBug(id: string): Promise<BugDetail | null> {
  const c = await createClient()

  const { data: r } = await c.from("bug_reports").select("*").eq("id", id).maybeSingle()
  if (!r) return null

  const [{ data: notes }, { data: media }, { data: q }, { data: prof }] = await Promise.all([
    c.from("bug_notes").select("id,body,created_at,author_id").eq("report_id", id).order("created_at"),
    c.from("bug_media").select("id,kind,path,thumb_path,purged_at").eq("report_id", id).order("created_at"),
    c.from("bug_queue").select("state,requested_at,error").eq("report_id", id).maybeSingle(),
    c.from("profiles").select("id,nickname,email").eq("id", r.reporter_id as string).maybeSingle(),
  ])

  const authorIds = [...new Set((notes ?? []).map((n) => n.author_id as string))]
  const { data: authors } = authorIds.length
    ? await c.from("profiles").select("id,nickname,email").in("id", authorIds)
    : { data: [] }
  const nameOf = new Map(
    (authors ?? []).map((a) => [a.id as string, (a.nickname as string) || String(a.email ?? "").split("@")[0] || "관리자"])
  )

  /*
    ⚠️ 첨부는 비공개 저장소에 있다. 주소를 그대로 주면 안 열리므로
       **잠깐만 유효한 주소**를 만들어 준다. 새어 나가도 곧 쓸모없어진다.
  */
  const signed = await Promise.all(
    (media ?? []).map(async (m) => {
      const purged = Boolean(m.purged_at)
      if (purged && !m.thumb_path) {
        return { id: m.id as string, kind: m.kind as "image" | "video", path: m.path as string, url: null, purged }
      }
      const p = (purged ? (m.thumb_path as string) : (m.path as string)) ?? (m.path as string)
      const { data: s } = await c.storage.from("bug-media").createSignedUrl(p, 60 * 30)
      return {
        id: m.id as string,
        kind: m.kind as "image" | "video",
        path: p,
        url: s?.signedUrl ?? null,
        purged,
      }
    })
  )

  return {
    id: r.id as string,
    title: r.title as string,
    body: (r.body as string) ?? null,
    severity: r.severity as BugRow["severity"],
    platform: r.platform as BugRow["platform"],
    device: (r.device as string) ?? null,
    os_version: (r.os_version as string) ?? null,
    app_version: (r.app_version as string) ?? null,
    status: r.status as BugRow["status"],
    reporter_name: (prof?.nickname as string) || String(prof?.email ?? "").split("@")[0] || "알 수 없음",
    reporter_id: r.reporter_id as string,
    is_mine: false,
    note_count: (notes ?? []).length,
    media_count: (media ?? []).length,
    has_video: (media ?? []).some((m) => m.kind === "video"),
    resolution: (r.resolution as string) ?? null,
    verification: (r.verification as string) ?? null,
    shipped: Boolean(r.shipped),
    created_at: r.created_at as string,
    resolved_at: (r.resolved_at as string) ?? null,
    notes: (notes ?? []).map((n) => ({
      id: n.id as string,
      body: n.body as string,
      created_at: n.created_at as string,
      author: nameOf.get(n.author_id as string) ?? "관리자",
    })),
    media: signed,
    queue: q ? { state: q.state as string, requested_at: q.requested_at as string, error: (q.error as string) ?? null } : null,
  }
}

/** 탭에 붙는 숫자 */
export async function bugCounts(): Promise<Record<string, number>> {
  const c = getSupabaseAdmin()
  if (!c) return {}
  const { data } = await c.from("bug_reports").select("status")
  const n: Record<string, number> = { all: 0, open: 0, new: 0, queued: 0, fixing: 0, resolved: 0 }
  for (const r of (data ?? []) as { status: string }[]) {
    n.all++
    if (["new", "seen", "queued", "fixing"].includes(r.status)) n.open++
    if (r.status === "new") n.new++
    if (r.status === "queued") n.queued++
    if (r.status === "fixing") n.fixing++
    if (r.status === "resolved") n.resolved++
  }
  return n
}
