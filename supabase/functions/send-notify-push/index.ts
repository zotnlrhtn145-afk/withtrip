// WITHTRIP: 새 알림(notifications)이 생기면 수신자에게 Expo 푸시 발송.
// 초대·친구요청·좋아요·댓글·새 클립 등 인박스 알림을 실기기로 밀어준다.
// Supabase Database Webhook(notifications INSERT)에서 이 함수를 호출한다.
//
// 배포:  supabase functions deploy send-notify-push
// 웹훅:  Supabase Dashboard → Database → Webhooks → Create
//        - Table: public.notifications, Events: INSERT
//        - Type: Supabase Edge Function → send-notify-push
//
// 환경변수(SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)는 Edge 런타임이 자동 주입.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type NotificationRow = {
  id: string
  user_id: string // 수신자
  actor_id: string | null // 발생시킨 사람
  sender_id: string | null
  type: string
  message: string
  reference_id: string | null
}

// 알림 타입별 제목
const TITLE_BY_TYPE: Record<string, string> = {
  trip_invite: "여행 초대",
  clip_invite: "여행클립 초대",
  friend_request: "친구 요청",
  friend_accepted: "친구 수락",
  clip_like: "새 좋아요",
  clip_comment: "새 댓글",
  clip_post: "새 클립",
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record: NotificationRow | undefined = payload.record ?? payload.new
    if (!record?.user_id) {
      return new Response(JSON.stringify({ ok: false, reason: "no record" }), { status: 200 })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 수신자의 기기 토큰
    const { data: tokenRows } = await supabase
      .from("device_push_tokens")
      .select("token")
      .eq("user_id", record.user_id)

    const tokens = (tokenRows ?? [])
      .map((t) => t.token as string)
      .filter((t) => typeof t === "string" && t.startsWith("ExponentPushToken"))

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 })
    }

    // 발생시킨 사람 닉네임(제목에 활용)
    const actorId = record.actor_id ?? record.sender_id
    let actorName = ""
    if (actorId) {
      const { data: actor } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", actorId)
        .maybeSingle()
      actorName = String(actor?.nickname ?? "").trim()
    }

    const label = TITLE_BY_TYPE[record.type] ?? "새 알림"
    const title = actorName ? `${label} · ${actorName}` : label
    const body = (record.message ?? "").slice(0, 140) || label

    const messages = tokens.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      data: { kind: "notification", type: record.type, referenceId: record.reference_id },
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
    console.error("[send-notify-push]", error)
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 200 })
  }
})
