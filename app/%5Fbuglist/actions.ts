"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/utils/supabase/server"

/**
 * ⚠️ 여기 모든 동작은 **로그인한 사람의 자격으로** DB 를 만진다.
 *    service_role 로 하면 RLS 를 지나가 버려서, "관리자만" 이 코드 실수 하나로
 *    무너진다. 통제는 DB 정책 한 곳에 두고 여기서는 그 힘을 빌리지 않는다.
 */

async function client() {
  const c = await createClient()
  const { data } = await c.auth.getUser()
  if (!data.user) redirect("/_buglist/login")
  return { c, uid: data.user.id }
}

async function assertAdmin() {
  const { c, uid } = await client()
  const { data } = await c.rpc("is_bug_admin")
  if (!data) throw new Error("관리자만 할 수 있습니다")
  return { c, uid }
}

/** 신고 올리기 — 첨부는 화면에서 먼저 올리고 경로만 넘어온다 */
export async function createBugAction(form: FormData): Promise<void> {
  const { c, uid } = await client()

  const body = String(form.get("body") ?? "").trim()
  if (!body) throw new Error("무슨 일이 있었는지 적어 주세요")

  /*
    제목은 본문 **첫 줄**에서 뽑는다. 쓰는 사람에게 같은 말을 두 번 시키지 않으려는 것.
    첫 줄이 너무 길면 잘라서 목록이 읽히게 한다.
  */
  const firstLine = body.split("\n").find((l) => l.trim()) ?? body
  const title = firstLine.trim().slice(0, 80) + (firstLine.trim().length > 80 ? "…" : "")

  const severity = String(form.get("severity") ?? "mid")
  const platform = String(form.get("platform") ?? "android")

  const { data: made, error } = await c
    .from("bug_reports")
    .insert({
      reporter_id: uid,
      title,
      body: body.slice(0, 4000),
      severity: ["low", "mid", "high"].includes(severity) ? severity : "mid",
      platform: ["ios", "android", "web", "both"].includes(platform) ? platform : "android",
      device: String(form.get("device") ?? "").trim().slice(0, 120) || null,
      os_version: String(form.get("os_version") ?? "").trim().slice(0, 60) || null,
      app_version: String(form.get("app_version") ?? "").trim().slice(0, 60) || null,
    })
    .select("id")
    .single()

  if (error) throw new Error(`보내지 못했습니다: ${error.message}`)

  /*
    첨부는 화면에서 이미 저장소에 올려 두고 경로만 넘어온다.
    ⚠️ 신고를 만든 **뒤에** 이어 붙인다 — 먼저 붙이려면 report_id 가 없다.
  */
  const paths = String(form.get("media") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)

  if (paths.length > 0) {
    await c.from("bug_media").insert(
      paths.map((line) => {
        const [kind, path, bytes] = line.split("|")
        return {
          report_id: made.id,
          kind: kind === "video" ? "video" : "image",
          path,
          bytes: Number(bytes) || null,
        }
      })
    )
  }

  revalidatePath("/_buglist")
  // 보낸 뒤에는 상세가 아니라 **내가 쓴 글 목록**으로 — 방금 올린 게 목록에 있는 걸 본다
  redirect("/_buglist?s=mine")
}

/**
 * 메모 남기기.
 *
 * ⚠️ **저장만 한다.** 예전 설계에서는 여기서 바로 수정 요청까지 나갔는데,
 *    메모는 생각을 정리하며 여러 번 쓰는 것이라 그때마다 요청이 나가면
 *    대기열이 엉킨다. 요청은 목록에서 골라서만 보낸다.
 */
export async function addNoteAction(form: FormData): Promise<void> {
  const { c, uid } = await assertAdmin()
  const reportId = String(form.get("id") ?? "")
  const body = String(form.get("body") ?? "").trim()
  if (!reportId || !body) return

  await c.from("bug_notes").insert({ report_id: reportId, author_id: uid, body: body.slice(0, 4000) })

  // 아직 아무도 안 본 글이었다면 "확인함"으로 올린다 — 메모를 달았다는 건 읽었다는 뜻이다
  await c.from("bug_reports").update({ status: "seen", updated_at: new Date().toISOString() })
    .eq("id", reportId).eq("status", "new")

  revalidatePath(`/_buglist/${reportId}`)
  revalidatePath("/_buglist")
}

