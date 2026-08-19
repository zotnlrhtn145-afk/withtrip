"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import {
  ADMIN_COOKIE,
  SESSION_MAX_AGE,
  changePassword,
  issueSession,
  verifyLogin,
  verifySession,
} from "@/lib/admin-auth"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

/**
 * ⚠️ **문은 두 겹이다.** middleware 가 이미 `/_admin` 을 막지만,
 *    서버 액션은 주소를 직접 두드려 부를 수 있는 창구다. 그러니 값을 바꾸는
 *    동작은 **저마다 한 번 더 확인한다.** 확인 없이 통과하는 길이 하나라도
 *    있으면 나머지 자물쇠가 다 의미를 잃는다.
 */
async function assertAdmin() {
  const jar = await cookies()
  if (!(await verifySession(jar.get(ADMIN_COOKIE)?.value))) redirect("/_admin/login")
}

function db() {
  const c = getSupabaseAdmin()
  if (!c) throw new Error("SUPABASE_SERVICE_ROLE_KEY 가 없습니다")
  return c
}

/** 들어오는 시도를 늦춘다 — 비밀번호를 기계로 하나씩 넣어 보는 걸 막는다 */
const attempts = new Map<string, { n: number; until: number }>()

export async function loginAction(_prev: unknown, form: FormData): Promise<{ error?: string }> {
  const user = String(form.get("user") ?? "")
  const password = String(form.get("password") ?? "")

  const key = "admin-login"
  const rec = attempts.get(key)
  const now = Date.now()
  if (rec && rec.until > now) {
    const sec = Math.ceil((rec.until - now) / 1000)
    return { error: `너무 여러 번 틀렸습니다. ${sec}초 뒤에 다시 시도하세요.` }
  }

  if (!(await verifyLogin(user, password))) {
    const n = (rec?.n ?? 0) + 1
    // 5번부터는 틀릴 때마다 기다리는 시간이 두 배씩 늘어난다
    const wait = n >= 5 ? Math.min(2 ** (n - 4), 60) * 1000 : 0
    attempts.set(key, { n, until: now + wait })
    // ⚠️ **무엇이 틀렸는지 알려주지 않는다.** "아이디가 없습니다"는
    //    아이디를 하나씩 넣어 보며 맞는 걸 찾게 해 준다.
    return { error: "아이디 또는 비밀번호가 맞지 않습니다." }
  }

  attempts.delete(key)
  const session = await issueSession()
  if (!session) return { error: "로그인 정보를 읽지 못했습니다. 잠시 뒤 다시 시도하세요." }

  const jar = await cookies()
  jar.set(ADMIN_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })
  redirect("/_admin")
}

export async function logoutAction() {
  const jar = await cookies()
  jar.delete(ADMIN_COOKIE)
  redirect("/_admin/login")
}

/** 글 가리기 / 되돌리기 */
export async function toggleHideAction(form: FormData) {
  await assertAdmin()
  const kind = String(form.get("kind") ?? "")
  const id = String(form.get("id") ?? "")
  const hidden = String(form.get("hidden") ?? "") === "1"
  if (!kind || !id) return

  if (hidden) {
    await db().from("content_hides").delete().eq("kind", kind).eq("target_id", id)
  } else {
    await db()
      .from("content_hides")
      .upsert(
        { kind, target_id: id, reason: String(form.get("reason") ?? "") || null, hidden_by: "admin" },
        { onConflict: "kind,target_id" }
      )
  }
  revalidatePath("/_admin/content")
}

/**
 * 정말로 지우기.
 *
 * ⚠️ 되돌릴 수 없다. **가리기로 될 일은 가리기로 한다** — 지우기는
 *    저작권 침해나 개인정보처럼 남겨 두면 안 되는 것에만 쓴다.
 */
