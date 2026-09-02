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

/**
 * 나라 → 통화.
 *
 * ⚠️ **여행 지역에서 통화를 짐작하는 데만 쓴다.** 정답이 아니라 «기본값» 이다 —
 *    홍콩 경유처럼 다른 통화를 쓰는 일이 흔하므로 사용자가 바꿀 수 있어야 한다.
 * ⚠️ 여기 없는 나라는 짐작하지 않는다. 틀린 통화를 미리 넣어 두면, 사용자가
 *    눈치채지 못한 채 엉뚱한 환율로 정산된다 — 비워 두고 고르게 하는 편이 낫다.
 */
const CURRENCY_BY_COUNTRY: Record<string, string> = {
  KR: "KRW", JP: "JPY", VN: "VND", TH: "THB", TW: "TWD", HK: "HKD",
  SG: "SGD", CN: "CNY", PH: "PHP", MY: "MYR", ID: "IDR", MO: "MOP",
  US: "USD", GU: "USD", CA: "CAD", AU: "AUD", NZ: "NZD", GB: "GBP",
  CH: "CHF", TR: "TRY", AE: "AED", IN: "INR", MN: "MNT", LA: "LAK",
  KH: "KHR", MM: "MMK", RU: "RUB", BR: "BRL", MX: "MXN", EG: "EGP",
  ZA: "ZAR", MA: "MAD", PE: "PEN", AR: "ARS", CL: "CLP",
  /* 유로를 쓰는 나라들 */
  FR: "EUR", DE: "EUR", IT: "EUR", ES: "EUR", PT: "EUR", NL: "EUR",
  BE: "EUR", AT: "EUR", GR: "EUR", IE: "EUR", FI: "EUR", HR: "EUR",
}

/** 나라 코드로 통화를 짐작한다. 모르면 `null` — 지어내지 않는다 */
export function currencyOfCountry(code: string | null | undefined): string | null {
  const c = String(code ?? "").toUpperCase()
  return CURRENCY_BY_COUNTRY[c] ?? null
}

/**
 * 여행 지역 글자에서 통화를 짐작한다.
 *
 * 값이 이렇게 생겼다 — `"오사카 · 일본"` · `"도쿄"` · `"제주 · 한국"`
 *
 * ⚠️ **나라 이름이 붙어 있으면 그걸 먼저 본다.** 도시 이름만으로 찾으면
 *    같은 이름이 여러 나라에 있을 때 엉뚱한 통화가 나온다.
 * ⚠️ 못 찾으면 `null` — 짐작을 못 하겠으면 안 한다. 틀린 통화가 미리 채워져
 *    있으면 사용자가 눈치 못 채고 그대로 저장한다.
 */
export function currencyOfLocation(
  location: string | null | undefined,
  findCountry: (name: string) => { code: string } | undefined,
  findByCity: (city: string) => { code: string } | undefined
): string | null {
  const raw = String(location ?? "").trim()
  if (!raw) return null
  const parts = raw.split("·").map((x) => x.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const byCountry = findCountry(parts[parts.length - 1])
    if (byCountry) return currencyOfCountry(byCountry.code)
  }
  /* 나라가 안 적힌 경우(「도쿄」) — 도시로 찾아본다 */
  const byCity = findByCity(parts[0])
  return byCity ? currencyOfCountry(byCity.code) : null
}

/**
 * 환전 실적 — 「얼마 내고 얼마 받았나」.
 *
 * ⚠️ **환율 한 숫자로 받지 않는 이유가 있다.** 베트남처럼 두 번 바꾸는 경우가
 *    흔하다 — `100만원 → $700 → 17,500,000동`. 이때 중간 통화(달러)는 알
 *    필요가 없고, **처음 낸 원화와 최종 받은 현지 돈**만 있으면 실효환율이
 *    나온다. 환율을 직접 적게 하면 사용자가 저 나눗셈을 해야 하고, 두 번
 *    바꾼 경우엔 무엇으로 나눌지도 헷갈린다.
 */
export type CashExchange = {
  /** 낸 원화 */
  krwPaid: number
  /** 받은 현지 돈 */
  foreignReceived: number
}

/** 환전으로 정해진 실효환율(현지 1단위 = 몇 원). 말이 안 되면 `null` */
export function cashRate(x: CashExchange): number | null {
  const paid = Number(x.krwPaid)
  const got = Number(x.foreignReceived)
  if (!Number.isFinite(paid) || !Number.isFinite(got)) return null
  if (paid <= 0 || got <= 0) return null
  const r = paid / got
  /* ⚠️ 자릿수를 잘못 넣으면 여기서 걸러야 한다 — 그대로 받으면 정산이 통째로 망가진다 */
  if (!Number.isFinite(r) || r <= 0) return null
  return r
}

