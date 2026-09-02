/**
 * 해외 결제 환산 — 현지 금액을 원화로.
 *
 * ## ⚠️ 바뀌는 것과 고정된 것을 나눈다
 *
 *     실제 청구액 = 현지금액 × 기준환율(그 날짜) × (1 + 수수료율)
 *                              ↑ 매일 바뀐다      ↑ 카드가 정해지면 고정
 *
 * 이걸 실효환율 하나로 뭉치면 여행 내내 같은 값을 쓰게 된다. 실측으로 재 보면
 * 5일 사이 엔화 기준환율이 **1.4%** 움직였고, 1500만원 여행에서 **1인당 3만원**이
 * 어긋났다. 무시할 수 있는 크기가 아니다.
 *
 * 그래서 **환율은 지출마다**(기록한 날 값을 그대로 저장), **수수료율은 여행마다**
 * 하나 둔다.
 *
 * ## ⚠️ 한 건에서 역산하는 건 「환율」이 아니라 「수수료율」이다
 *
 * 카드 명세서에서 결제 한 건의 실제 청구액을 알면, 그 지출에 저장해 둔 기준환율과
 * 견줘 **수수료율**을 뽑을 수 있다. 수수료율은 카드가 정해지면 안 바뀌므로,
 * 나머지 지출에는 각자의 날짜 환율과 함께 그 수수료율을 곱하면 된다.
 *
 * ⚠️ **명세서 합계를 묻지 않는다.** 카드에는 여행과 무관한 개인 결제가 섞여
 *    있어서 골라내는 것 자체가 일이고, 그건 「편하게 정산하기」라는 목적과
 *    정면으로 어긋난다. 필요한 건 **한 건**뿐이다.
 *
 * ⚠️ 이 파일은 `~/withtrip/shared/` 가 원본이다.
 *    앱 쪽 `src/lib/shared/` 는 복사본이므로 직접 고치지 말 것.
 */

/**
 * 카드 해외 결제 수수료율의 어림값.
 *
 * 근거: 국제브랜드 수수료 약 1.0~1.1% + 해외서비스 수수료 약 0.2~0.35%
 *       + 전신환매도율이 기준환율보다 약 1% 높음  →  합계 2.2~2.5%
 *
 * ⚠️ **0 으로 두면 안 된다.** 수수료는 방향이 늘 한쪽(더 나온다)이라 빼놓으면
 *    정산이 항상 모자라게 나온다 — 1500만원 여행에서 1인당 11만원이다.
 */
export const DEFAULT_FEE_RATE = 0.023

/** 화면에 원화로 쓸 때 쓰는 단위. 1원 미만은 뜻이 없다 */
export function roundKrw(v: number): number {
  return Math.round(v)
}

export type Money = {
  /** 결제한 그대로의 금액 */
  amount: number
  /** 통화 코드. `KRW` 면 환산이 필요 없다 */
  currency: string
  /** 그 지출을 기록한 날의 기준환율(1단위 = 몇 원). 원화면 1 */
  fxRate: number
}

/**
 * 원화로 얼마인가.
 *
 * ⚠️ **원화 지출에는 수수료를 붙이지 않는다.** 국내 결제에는 해외 수수료가
 *    없다. 안 나누면 국내 여행 정산까지 2.3% 부풀려진다.
 */
export function toKrw(m: Money, feeRate: number = DEFAULT_FEE_RATE): number {
  if (!m.currency || m.currency === "KRW") return roundKrw(m.amount)
  const rate = Number(m.fxRate)
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return roundKrw(m.amount * rate * (1 + feeRate))
}

/**
 * 결제 한 건의 **실제 청구액**으로 수수료율을 역산한다.
 *
 * @param m 그 지출 (현지 금액 + 기록한 날 기준환율)
 * @param actualKrw 카드 명세서에 찍힌 원화
 * @returns 수수료율. 말이 안 되는 값이면 `null`
 *
 * ⚠️ **터무니없는 값은 거절한다.** 사용자가 자릿수를 잘못 넣거나 다른 결제를
 *    보고 넣으면 수수료율이 -80% 나 +300% 로 나오는데, 그대로 받으면 정산
 *    전체가 조용히 망가진다. 0~15% 밖은 안 받는다.
 */
export function calibrateFeeRate(m: Money, actualKrw: number): number | null {
  const base = m.amount * Number(m.fxRate)
  if (!Number.isFinite(base) || base <= 0) return null
  if (!Number.isFinite(actualKrw) || actualKrw <= 0) return null
  const fee = actualKrw / base - 1
  if (fee < 0 || fee > 0.15) return null
  return fee
}

/** `2.34%` — 화면에 쓸 문자열 */
export function feeLabel(feeRate: number): string {
  return `${(feeRate * 100).toFixed(2)}%`
}

/**
 * 통화 기호. 없으면 코드를 그대로 쓴다.
 * ⚠️ 기호가 겹치는 통화가 많아서(달러 계열) **코드를 같이** 보여 주는 게 안전하다.
 */
const SYMBOL: Record<string, string> = {
  KRW: "₩",
  JPY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  CNY: "¥",
  VND: "₫",
  THB: "฿",
  PHP: "₱",
}

/** `¥64,500` — 소수가 있는 통화는 두 자리까지 */
export function formatMoney(amount: number, currency: string): string {
  const sym = SYMBOL[currency] ?? ""
  /* 엔·원·동은 소수를 안 쓴다. 달러·유로는 센트가 있다 */
  const noDecimal = currency === "KRW" || currency === "JPY" || currency === "VND"
  const n = noDecimal
    ? Math.round(amount).toLocaleString()
    : amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return sym ? `${sym}${n}` : `${n} ${currency}`
}

/**
 * 「¥64,500 · 약 566,000원」 처럼 둘 다 보여 줄 때.
 *
 * ⚠️ **「약」을 반드시 붙인다**(맞추기 전에는). 실제 청구액은 매입일에 정해지므로
 *    지금 값은 어림값이다 — 정확한 척하면 나중에 숫자가 달라졌을 때 신뢰를 잃는다.
 */
export function moneyWithKrw(
  m: Money,
  feeRate: number,
  calibrated: boolean
): { local: string; krw: string } {
  if (!m.currency || m.currency === "KRW") {
    return { local: `${roundKrw(m.amount).toLocaleString()}원`, krw: "" }
  }
  const krw = toKrw(m, feeRate)
  return {
    local: formatMoney(m.amount, m.currency),
    krw: `${calibrated ? "" : "약 "}${krw.toLocaleString()}원`,
  }
}
