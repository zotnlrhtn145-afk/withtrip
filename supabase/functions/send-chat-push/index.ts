// WITHTRIP: 새 채팅 메시지가 생기면 여행 참여자들에게 Expo 푸시 발송.
// Supabase Database Webhook(trip_messages INSERT)에서 이 함수를 호출한다.
//
// 배포:  supabase functions deploy send-chat-push
// 웹훅:  Supabase Dashboard → Database → Webhooks → Create
//        - Table: public.trip_messages, Events: INSERT
//        - Type: Supabase Edge Function → send-chat-push
//
// 환경변수(SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)는 Edge 런타임이 자동 주입.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type MessageRow = {
  id: string
  trip_id: string
  user_id: string
  content: string
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record: MessageRow | undefined = payload.record ?? payload.new
    if (!record?.trip_id || !record.user_id) {
      return new Response(JSON.stringify({ ok: false, reason: "no record" }), { status: 200 })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 여행 제목 + 소유자
    const { data: trip } = await supabase
      .from("trips")
      .select("user_id, title")
      .eq("id", record.trip_id)
      .maybeSingle()

    // 수락된 멤버
    const { data: members } = await supabase
      .from("trip_members")
      .select("user_id")
      .eq("trip_id", record.trip_id)
      .eq("status", "accepted")

    // 발신자를 제외한 참여자 집합
    const recipientIds = new Set<string>()
    if (trip?.user_id) recipientIds.add(trip.user_id)
    for (const m of members ?? []) recipientIds.add(m.user_id as string)
    recipientIds.delete(record.user_id)

    if (recipientIds.size === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 })
    }

    // 참여자들의 기기 토큰
    const { data: tokenRows } = await supabase
      .from("device_push_tokens")
      .select("token")
      .in("user_id", [...recipientIds])

    const tokens = (tokenRows ?? [])
      .map((t) => t.token as string)
      .filter((t) => typeof t === "string" && t.startsWith("ExponentPushToken"))

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 })
    }

    const title = trip?.title ? String(trip.title) : "새 메시지"
    const body = record.content?.slice(0, 120) ?? ""

    const messages = tokens.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      data: { tripId: record.trip_id },
    }))

    // Expo Push API는 요청당 100개까지 → 100개씩 배치
    for (let i = 0; i < messages.length; i += 100) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages.slice(i, i + 100)),
      })
    }

    return new Response(JSON.stringify({ ok: true, sent: tokens.length }), { status: 200 })
  } catch (error) {
    console.error("[send-chat-push]", error)
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 200 })
  }
})
