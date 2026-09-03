import { NextResponse, type NextRequest } from "next/server"

import { getLeg, type LegMode, type LegPoint } from "@/lib/route-legs"

/**
 * 일정 사이 실제 이동 시간을 한 번에 물어보는 창구.
 *
 * 앱에는 구글 키를 두지 않는다(키가 앱 안에 박히면 뽑아 쓸 수 있다).
 * 그래서 앱은 여기로 묻고, 키는 서버에만 둔다 — 장소 검색과 같은 방식이다.
 *
 * ⚠️ **한 번에 최대 12구간.** 하루 일정이 아무리 많아도 그 정도면 충분하고,
 *    실수로(또는 일부러) 수백 구간을 보내 요금을 태우는 걸 막는다.
 *
 * ⚠️ 실제로 구글에 나가는 건 **캐시에 없는 구간뿐**이다. 좌표를 100m 로
 *    반올림해 쓰기 때문에 같은 구간은 여행이 달라도 한 번만 물어본다.
 */
export const runtime = "nodejs"

/**
 * 한 번에 받는 구간 수.
 *
 * ⚠️ **넘치면 조용히 자른다 — 부르는 쪽이 그걸 모르면 사고가 난다.**
 *    「들를 곳 찾기」가 16구간을 보냈는데 뒤 4개가 버려져서, 가장 먼 두 곳이
 *    늘 「가는 시간을 못 구했어요」로 나왔다(신고받음). 앱은 이제 12개씩
 *    나눠서 묻는다. 그래도 넘겨 보내는 쪽이 있을 수 있으니 **몇 개를 버렸는지
 *    응답에 적어 준다** — 다음 사람이 원인을 찾는 데 며칠 안 걸리게.
 */
const MAX_LEGS = 12
const MODES = new Set(["walk", "drive", "transit"])

export async function POST(req: NextRequest) {
  let body: { mode?: string; legs?: { from?: LegPoint; to?: LegPoint }[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "요청을 읽지 못했습니다" }, { status: 400 })
  }

  const mode = String(body.mode ?? "walk") as LegMode
  if (!MODES.has(mode)) {
    return NextResponse.json({ error: "이동수단이 올바르지 않습니다" }, { status: 400 })
  }

  const raw = Array.isArray(body.legs) ? body.legs.slice(0, MAX_LEGS) : []
  const legs = raw.filter(
    (l) =>
      Number.isFinite(Number(l?.from?.lat)) &&
      Number.isFinite(Number(l?.from?.lng)) &&
      Number.isFinite(Number(l?.to?.lat)) &&
      Number.isFinite(Number(l?.to?.lng))
  )
  if (legs.length === 0) return NextResponse.json({ results: [] })

  /*
    ⚠️ 같은 구간이 여러 번 들어와도 **한 번만** 묻는다.
       (앞뒤로 같은 곳을 오가는 일정이면 실제로 중복이 생긴다)
  */
  const seen = new Map<string, Promise<Awaited<ReturnType<typeof getLeg>>>>()
  const results = await Promise.all(
    legs.map((l) => {
      const from = { lat: Number(l.from!.lat), lng: Number(l.from!.lng) }
      const to = { lat: Number(l.to!.lat), lng: Number(l.to!.lng) }
      const key = [from.lat, from.lng, to.lat, to.lng].map((n) => n.toFixed(3)).join(",")
      let p = seen.get(key)
      if (!p) {
        p = getLeg(from, to, mode)
        seen.set(key, p)
      }
      return p
    })
  )

  return NextResponse.json({
    mode,
    results: results.map((r) => ({
      distanceM: r.distanceM,
      durationS: r.durationS,
      noRoute: r.noRoute,
      /* 길을 따라가는 선 — 없으면 화면이 직선으로 그린다 */
      polyline: r.polyline ?? null,
    })),
    // 캐시가 얼마나 먹히는지 — 요금을 지켜보는 데 쓴다
    fromCache: results.filter((r) => r.source === "cache").length,
    fromGoogle: results.filter((r) => r.source === "google").length,
    // 진단용 — 왜 값을 못 받았는지. 키 내용은 담지 않는다
    reasons: Array.from(new Set(results.map((r) => r.reason).filter(Boolean))),
    /* ⚠️ 한도를 넘겨 보내서 **버린 개수.** 0 이 아니면 부르는 쪽이 나눠 물어야 한다 */
    dropped: Math.max(0, (Array.isArray(body.legs) ? body.legs.length : 0) - MAX_LEGS),
  })
}
