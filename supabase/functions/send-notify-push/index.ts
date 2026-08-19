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
  // ⚠️ 여기 없는 종류는 "새 알림"으로만 떴다. 실제로 쓰이는 것들을 채운다.
  place_recommendation: "맛집 추천",
  location_share: "위치 공유",
  schedule_added: "일정 등록",
  transport_added: "이동수단 등록",
  accommodation_added: "숙소 등록",
  expense_added: "지출 등록",
  settlement_done: "정산 완료",
  announcement: "위드트립 공지",
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

    /**
     * 알림 제목·내용.
     *
     * ⚠️ 제목은 **여행 이름**이 있으면 그걸 쓴다. "일정 등록 · 오수환" 보다
     *    "제주도 여행" / "오수환님이 일정을 등록했어요" 가 훨씬 빨리 읽힌다.
     * ⚠️ 내용은 알림을 만들 때 넣어 둔 message 를 쓰되, 비어 있으면
     *    **누가 무엇을 했는지**로 채운다 — "새 알림"만 뜨면 열어 봐야 안다.
     */
    const label = TITLE_BY_TYPE[record.type] ?? "새 알림"
    /**
     * ⚠️ `notifications` 에는 trip_id 칸이 **없다**(payload 에 들어오기도 한다).
     *    여행 이름은 대개 message 안에 이미 들어 있다 —
     *    "오정환님이 '고향투어'에 초대했습니다" 처럼.
     *    그래서 제목은 종류로 두고 **내용을 그대로 보여주는 데** 집중한다.
     */
    const payloadTitle = String(
      (record as { payload?: { tripTitle?: string } }).payload?.tripTitle ?? ""
    ).trim()
    const title = payloadTitle || (actorName ? `${label} · ${actorName}` : label)
    // 내용이 비면 "새 알림"만 뜨고 열어 봐야 안다 — 누가 무엇을 했는지로 채운다
    const fallback = actorName ? `${actorName}님의 ${label}` : label
    const body = (record.message ?? "").slice(0, 140) || fallback

    const messages = tokens.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      /*
        ⚠️ **tripId 를 실어 보낸다.** 앱은 이걸 보고 "일정이 등록됐어요" 같은 알림을
           누르면 알림함이 아니라 **그 여행으로 바로** 연다.
      */
      data: {
        kind: "notification",
        type: record.type,
        referenceId: record.reference_id,
        tripId:
          (record as { payload?: { tripId?: string } }).payload?.tripId ?? undefined,
      },
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