/** 안 고치기로 함 */
export async function wontfixAction(form: FormData): Promise<void> {
  const { c } = await assertAdmin()
  const id = String(form.get("id") ?? "")
  if (!id) return
  await c.from("bug_reports").update({ status: "wontfix", updated_at: new Date().toISOString() }).eq("id", id)
  await c.from("bug_queue").delete().eq("report_id", id)
  revalidatePath(`/_buglist/${id}`)
  revalidatePath("/_buglist")
}

/**
 * 고른 것들을 대기열에 넣는다.
 *
 * 이게 자동 처리의 시작점이다 — 여기 쌓인 것을 정해진 주기로 하나씩 읽어
 * 고치고, 처리 내용을 그 글에 되쓴다.
 */
export async function queueFixAction(form: FormData): Promise<void> {
  const { c, uid } = await assertAdmin()
  const ids = String(form.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  if (ids.length === 0) return

  /*
    ⚠️ 이미 줄 서 있는 건 다시 넣지 않는다(표에 unique 가 걸려 있다).
       `upsert` 로 조용히 넘긴다 — 두 번 눌렀다고 오류를 띄우면 당황스럽다.
  */
  await c.from("bug_queue").upsert(
    ids.map((id) => ({ report_id: id, requested_by: uid, state: "waiting" as const })),
    { onConflict: "report_id", ignoreDuplicates: true }
  )

  await c.from("bug_reports").update({ status: "queued", updated_at: new Date().toISOString() }).in("id", ids)

  revalidatePath("/_buglist")
}

/** 대기열에서 빼기 */
export async function unqueueAction(form: FormData): Promise<void> {
  const { c } = await assertAdmin()
  const id = String(form.get("id") ?? "")
  if (!id) return
  await c.from("bug_queue").delete().eq("report_id", id)
  await c.from("bug_reports").update({ status: "seen", updated_at: new Date().toISOString() })
    .eq("id", id).in("status", ["queued"])
  revalidatePath(`/_buglist/${id}`)
  revalidatePath("/_buglist")
}

/** 신고 지우기 (관리자) */
export async function deleteBugAction(form: FormData): Promise<void> {
  const { c } = await assertAdmin()
  const id = String(form.get("id") ?? "")
  if (!id) return
  await c.from("bug_reports").delete().eq("id", id)
  revalidatePath("/_buglist")
  redirect("/_buglist")
}

/** 내 신고 글 고치기 (관리자는 아무 글이나) */
export async function editBugAction(form: FormData): Promise<void> {
  const { c } = await client()
  const id = String(form.get("id") ?? "")
  const body = String(form.get("body") ?? "").trim()
  if (!id || !body) return

  const firstLine = body.split("\n").find((l) => l.trim()) ?? body
  const title = firstLine.trim().slice(0, 80) + (firstLine.trim().length > 80 ? "…" : "")

  /*
    ⚠️ 여기서 "내 글인지" 를 코드로 따지지 않는다. DB 정책이 이미 남의 글을
       못 고치게 막는다. 두 곳에서 따지면 언젠가 한쪽만 고치고 어긋난다.
       상태·처리내용은 트리거가 되돌리므로 신고자가 건드릴 수 없다.
  */
  await c.from("bug_reports").update({ title, body: body.slice(0, 4000), updated_at: new Date().toISOString() }).eq("id", id)
  revalidatePath(`/_buglist/${id}`)
  revalidatePath("/_buglist")
  redirect(`/_buglist/${id}`)
}

/** 내 신고 글 지우기 (관리자는 아무 글이나) */
export async function deleteOwnBugAction(form: FormData): Promise<void> {
  const { c } = await client()
  const id = String(form.get("id") ?? "")
  if (!id) return
  await c.from("bug_reports").delete().eq("id", id)
  revalidatePath("/_buglist")
  redirect("/_buglist?s=mine")
}
