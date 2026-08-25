import { NextResponse } from "next/server"

/**
 * 하루 한 번 빈칸을 채운다.
 *
 * ⚠️ **이 고리가 없으면 아무것도 자동이 아니다.** 규칙에 안 걸린 장소는
 *    「기타」로 남아 있고, 사람이 손으로 배치를 눌러야 채워졌다.
 *    그러면 사용자가 늘수록 손이 더 간다 — 만든 의미가 없다.
 *
 * ⚠️ **한 번에 다 하지 않는다.** 20곳씩 다섯 묶음(= AI 5회)까지만 돌린다.
 *    큐가 갑자기 커졌을 때 하루치 비용이 튀지 않게 막는 뚜껑이다.
 *    남은 건 내일 이어서 한다 — 급한 일이 아니다.
 *
 * ⚠️ 베르셀이 부르는 것인지 확인한다(`CRON_SECRET`). 없으면 아무나 눌러서
 *    AI 비용을 태울 수 있다.
 */
export const maxDuration = 300

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? ""
  const auth = req.headers.get("authorization") ?? ""
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 })
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return NextResponse.json({ error: "서버 키가 없습니다." }, { status: 500 })

  const base = new URL(req.url).origin
  const rounds: { filled: number; left: number }[] = []
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${base}/api/admin/fill-places`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": key },
      body: JSON.stringify({ limit: 20 }),
    })
    const j = (await res.json().catch(() => ({}))) as { filled?: number; left?: number; error?: string }
    if (j.error) {
      console.warn("[cron/fill-places] 중단:", j.error)
      break
    }
    rounds.push({ filled: j.filled ?? 0, left: j.left ?? 0 })
    // 더 채울 게 없으면 멈춘다 — 빈 호출로 돈을 쓰지 않는다
    if (!j.filled) break
  }
  const filled = rounds.reduce((n, r) => n + r.filled, 0)
  console.info(`[cron/fill-places] ${filled}건 채움 (${rounds.length}회)`)
  return NextResponse.json({ filled, rounds })
}
