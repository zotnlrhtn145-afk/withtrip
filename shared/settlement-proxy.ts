/**
 * 대납 — 남의 몫을 **대신 내주는** 경우.
 *
 * 정산을 마칠 때 흔히 있는 일이다. 송금 정리는 이렇게 나왔는데
 *
 *     김동현 → 오수환   30,000원
 *
 * 실제로는 오정환이 오수환에게 30,000원을 줬다.
 *
 * ## 그냥 "완료" 로 두면 안 되는 이유
 *
 * **김동현의 빚이 사라진다.** 실제로는 갚을 상대가 오수환에서 오정환으로
 * 바뀐 것뿐인데 앱에서는 아무도 안 받을 돈이 된다. 대신 내준 사람만 손해를
 * 본다 — 정산 앱이 절대 하면 안 되는 일이다.
 *
 * ## 어떻게 푸나
 *
 * 대납은 **실제로 오간 돈**이므로 잔액에 그대로 반영한다.
 *
 *     오정환 += 30,000     진짜로 냈으니까
 *     오수환 -= 30,000     받았으니 그만큼 덜 받을 상태가 된다
 *     김동현   그대로       아직 아무한테도 안 갚았다
 *
 * 그러면 최소 송금을 다시 계산했을 때 저절로 이렇게 바뀐다:
 *
 *     김동현 → 오정환   30,000원
 *
 * 따로 "남은 빚" 목록을 만들 필요가 없다. 원래 쓰던 계산이 답을 낸다.
 *
 * ⚠️ **대납은 `settlements` 가 아니라 따로 적는다.** `settlements` 는 (여행,
 *    보내는 이, 받는 이) 하나당 한 줄인데, 대납 뒤에 다시 계산한 송금이
 *    **같은 짝으로 나오는 경우**가 있어서 새로 생긴 빚이 옛 줄의 '완료' 를
 *    물려받아 이미 갚은 것으로 표시됐다(실기기에서 그대로 나왔다).
 *    한 줄에 "끝난 옛 빚" 과 "안 갚은 새 빚" 을 같이 담을 수 없다.
 *
 * ⚠️ 이 파일은 `~/withtrip/shared/` 가 원본이다.
 *    앱 쪽 `src/lib/shared/` 는 복사본이므로 직접 고치지 말 것.
 */

export type ProxyRow = {
  /** 원래 낼 사람 — 빚이 사라지지 않고 갚을 상대만 바뀐다 */
  debtorId: string
  /** 실제로 받은 사람 */
  toUserId: string
  /** 대신 낸 사람 */
  payerId: string
  amount: number
}

/**
 * 대납을 잔액에 반영한다.
 *
 * 여기 들어오는 것은 **이미 오간 돈**이다. 기록 자체가 "냈다" 는 뜻이라
 * 따로 완료 여부를 두지 않는다 — 안 냈으면 적지 않으면 된다.
 *
 * @param balances 지출로 구한 잔액 (양수 = 받을 돈)
 * @returns 대납이 반영된 새 배열. 원본은 건드리지 않는다.
 */
export function proxyDeltas(proxies: ProxyRow[]): Map<string, number> {
  const delta = new Map<string, number>()
  for (const p of proxies) {
    const payer = String(p.payerId ?? "").trim()
    // ⚠️ 대납자가 원채무자면 그냥 보통 송금이고, 수취인이면 대납이 아니라
    //    "안 받아도 된다"(탕감)다. 둘 다 여기서 흉내 내지 않는다 — 잔액을
    //    옮겨 봐야 서로 상쇄돼 화면만 이상해진다.
    if (!payer || payer === p.debtorId || payer === p.toUserId) continue
    const amt = Math.round(p.amount || 0)
    if (amt <= 0) continue
    delta.set(payer, (delta.get(payer) ?? 0) + amt)
    delta.set(p.toUserId, (delta.get(p.toUserId) ?? 0) - amt)
  }
  return delta
}

/**
 * 대납을 **낸 금액**에 얹는다.
 *
 * ⚠️ 잔액만 고치면 안 된다. 화면의 "낸 금액 0원 · 부담 30,000원" 이 그대로
 *    남아서, 대신 낸 사람이 **여전히 안 낸 사람으로 보인다.** 정산 화면에서
 *    제일 먼저 보는 줄이라 여기가 틀리면 나머지를 아무도 안 믿는다.
 *    실기기에서 그렇게 나왔다.
 */
export function applyProxyToPaid(
  paid: Map<string, number>,
  proxies: ProxyRow[]
): Map<string, number> {
  const next = new Map(paid)
  for (const [userId, d] of proxyDeltas(proxies)) {
    next.set(userId, (next.get(userId) ?? 0) + d)
  }
  return next
}

export function applyProxyPayments(
  balances: { userId: string; balance: number }[],
  proxies: ProxyRow[]
): { userId: string; balance: number }[] {
  const delta = proxyDeltas(proxies)
  if (delta.size === 0) return balances
  return balances.map((b) => ({
    userId: b.userId,
    balance: b.balance + (delta.get(b.userId) ?? 0),
  }))
}

/*
  ⚠️ **"대납된 짝은 숨긴다" 같은 필터를 두면 안 된다.** 한 번 넣었다가 실기기에서
     돈이 통째로 사라지는 걸 봤다.

     리뷰어가 90,000원을 내고 셋이 나눠 오정환·김동현이 각 30,000원씩 빚졌다.
     오정환이 김동현 몫 30,000원을 리뷰어에게 대신 냈다. 그러면 오정환 자신의
     빚 30,000원은 그대로고 김동현이 오정환에게 30,000원을 갚아야 하는데,
     최소 송금으로 정리하면 **"김동현 → 리뷰어 30,000원"** 한 줄이 된다
     (오정환이 가운데서 상쇄된다). 옳은 답이다.

     그런데 그 짝이 방금 대납한 짝과 같아서, 필터가 이 줄을 지워 버렸다.
     화면에는 "정산할 송금이 없어요" 가 떴고 30,000원이 공중으로 사라졌다.

     잔액을 옮기는 것만으로 이미 충분하다. 끝난 송금은 저절로 안 나오고,
     같은 짝이 다시 나온다면 그건 **다른 이유로 진짜 갚아야 할 돈**이다.
*/
