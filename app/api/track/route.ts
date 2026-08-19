import { createHash } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

/**
 * 방문 기록 한 줄.
 *
 * 웹과 앱이 **같은 곳으로** 보낸다 — 따로 세면 합계가 안 맞고,
 * "앱에서 어디를 많이 보는가"를 웹과 나란히 비교할 수 없다.
 *
 * ⚠️ **개인을 알아볼 수 있는 값은 저장하지 않는다.** IP 와 접속기기 문자열은
 *    그날치 소금과 함께 해시해서 앞 16자만 남긴다. 같은 사람인지 세는 데는
 *    충분하고, 되돌려 누군지 알아낼 수는 없다. 소금이 날마다 바뀌므로
 *    **어제와 오늘을 이어 붙여 한 사람을 따라다니는 것도 안 된다.**
 */

export const runtime = "nodejs"

/** 화면 이름 → 큰 분류. 관리자 화면에서 "어디에 사람이 몰리나"를 보는 단위 */
function categoryOf(path: string): string {
  const p = path.replace(/^\/+/, "").split("/")[0].split("?")[0]
  if (!p || p === "index" || p === "(tabs)") return "홈"
  if (p === "saved") return "찜"
  if (p === "trips" || p === "trip") return "여행"
  if (p === "chat" || p === "dm" || p === "messages") return "대화"
  if (p === "friends") return "친구"
  if (p === "settlement" || p === "expenses") return "정산"
  if (p === "spots" || p === "around" || p === "place") return "장소"
  if (p === "clips" || p === "clip") return "클립"
  if (p === "mypage" || p === "settings" || p === "profile") return "내정보"
  if (p === "login" || p === "join" || p === "auth") return "가입·로그인"
  if (p === "notifications") return "알림"
  return "기타"
}

/** 그날치 소금 — 날짜가 바뀌면 같은 사람도 다른 값이 된다 */
function dailySalt(): string {
  const seed = process.env.ADMIN_SESSION_SECRET ?? "withtrip"
  const day = new Date().toISOString().slice(0, 10)
  return `${seed}:${day}`
}

function visitorHash(ip: string, ua: string): string {
  return createHash("sha256").update(`${dailySalt()}|${ip}|${ua}`).digest("hex").slice(0, 16)
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      path?: string
      source?: string
      userId?: string
      referrer?: string
    }

    const path = (body.path ?? "").slice(0, 200)
    if (!path) return NextResponse.json({ ok: false }, { status: 400 })

    // ⚠️ `/_admin` 은 세지 않는다. 내가 들여다본 것까지 방문자에 섞이면
    //    통계가 나를 따라다니게 된다.
    if (path.startsWith("/_admin")) return NextResponse.json({ ok: true })

    const source = body.source === "app" ? "app" : "web"
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "0.0.0.0"
    const ua = req.headers.get("user-agent") ?? ""

    const c = getSupabaseAdmin()
    if (!c) return NextResponse.json({ ok: true })

    await c.from("page_views").insert({
      source,
      path,
      category: categoryOf(path),
      user_id: body.userId ?? null,
      visitor: visitorHash(ip, ua),
      referrer: (body.referrer ?? "").slice(0, 300) || null,
    })

    return NextResponse.json({ ok: true })
  } catch {
    // 기록이 안 되는 건 사용자 잘못이 아니다 — 조용히 넘어간다
    return NextResponse.json({ ok: true })
  }
}
