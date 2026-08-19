
/**
 * 이모티콘 코드 → 이름표.
 *
 * ⚠️ 푸시에는 그림을 넣을 수 없다. 그렇다고 코드를 그대로 두면
 *    `[emoticon:bv1_abs]` 같은 **파일명이 알림에 뜬다**(신고받음).
 *    무엇을 보냈는지 알 수 있게 이름표를 보여 준다.
 *
 * ⚠️ 이 표는 앱의 `src/lib/emoticons.ts` 에서 뽑아 온 것이다.
 *    이모티콘을 새로 넣으면 여기도 같이 채워야 한다 —
 *    빠지면 그 이모티콘만 "이모티콘" 으로 밋밋하게 뜬다(깨지지는 않는다).
 */
const EMOTICON_LABEL: Record<string, string> = {
  "mg1_hello": "안녕",
  "mg1_happy": "행복",
  "mg1_sad": "슬퍼",
  "mg1_gasp": "헉!",
  "mg1_shiver": "ㄷㄷㄷ",
  "mg1_sick": "아파",
  "mg1_shh": "쉿!",
  "mg1_dunno": "모르겠어",
  "mg1_sleepy": "졸려",
  "mg2_congrats": "축하",
  "mg2_fluster": "당황",
  "mg2_shy": "부끄",
  "mg2_bored": "심심",
  "mg2_walk": "뚜벅뚜벅",
  "mg2_wow": "대박",
  "mg2_unfair": "억울",
  "mg2_secret": "비밀",
  "mg2_thumbsup": "따봉",
  "mg3_anxious": "불안",
  "mg3_angry": "화남",
  "mg3_excited": "신남",
  "mg3_flutter": "설렘",
  "mg3_what": "뭐라고?!",
  "mg3_bored": "심심",
  "mg3_annoyed": "짜증",
  "mg3_shock": "충격",
  "mg3_expect": "기대",
  "sb1_go": "가자!",
  "sb1_angry": "개빡쳐!",
  "sb1_hello": "안녕~",
  "sb1_lonely": "외로워요",
  "sb1_love": "사랑해",
  "sb1_omg": "헐...?",
  "sb1_excited": "완전 기대!",
  "sb1_sleep": "쿨쿨...",
  "sb1_sleepy": "졸려요",
  "bv1_abs": "복근!",
  "bv1_press": "밀리터리 프레스!",
  "bv1_deadlift": "데드리프트!",
  "bv1_pushup": "푸쉬업!",
  "bv1_running": "런닝!",
  "bv1_pullup": "턱걸이!",
  "bv1_squat": "스쿼트!",
  "bv1_stretch": "스트레칭!",
  "bv1_dumbbell": "덤벨 킬!",
  "bv1_legraise": "레그 레이즈!",
  "think2": "고민",
  "stand1": "기본",
  "coding": "코딩",
}

/** `[emoticon:xxx]` 를 사람이 읽을 수 있는 말로 */
function emoticonText(content: string): string {
  const code = content.match(/^\[emoticon:([a-z0-9_]+)\]/i)?.[1] ?? ""
  const label = EMOTICON_LABEL[code]
  return label ? `(이모티콘) ${label}` : "(이모티콘)"
}

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

    /*
      ⚠️ 예전엔 내용을 그대로 썼다. 그래서 이모티콘을 보내면 알림에
         `[emoticon:bv1_abs]` 라는 **파일명이 그대로 떴다**(신고받음).
    */
    const raw = record.content ?? ""
    const body = (/^\[emoticon:/.test(raw) ? emoticonText(raw) : raw).slice(0, 140)

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
