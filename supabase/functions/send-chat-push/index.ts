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

function previewOf(kind: string | null | undefined, content: string): string {
  const k = (kind ?? "text").trim()
  if (k === "image") return "사진을 보냈습니다"
  if (k === "location") return "위치를 공유했습니다"
  if (k === "vote") return content.replace(/^투표:\s*/, "투표: ").slice(0, 120)
  if (/^\[emoticon:/.test(content)) return emoticonText(content)
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

    /**
     * 알림 제목.
     *
     * ⚠️ 예전엔 여행 제목이 비면 그냥 **"새 메시지"** 였다. 제목 없는 단톡방이
     *    적지 않아서, 알림만 보고는 **누가 어디서 보냈는지 알 수 없었다.**
     *    여행 제목 → 없으면 보낸 사람 이름 → 그것도 없을 때만 "새 메시지".
     */
    const senderName = String((senderRes.data as { nickname?: string } | null)?.nickname ?? "").trim()
    const title = trip?.title
      ? String(trip.title)
      : senderName
        ? senderName
        : "새 메시지"
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
