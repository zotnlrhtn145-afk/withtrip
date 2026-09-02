import { NextResponse } from "next/server"

/**
 * 기준환율 — 「이 통화 1단위가 몇 원인가」.
 *
 * ## ⚠️ 출처를 한 곳으로 모으는 게 목적이다
 *
 * 앱이 제각각 다른 데서 환율을 가져오면, **기록할 때 쓴 값과 나중에 역산할 때
 * 쓴 값이 달라져** 수수료율이 엉뚱하게 나온다. 그래서 창구를 하나로 둔다.
 *
 * ⚠️ **수수료는 여기서 안 붙인다.** 여기는 기준환율만 준다 — 수수료는 카드마다
 *    다르고 여행 단위로 따로 관리한다(`trips.fx_fee_rate`).
 *
 * ## ⚠️ 두 곳을 쓰는 이유
 *
 * frankfurter 는 과거 날짜를 주지만 유럽중앙은행 기준이라 **베트남 동·대만
 * 달러가 없다.** 호치민 여행이 이미 있어서 그냥 넘길 수 없다. 그쪽은
 * open.er-api 로 받는다(오늘 값만 준다 — 그래서 기록할 때 저장해 두는 게 중요하다).
 */
export const runtime = "nodejs"

/** 하루에 한 번만 바뀌는 값이라 넉넉히 캐시한다 */
const CACHE = "public, s-maxage=21600, stale-while-revalidate=86400"

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const from = String(url.searchParams.get("from") ?? "").toUpperCase()
  const date = String(url.searchParams.get("date") ?? "").trim()

  if (!/^[A-Z]{3}$/.test(from)) return bad("통화 코드가 올바르지 않습니다")
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad("날짜 형식이 올바르지 않습니다")

  /* 원화는 물어볼 것도 없다 */
  if (from === "KRW") {
    return NextResponse.json({ from, to: "KRW", rate: 1, source: "self", date: date || null })
  }

  /* ① 유럽중앙은행 기준 — 과거 날짜도 준다 */
  try {
    const path = date ? date : "latest"
    const res = await fetch(`https://api.frankfurter.dev/v1/${path}?base=${from}&symbols=KRW`, {
      cache: "no-store",
    })
    if (res.ok) {
      const json = (await res.json()) as { rates?: Record<string, number>; date?: string }
      const rate = json.rates?.KRW
      if (typeof rate === "number" && rate > 0) {
        return NextResponse.json(
          { from, to: "KRW", rate, source: "ecb", date: json.date ?? date ?? null },
          { headers: { "Cache-Control": CACHE } }
        )
      }
    }
  } catch {
    /* 아래에서 다시 해 본다 */
  }

  /*
    ② 여기가 없으면 안 되는 통화들(VND·TWD 등).
    ⚠️ **오늘 값만 준다.** 과거 날짜를 물어도 오늘 값이 오므로, 그 사실을
       `date: null` 로 알려 준다 — 부르는 쪽이 "이건 오늘 값" 임을 알아야 한다.
  */
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${from}`, { cache: "no-store" })
    if (res.ok) {
      const json = (await res.json()) as { result?: string; rates?: Record<string, number> }
      const rate = json.rates?.KRW
      if (json.result === "success" && typeof rate === "number" && rate > 0) {
        return NextResponse.json(
          { from, to: "KRW", rate, source: "erapi", date: null },
          { headers: { "Cache-Control": CACHE } }
        )
      }
    }
  } catch {
    /* 아래로 */
  }

  /*
    ⚠️ **환율을 지어내지 않는다.** 못 구하면 못 구했다고 한다 — 아무 숫자나
       넣으면 정산이 조용히 틀어지고, 사용자는 그걸 알 방법이 없다.
  */
  return NextResponse.json({ error: "환율을 가져오지 못했습니다" }, { status: 502 })
}
