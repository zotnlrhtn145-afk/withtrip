import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/utils/supabase/server"

/**
 * 버그 신고 올리기.
 *
 * ⚠️ 예전엔 서버 액션으로 보냈다. 그런데 **새 배포가 올라가면 이전 화면의
 *    서버 액션 주소가 무효가 되어** 쓰던 사람이 "Load failed" 만 보고 글을
 *    못 보냈다(실제로 겪음 — 아이폰 사파리). 평범한 API 주소는 배포와 무관하게
 *    그대로 살아 있으므로 이 실패가 아예 생기지 않는다.
 *
 * ⚠️ 로그인 확인은 여기서도 한다. 주소를 직접 두드릴 수 있는 창구다.
 */
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const c = await createClient()
  const { data: auth } = await c.auth.getUser()
  if (!auth.user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  let payload: {
    body?: string
    severity?: string
    platform?: string
    device?: string
    os_version?: string
    app_version?: string
    media?: { kind: string; path: string; bytes?: number }[]
  }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "내용을 읽지 못했습니다" }, { status: 400 })
  }

  const body = String(payload.body ?? "").trim()
  if (!body) return NextResponse.json({ error: "무슨 일이 있었는지 적어 주세요" }, { status: 400 })

  // 제목은 본문 첫 줄에서 뽑는다 — 같은 말을 두 번 쓰게 하지 않으려고
  const firstLine = body.split("\n").find((l) => l.trim()) ?? body
  const title = firstLine.trim().slice(0, 80) + (firstLine.trim().length > 80 ? "…" : "")

  const severity = ["low", "mid", "high"].includes(String(payload.severity)) ? String(payload.severity) : "mid"
  const platform = ["ios", "android", "web", "both"].includes(String(payload.platform))
    ? String(payload.platform)
    : "android"

  const { data: made, error } = await c
    .from("bug_reports")
    .insert({
      reporter_id: auth.user.id,
      title,
      body: body.slice(0, 4000),
      severity,
      platform,
      device: String(payload.device ?? "").trim().slice(0, 120) || null,
      os_version: String(payload.os_version ?? "").trim().slice(0, 60) || null,
      app_version: String(payload.app_version ?? "").trim().slice(0, 60) || null,
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: `보내지 못했습니다: ${error.message}` }, { status: 500 })

  const media = Array.isArray(payload.media) ? payload.media : []
  if (media.length > 0) {
    await c.from("bug_media").insert(
      media.map((m) => ({
        report_id: made.id,
        kind: m.kind === "video" ? "video" : "image",
        path: String(m.path),
        bytes: Number(m.bytes) || null,
      }))
    )
  }

  return NextResponse.json({ ok: true, id: made.id })
}
