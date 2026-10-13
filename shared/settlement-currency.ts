import { formatMoney, moneyWithKrw, type Money, toKrw, feeLabel } from "./fx"
import type { SharePart } from "./expense-share"

export type SettlementMoney = Money & { feeRate: number; calibrated: boolean }

const foreign = (m: Money) => Boolean(m.currency && m.currency !== "KRW")
const validRate = (m: Money) => !foreign(m) || (Number.isFinite(Number(m.fxRate)) && Number(m.fxRate) > 0)
const rateNumber = (rate: number) => rate.toLocaleString("ko-KR", { maximumFractionDigits: 8 })
const localLabel = (m: Money) => {
  const text = formatMoney(m.amount, m.currency)
  return /[A-Z]{3}$/.test(text) ? text : `${text} ${m.currency}`
}

/** 원금·통화·저장 환율은 보존하고, 정산에 쓰는 원화가 먼저 보이게 한다. */
export function settlementMoney(m: Money, feeRate: number, calibrated: boolean): {
  amountKrw: number | null; primary: string; local: string; rate: string; estimated: boolean
} {
  if (!foreign(m)) return { amountKrw: toKrw(m, feeRate), primary: moneyWithKrw(m, feeRate, calibrated).local, local: "", rate: "", estimated: false }
  const local = `현지 금액 ${localLabel(m)}`
  if (!validRate(m)) return { amountKrw: null, primary: "환율 확인 필요", local, rate: "적용 환율 확인 필요", estimated: true }
  return {
    amountKrw: toKrw(m, feeRate), primary: moneyWithKrw(m, feeRate, calibrated).krw, local,
    rate: `적용 기준환율 1 ${m.currency} = ${rateNumber(Number(m.fxRate))}원 · 수수료 ${feeLabel(feeRate)}`,
    estimated: !calibrated,
  }
}

/** 통화끼리 더하지 않는다. 원화는 건별 반올림 후 더하고 원금은 통화별로 기록한다. */
export function settlementSummary(entries: SettlementMoney[]): {
  totalKrw: number | null; primary: string; estimated: boolean; foreign: string[]
  foreignDetails: { currency: string; amount: string; rate: string; fee: string }[]
} {
  let total = 0
  let missing = false
  let estimated = false
  const groups = new Map<string, { amount: number; rates: number[]; fees: number[]; missing: boolean }>()
  for (const e of entries) {
    const display = settlementMoney(e, e.feeRate, e.calibrated)
    if (display.amountKrw == null) missing = true
    else total += display.amountKrw
    estimated ||= display.estimated
    if (!foreign(e)) continue
    const group = groups.get(e.currency) ?? { amount: 0, rates: [], fees: [], missing: false }
    group.amount += e.amount
    if (validRate(e)) group.rates.push(Number(e.fxRate))
    else group.missing = true
    group.fees.push(e.feeRate)
    groups.set(e.currency, group)
  }
  const range = (values: number[], label: (n: number) => string) => {
    const min = Math.min(...values); const max = Math.max(...values)
    return min === max ? label(min) : `${label(min)}~${label(max)}`
  }
  return {
    totalKrw: missing ? null : total,
    primary: missing ? "환율 확인 필요" : `${estimated ? "약 " : ""}${total.toLocaleString()}원`,
    estimated,
    // 카드에서는 값을 별도 행으로 정렬하고, 공유 문구는 기존 foreign을 유지한다.
    foreignDetails: [...groups].map(([currency, g]) => ({
      currency,
      amount: localLabel({ amount: g.amount, currency, fxRate: 1 }).replace(/^[^\d+-]+/, ""),
      rate: g.missing ? "확인 필요" : `1 ${currency} = ${range(g.rates, rateNumber)}원`,
      fee: range(g.fees, feeLabel),
    })),
    foreign: [...groups].map(([currency, g]) => {
      const rate = g.missing ? "적용 환율 확인 필요" : `적용 기준환율 1 ${currency} = ${range(g.rates, rateNumber)}원`
      return `현지 금액 ${localLabel({ amount: g.amount, currency, fxRate: 1 })} · ${rate} · 수수료 ${range(g.fees, feeLabel)}`
    }),
  }
}

/** share_amount는 원금 통화 단위다. 저장값을 바꾸지 않고 정산할 때만 원화로 환산한다. */
export function sharesKrw(m: Money, parts: SharePart[], feeRate: number): SharePart[] {
  if (!foreign(m)) return parts
  const converted = parts.map(p => ({ id: p.id, amount: p.amount == null ? null : toKrw({ ...m, amount: p.amount }, feeRate) }))
  const fixed = parts.map((p, index) => ({ index, amount: p.amount })).filter(p => p.amount != null)
  const fixedSum = fixed.reduce((sum, p) => sum + (p.amount ?? 0), 0)
  // 원금에서 이미 초과한 분담액을 조용히 맞추지 않는다.
  if (!validRate(m) || !fixed.length || fixed.some(p => !Number.isFinite(p.amount) || (p.amount ?? 0) < 0) || fixedSum > m.amount + Math.max(1, Math.abs(m.amount)) * 1e-10) return converted
  const factor = Number(m.fxRate) * (1 + feeRate)
  const exact = fixed.map(p => ({ index: p.index, value: (p.amount ?? 0) * factor }))
  for (const p of exact) converted[p.index].amount = Math.floor(p.value)
  // 지정분담끼리 반올림하면서 총지출을 초과하지 않게 하고, 빈 사람 몫은 splitExpense에 맡긴다.
  const fixedKrw = Math.min(toKrw(m, feeRate), toKrw({ ...m, amount: fixedSum }, feeRate))
  let remaining = fixedKrw - converted.reduce((sum, p) => sum + (p.amount ?? 0), 0)
  for (const p of [...exact].sort((a, b) => (b.value % 1) - (a.value % 1) || a.index - b.index)) {
    if (remaining <= 0) break
    converted[p.index].amount = (converted[p.index].amount ?? 0) + 1
    remaining -= 1
  }
  return converted
}
