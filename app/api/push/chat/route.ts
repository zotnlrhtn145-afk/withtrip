import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

/**
 * POST /api/push/chat  — 새 대화 메시지를 참여자에게 푸시로 알린다.
 *
 * DB 트리거(pg_net)가 메시지가 들어오는 즉시 부른다.
 * **앱이 꺼져 있어도 확실히 가야 하므로** 보내는 사람의 앱이 아니라 DB 가 부른다.
 *
 * 카카오톡과 같은 규칙:
 *  - 보낸 사람 본인에게는 안 보낸다
 *  - 알림을 끈 방은 건너뛴다
 *  - 단, **@멘션은 알림을 꺼놨어도 보낸다** (놓치면 안 되는 호출이므로)
 *  - 제목은 방 이름, 본문은 "닉네임: 내용"
 *  - 사진·투표·위치는 내용 대신 종류를 적는다
 *  - 뱃지에는 그 사람이 아직 안 읽은 메시지 총 개수를 넣는다
 */

const EXPO_PUSH = "https://exp.host/--/api/v2/push/send"
/** Expo 는 한 번에 100건까지 받는다 */
const CHUNK = 100

type Row = { user_id: string; token: string }

/** 메시지 종류에 따라 알림에 보일 한 줄 */
function previewOf(kind: string | null, content: string): string {
  const k = (kind ?? "text").trim()
  if (k === "image") return "사진을 보냈습니다"
  if (k === "location") return "위치를 공유했습니다"
  if (k === "vote") return content.replace(/^투표:\s*/, "투표: ")
  // 이모티콘은 코드가 그대로 보이면 안 된다
  if (/^\[emoticon:/.test(content)) return "이모티콘을 보냈습니다"
  return content
}

export async function POST(req: Request) {
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: "server not configured" }, { status: 500 })

  try {
    // DB 트리거는 { record: {...} } 로, 수동 호출은 { messageId } 로 온다
    const body = (await req.json()) as {
      record?: { id?: string }
      messageId?: string
      secret?: string
    }
    const messageId = String(body.record?.id ?? body.messageId ?? "").trim()
    if (!messageId) return NextResponse.json({ error: "messageId required" }, { status: 400 })

    // 아무나 남의 방에 알림을 쏘지 못하게 막는다
    const expected = (process.env.PUSH_HOOK_SECRET ?? "").trim()
    if (expected) {
      const given = (req.headers.get("x-push-secret") ?? body.secret ?? "").trim()
      if (given !== expected) return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    const { data: msg } = await admin
      .from("trip_messages")
      .select("id, trip_id, user_id, content, kind, deleted_at")
      .eq("id", messageId)
      .maybeSingle()
    const m = msg as
      | { id: string; trip_id: string; user_id: string; content: string; kind: string | null; deleted_at: string | null }
      | null
    if (!m || m.deleted_at) return NextResponse.json({ skipped: "no message" })

    // 방 이름 + 보낸 사람 + 참여자(소유자 포함) + 알림 끈 사람
    const [tripRes, senderRes, membersRes, mutesRes] = await Promise.all([
      admin.from("trips").select("title, user_id").eq("id", m.trip_id).maybeSingle(),
      admin.from("profiles").select("nickname").eq("id", m.user_id).maybeSingle(),
      admin.from("trip_members").select("user_id").eq("trip_id", m.trip_id),
      admin.from("trip_chat_mutes").select("user_id").eq("trip_id", m.trip_id),
    ])

    const trip = tripRes.data as { title: string | null; user_id: string } | null
    const senderName =
      ((senderRes.data as { nickname: string | null } | null)?.nickname ?? "").trim() || "알 수 없음"

    // ⚠️ 여행을 만든 사람은 trip_members 에 행이 없다 — 소유자를 따로 넣어야 한다
    const audience = new Set<string>()
    if (trip?.user_id) audience.add(trip.user_id)
    for (const x of (membersRes.data as { user_id: string }[]) ?? []) audience.add(x.user_id)
    audience.delete(m.user_id) // 보낸 사람 본인 제외
    if (audience.size === 0) return NextResponse.json({ sent: 0 })

    const muted = new Set(((mutesRes.data as { user_id: string }[]) ?? []).map((x) => x.user_id))

    // @멘션된 사람은 알림을 꺼놨어도 받는다 (카톡과 동일)
    const mentioned = new Set<string>()
    const nicks = [...(m.content.matchAll(/@([^\s@]+)/g))].map((x) => x[1])
    if (nicks.length > 0) {
      const { data: profs } = await admin
        .from("profiles")
        .select("id, nickname")
        .in("nickname", nicks)
      for (const p of (profs as { id: string; nickname: string }[]) ?? []) mentioned.add(p.id)
    }

    const targets = [...audience].filter((uid) => !muted.has(uid) || mentioned.has(uid))
    if (targets.length === 0) return NextResponse.json({ sent: 0, reason: "all muted" })

    const { data: tokenRows } = await admin
      .from("device_push_tokens")
      .select("user_id, token")
      .in("user_id", targets)
    const tokens = ((tokenRows as Row[]) ?? []).filter((t) => t.token?.startsWith("ExponentPushToken"))
    if (tokens.length === 0) return NextResponse.json({ sent: 0, reason: "no tokens" })

    // 뱃지 — 그 사람이 아직 안 읽은 메시지 수. 없으면 0.
    const badgeOf = new Map<string, number>()
    await Promise.all(
      targets.map(async (uid) => {
        const { data: read } = await admin
          .from("trip_chat_reads")
          .select("last_read_at")
          .eq("trip_id", m.trip_id)
          .eq("user_id", uid)
          .maybeSingle()
        const since = (read as { last_read_at?: string } | null)?.last_read_at
        const q = admin
          .from("trip_messages")
          .select("id", { count: "exact", head: true })
          .eq("trip_id", m.trip_id)
          .neq("user_id", uid)
          .is("deleted_at", null)
        const { count } = since ? await q.gt("created_at", since) : await q
        badgeOf.set(uid, count ?? 1)
      })
    )

    const title = (trip?.title ?? "").trim() || "여행 대화"
    const preview = previewOf(m.kind, m.content)
    const isMention = (uid: string) => mentioned.has(uid)

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: "default",
      title,
      body: `${senderName}: ${isMention(t.user_id) ? `@나 ${preview}` : preview}`,
      badge: badgeOf.get(t.user_id) ?? 1,
      // 탭했을 때 그 방으로 바로 들어가기 위한 정보
      data: { type: "chat", tripId: m.trip_id, messageId: m.id },
      // 같은 방 알림은 하나로 묶인다 (카톡처럼 방별로 쌓이지 않게)
      channelId: "chat",
      categoryId: "chat",
      collapseId: `trip-${m.trip_id}`,
    }))

    let sent = 0
    for (let i = 0; i < messages.length; i += CHUNK) {
      const chunk = messages.slice(i, i + CHUNK)
      try {
        const res = await fetch(EXPO_PUSH, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(chunk),
        })
        if (res.ok) sent += chunk.length
        else console.warn("[push/chat] expo error", res.status, (await res.text()).slice(0, 200))
      } catch (e) {
        console.warn("[push/chat] send failed:", e)
      }
    }

    return NextResponse.json({ sent, targets: targets.length })
  } catch (e) {
    console.error("[push/chat]", e)
    return NextResponse.json({ error: "unexpected" }, { status: 500 })
  }
}