export async function deleteContentAction(form: FormData) {
  await assertAdmin()
  const kind = String(form.get("kind") ?? "")
  const id = String(form.get("id") ?? "")
  if (!kind || !id) return

  const table: Record<string, string> = {
    clip: "trip_clips",
    review: "place_reviews",
    place: "saved_places",
    message: "trip_messages",
  }
  const t = table[kind]
  if (!t) return

  if (kind === "message") {
    // 대화는 통째로 지우면 앞뒤 맥락이 끊긴다 — 앱과 같은 방식(deleted_at)으로 지운다
    await db().from(t).update({ deleted_at: new Date().toISOString() }).eq("id", id)
  } else {
    await db().from(t).delete().eq("id", id)
  }
  await db().from("content_hides").delete().eq("kind", kind).eq("target_id", id)
  revalidatePath("/_admin/content")
}

/** 매달 고정으로 나가는 돈 추가 */
export async function addRecurringAction(form: FormData) {
  await assertAdmin()
  const vendor = String(form.get("vendor") ?? "").trim()
  const label = String(form.get("label") ?? "").trim()
  const amount = Number(form.get("amount") ?? 0)
  const currency = String(form.get("currency") ?? "USD")
  if (!vendor || !label || !amount) return

  await db().from("admin_recurring").insert({ vendor, label, amount, currency })
  revalidatePath("/_admin/costs")
}

/** 해지한 항목 끊기 */
export async function endRecurringAction(form: FormData) {
  await assertAdmin()
  const id = String(form.get("id") ?? "")
  if (!id) return
  await db()
    .from("admin_recurring")
    .update({ ended_on: new Date().toISOString().slice(0, 10) })
    .eq("id", id)
  revalidatePath("/_admin/costs")
}

/** 청구서에서 본 실제 금액 적기 — 추정치를 덮어쓴다 */
export async function setActualCostAction(form: FormData) {
  await assertAdmin()
  const month = String(form.get("month") ?? "")
  const vendor = String(form.get("vendor") ?? "").trim()
  const label = String(form.get("label") ?? "").trim() || null
  const amount = Number(form.get("amount") ?? 0)
  const currency = String(form.get("currency") ?? "USD")
  if (!month || !vendor) return

  await db()
    .from("admin_costs")
    .upsert(
      { month, vendor, label, amount, currency, source: "invoice", updated_at: new Date().toISOString() },
      { onConflict: "month,vendor,label" }
    )
  revalidatePath("/_admin/costs")
}

/** 신고 처리 상태 바꾸기 */
export async function resolveReportAction(form: FormData) {
  await assertAdmin()
  const id = String(form.get("id") ?? "")
  const status = String(form.get("status") ?? "")
  if (!id || !["open", "reviewing", "actioned", "dismissed"].includes(status)) return

  await db().from("reports").update({ status }).eq("id", id)
  revalidatePath("/_admin/reports")
}

/**
 * 신고된 글을 가리고 신고도 함께 처리완료로 넘긴다.
 *
 * ⚠️ 둘을 따로 누르게 하면 **가려 놓고 신고는 열린 채로 남는다.** 다음에 열어
 *    보면 이미 처리한 건이 또 쌓여 있어서, 무엇이 남은 일인지 알 수 없게 된다.
 */
export async function hideAndResolveAction(form: FormData) {
  await assertAdmin()
  const id = String(form.get("id") ?? "")
  const kind = String(form.get("kind") ?? "")
  const targetId = String(form.get("targetId") ?? "")
  const reason = String(form.get("reason") ?? "") || null

  if (kind && targetId) {
    await db()
      .from("content_hides")
      .upsert({ kind, target_id: targetId, reason, hidden_by: "admin" }, { onConflict: "kind,target_id" })
  }
  if (id) await db().from("reports").update({ status: "actioned" }).eq("id", id)
  revalidatePath("/_admin/reports")
}

/**
 * 사용자 이용 정지 / 해제.
 *
 * ⚠️ **지우지 않고 정지한다.** 계정을 지우면 그 사람이 쓴 여행·정산이 같이
 *    무너져서, 같은 방에 있던 다른 사람들까지 피해를 본다.
 *    정지는 로그인만 막고 자료는 그대로 둔다 — 잘못 눌러도 되돌릴 수 있다.
 */
