// WITHTRIP: 새 채팅 메시지가 생기면 여행 참여자들에게 Expo 푸시 발송.
// Supabase Database Webhook(trip_messages INSERT)에서 이 함수를 호출한다.
//
// 배포:  supabase functions deploy send-chat-push
// 웹훅:  트리거 wt_push_trip_chat 이 이미 붙어 있다.
//
// 환경변수(SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)는 Edge 런타임이 자동 주입.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type MessageRow = {
  id: string
  trip_id: string
  user_id: string
  content: string
  kind?: string | null
  deleted_at?: string | null
}

/**
 * 알림에 보일 한 줄.
 *
 * ⚠️ 예전엔 content 를 그대로 썼다. 그래서 이모티콘 메시지가
 *    `[emoticon:coding]` 이라는 코드로 알림에 떴다. 사진·투표도 마찬가지였다.
 */
function previewOf(kind: string | null | undefined, content: string): string {
  const k = (kind ?? "text").trim()
  if (k === "image") return "사진을 보냈습니다"
  if (k === "location") return "위치를 공유했습니다"
  if (k === "vote") return content.replace(/^투표:\s*/, "투표: ").slice(0, 120)
  if (/^\[emoticon:/.test(content)) return "이모티콘을 보냈습니다"
  return (content ?? "").slice(0, 120)
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record: MessageRow | undefined = payload.record ?? payload.new
    if (!record?.trip_id || !record.user_id) {
      return new Response(JSON.stringify({ ok: false, reason: "no record" }), { status: 200 })
    }
    if (record.deleted_at) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "deleted" }), { status: 200 })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 여행 제목 + 소유자 / 멤버 / 알림 끈 사람 / 보낸 사람 닉네임
    const [tripRes, membersRes, mutesRes, senderRes] = await Promise.all([
      supabase.from("trips").select("user_id, title").eq("id", record.trip_id).maybeSingle(),
      supabase
        .from("trip_members")
        .select("user_id")
        .eq("trip_id", record.trip_id)
        .eq("status", "accepted"),
      supabase.from("trip_chat_mutes").select("user_id").eq("trip_id", record.trip_id),
      supabase.from("profiles").select("nickname").eq("id", record.user_id).maybeSingle(),
    ])

    const trip = tripRes.data as { user_id?: string; title?: string } | null

    // ⚠️ 여행을 만든 사람은 trip_members 에 행이 없다 — 소유자를 따로 넣어야 한다
    const recipientIds = new Set<string>()
    if (trip?.user_id) recipientIds.add(trip.user_id)
    for (const m of membersRes.data ?? []) recipientIds.add(m.user_id as string)
    recipientIds.delete(record.user_id) // 보낸 사람 본인 제외

    if (recipientIds.size === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 })
    }

    const muted = new Set((mutesRes.data ?? []).map((x) => x.user_id as string))

    // @멘션된 사람은 알림을 꺼놨어도 받는다 (카톡과 동일 — 놓치면 안 되는 호출이므로)
    const mentioned = new Set<string>()
    const nicks = [...String(record.content ?? "").matchAll(/@([^\s@]+)/g)].map((x) => x[1])
    if (nicks.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("nickname", nicks)
      for (const p of profs ?? []) mentioned.add(p.id as string)
    }

    const targets = [...recipientIds].filter((id) => !muted.has(id) || mentioned.has(id))
    if (targets.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "all muted" }), { status: 200 })
    }

    const { data: tokenRows } = await supabase
      .from("device_push_tokens")
      .select("user_id, token")
      .in("user_id", targets)

    const rows = (tokenRows ?? []).filter(
      (t) => typeof t.token === "string" && (t.token as string).startsWith("ExponentPushToken")
    )
    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no tokens" }), { status: 200 })
    }

    // 뱃지 — 그 사람이 이 방에서 아직 안 읽은 메시지 수
    const badgeOf = new Map<string, number>()
    await Promise.all(
      targets.map(async (uid) => {
        const { data: read } = await supabase
          .from("trip_chat_reads")
          .select("last_read_at")
          .eq("trip_id", record.trip_id)
          .eq("user_id", uid)
          .maybeSingle()
        const since = (read as { last_read_at?: string } | null)?.last_read_at
        let q = supabase
          .from("trip_messages")
          .select("id", { count: "exact", head: true })
          .eq("trip_id", record.trip_id)
          .neq("user_id", uid)
          .is("deleted_at", null)
        if (since) q = q.gt("created_at", since)
        const { count } = await q
        badgeOf.set(uid, count ?? 1)
      })
    )

    const title = trip?.title ? String(trip.title) : "새 메시지"
    const senderName = String((senderRes.data as { nickname?: string } | null)?.nickname ?? "").trim()
    const preview = previewOf(record.kind, record.content)

    const messages = rows.map((t) => {
      const uid = t.user_id as string
      const isMention = mentioned.has(uid)
      return {
        to: t.token as string,
        sound: "default",
        title,
        // 누가 보냈는지 알아야 여러 명 방에서 의미가 있다
        body: `${senderName ? `${senderName}: ` : ""}${isMention ? `@나 ${preview}` : preview}`,
        badge: badgeOf.get(uid) ?? 1,
        data: { type: "chat", tripId: record.trip_id, messageId: record.id },
        channelId: "chat",
        // 같은 방 알림이 여러 개 쌓이지 않게 묶는다 (카톡과 동일)
        collapseId: `trip-${record.trip_id}`,
      }
    })

    // Expo Push API는 요청당 100개까지 → 100개씩 배치
    for (let i = 0; i < messages.length; i += 100) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages.slice(i, i + 100)),
      })
    }

    return new Response(JSON.stringify({ ok: true, sent: messages.length }), { status: 200 })
  } catch (error) {
    console.error("[send-chat-push]", error)
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 200 })
  }
})