/**
 * 현금으로 낸 지출을 원화로.
 *
 * ⚠️ **카드 수수료를 붙이지 않는다.** 현금은 바꾸는 순간 원가가 끝났다.
 * ⚠️ 환전 실적이 없으면 **그날 기준환율을 수수료 없이** 쓴다. 어림값이지만,
 *    카드 수수료를 잘못 붙이는 것보다는 훨씬 가깝다.
 */
export function cashToKrw(m: Money, exchange: CashExchange | null): number {
  if (!m.currency || m.currency === "KRW") return roundKrw(m.amount)
  const rate = (exchange && cashRate(exchange)) ?? Number(m.fxRate)
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return roundKrw(m.amount * rate)
}

/**
 * 공동 현금 지갑.
 *
 * ## ⚠️ 현지통화로만 다룬다
 *
 * 실제로 사람들은 "만엔씩 걷자" 하고 **현지통화로 똑같이** 모은다. 각자 얼마의
 * 환율로 바꿨는지 따져서 걷지 않는다. 그러니 지갑도 현지통화로 관리하고,
 * 원화 환산은 **맨 마지막에 한 번**만 한다.
 *
 * 중간에 사람마다 다른 환율로 환산하면 봉투에 섞인 돈을 누구 것인지 가르는
 * 셈이라 오히려 불공정해진다.
 *
 * ⚠️ 「사람마다 환전 실적」(`cashRate`)과 다르다. 저건 **혼자 쓴 현금**,
 *    이건 **같이 모아 쓴 현금**이다.
 */
export type PoolEntry = {
  userId: string
  /** 넣은 금액 — 현지통화 그대로 */
  amount: number
}

export type PoolState = {
  currency: string
  /** 모은 총액 (현지통화) */
  total: number
  /** 지갑에서 나간 총액 (현지통화) */
  spent: number
  /** 남은 돈 (현지통화). 음수면 더 걷어야 한다 */
  left: number
  byUser: Map<string, number>
}

/**
 * 지갑 현황.
 *
 * ⚠️ **남은 돈이 음수일 수 있다.** 모은 것보다 많이 쓰면 그렇다 — 흔한 일이라
 *    오류로 다루지 않고 「더 걷어야 함」 으로 보여 준다.
 */
export function poolState(currency: string, entries: PoolEntry[], spent: number): PoolState {
  const byUser = new Map<string, number>()
  let total = 0
  for (const e of entries) {
    const v = Number(e.amount)
    if (!Number.isFinite(v) || v <= 0) continue
    byUser.set(e.userId, (byUser.get(e.userId) ?? 0) + v)
    total += v
  }
  return { currency, total, spent, left: total - spent, byUser }
}

/**
 * 공동 지갑을 원화로 — **모은 사람들이 실제로 낸 돈** 기준.
 *
 * ## ⚠️ 새 환율을 만들지 않는다
 *
 * 이미 각자 「얼마 내고 얼마 받았나」(`trip_cash_rates`)가 있다. 그게 그 사람이
 * 실제로 치른 값이므로, 지갑의 원화 가치는 **넣은 사람들이 낸 돈을 합친 것**이다.
 *
 *     A  10,000엔을 넣음   (A 는 100,000원 내고 10,000엔 받았다 → 10원/엔)
 *     B  10,000엔을 넣음   (B 는 105,000원 내고 10,000엔 받았다 → 10.5원/엔)
 *     ────────────────────────────────────────────────
 *     지갑 20,000엔 = 205,000원   →  섞인 환율 10.25원/엔
 *
 * ⚠️ **섞인 환율을 쓰는 게 유일하게 공정하다.** 봉투에 들어간 순간 누구 돈으로
 *    샀는지 구분할 수 없다. B 가 나쁘게 바꾼 손해도 넣은 비율대로 나뉜다.
 * ⚠️ 환전 실적을 안 넣은 사람은 **그날 기준환율**로 어림잡는다. 아무도 안
 *    넣었으면 지갑 전체가 기준환율로 계산된다 — 어림값이지만 답은 나온다.
 */
export function poolKrwRate(
  entries: PoolEntry[],
  /** 사람별 환전 실적 (없는 사람은 빠진다) */
  exchanges: Map<string, CashExchange>,
  /** 환전 실적이 없는 사람에게 쓸 기준환율 */
  fallbackRate: number
): number | null {
  let krw = 0
  let local = 0
  for (const e of entries) {
    const v = Number(e.amount)
    if (!Number.isFinite(v) || v <= 0) continue
    const ex = exchanges.get(e.userId)
    const r = (ex && cashRate(ex)) ?? fallbackRate
    if (!Number.isFinite(r) || r <= 0) continue
    krw += v * r
    local += v
  }
  if (local <= 0) return null
  return krw / local
}
