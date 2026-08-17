// WITHTRIP: 새 DM(dm_messages)이 생기면 상대방에게 Expo 푸시 발송.
// Supabase Database Webhook(dm_messages INSERT)에서 이 함수를 호출한다.
//
// 배포:  supabase functions deploy send-dm-push
// 웹훅:  Supabase Dashboard → Database → Webhooks → Create
//        - Table: public.dm_messages, Events: INSERT
//        - Type: Supabase Edge Function → send-dm-push
//
// 환경변수(SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)는 Edge 런타임이 자동 주입.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type DmMessageRow = {
  id: string
  thread_id: string
  sender_id: string
  content: string
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record: DmMessageRow | undefined = payload.record ?? payload.new
    if (!record?.thread_id || !record.sender_id) {
      return new Response(JSON.stringify({ ok: false, reason: "no record" }), { status: 200 })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 스레드에서 상대방(수신자) 찾기
    const { data: thread } = await supabase
      .from("dm_threads")
      .select("user_a, user_b")
      .eq("id", record.thread_id)
      .maybeSingle()

    if (!thread) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 })
    }

    const recipientId =
      thread.user_a === record.sender_id ? thread.user_b : thread.user_a
    if (!recipientId) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 })
    }

    /**
     * ⚠️ 이 방 알림을 껐으면 보내지 않는다.
     *    여행 대화방(trip_chat_mutes)에만 있던 처리인데 1:1 에는 빠져 있었다 —
     *    껐는데도 계속 울리면 끈 의미가 없다.
     */
    const { data: muted } = await supabase
      .from("dm_mutes")
      .select("user_id")
      .eq("thread_id", record.thread_id)
      .eq("user_id", recipientId)
      .maybeSingle()
    if (muted) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "muted" }), { status: 200 })
    }

    // 수신자의 기기 토큰
    const { data: tokenRows } = await supabase
      .from("device_push_tokens")
      .select("token")
      .eq("user_id", recipientId)

    const tokens = (tokenRows ?? [])
      .map((t) => t.token as string)
      .filter((t) => typeof t === "string" && t.startsWith("ExponentPushToken"))

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 })
    }

    // 보낸 사람 닉네임(제목에 활용)
    const { data: sender } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", record.sender_id)
      .maybeSingle()
    const senderName = String(sender?.nickname ?? "").trim() || "새 메시지"

    const body = (record.content ?? "").slice(0, 140)

    const messages = tokens.map((to) => ({
      to,
      sound: "default",
      title: senderName,
      body,
      data: { kind: "dm", threadId: record.thread_id },
    }))

    for (let i = 0; i < messages.length; i += 100) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages.slice(i, i + 100)),
      })
    }

    return new Response(JSON.stringify({ ok: true, sent: tokens.length }), { status: 200 })
  } catch (error) {
    console.error("[send-dm-push]", error)
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 200 })
  }
})