export async function banUserAction(form: FormData) {
  await assertAdmin()
  const userId = String(form.get("userId") ?? "")
  const unban = String(form.get("unban") ?? "") === "1"
  if (!userId) return

  await db().auth.admin.updateUserById(userId, {
    // "none" 이 해제. 100년이면 사실상 영구지만 언제든 되돌릴 수 있다
    ban_duration: unban ? "none" : "876000h",
  })
  revalidatePath("/_admin/reports")
  revalidatePath("/_admin/users")
}

/**
 * 비밀번호 바꾸기.
 *
 * ⚠️ 지금 비밀번호를 **다시 한 번 확인한다.** 자리를 비운 사이 누가 열린 화면을
 *    만지면, 확인이 없을 경우 비밀번호를 바꿔 나를 잠가 버릴 수 있다.
 */
export async function changePasswordAction(
  _prev: unknown,
  form: FormData
): Promise<{ error?: string; ok?: boolean }> {
  await assertAdmin()
  const current = String(form.get("current") ?? "")
  const next = String(form.get("next") ?? "")
  const again = String(form.get("again") ?? "")

  if (next.length < 10) return { error: "새 비밀번호는 10자 이상으로 해주세요." }
  if (next !== again) return { error: "새 비밀번호 두 칸이 서로 다릅니다." }
  if (!(await verifyLogin("admin", current))) return { error: "지금 비밀번호가 맞지 않습니다." }

  if (!(await changePassword(next))) return { error: "저장하지 못했습니다. 잠시 뒤 다시 시도하세요." }

  // 서명 열쇠가 바뀌었으니 지금 내 쿠키도 더는 안 통한다 — 다시 로그인시킨다
  const jar = await cookies()
  jar.delete(ADMIN_COOKIE)
  redirect("/_admin/login")
}

/**
 * 전체 공지 보내기.
 *
 * ⚠️ **되돌릴 수 없다.** 한 번 나간 푸시는 회수가 안 된다. 그래서 화면에서
 *    받는 사람 수를 먼저 보여 주고, 한 번 더 확인한 뒤에 부른다.
 *
 * ⚠️ 알림함에도 한 줄 남긴다. 푸시는 잠금화면에서 쓸어 넘기면 사라져서,
 *    푸시만 보내면 **못 본 사람은 영영 못 본다.**
 */
export async function sendAnnouncementAction(
  _prev: unknown,
  form: FormData
): Promise<{ error?: string; sent?: number }> {
  await assertAdmin()
  const message = String(form.get("message") ?? "").trim()
  const confirm = String(form.get("confirm") ?? "")
  if (!message) return { error: "보낼 내용을 적어 주세요." }
  if (message.length > 300) return { error: "300자 안쪽으로 줄여 주세요. 푸시는 길면 잘립니다." }
  if (confirm !== "보내기") return { error: "확인란에 '보내기'라고 그대로 적어 주세요." }

  const c = db()
  const { data: list, error } = await c.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) return { error: `받는 사람을 읽지 못했습니다: ${error.message}` }

  const now = Date.now()
  const targets = list.users.filter((u) => {
    // 정지된 사람에게는 보내지 않는다
    const until = (u as unknown as { banned_until?: string }).banned_until
    return !(until && new Date(until).getTime() > now)
  })
  if (targets.length === 0) return { error: "받을 사람이 없습니다." }

  /*
    ⚠️ 한 줄씩 넣지 않는다. 사람이 늘수록 왕복이 그만큼 늘어나서, 중간에
       끊기면 **일부만 받은 상태**로 남는다. 한 번에 넣는다.
  */
  const rows = targets.map((u) => ({
    user_id: u.id,
    type: "announcement",
    message,
    status: "dismissed" as const,
    is_read: false,
    payload: { title: "위드트립 공지" },
  }))

  const { error: insErr } = await c.from("notifications").insert(rows)
  if (insErr) return { error: `보내지 못했습니다: ${insErr.message}` }

  revalidatePath("/_admin/announce")
  return { sent: rows.length }
}
