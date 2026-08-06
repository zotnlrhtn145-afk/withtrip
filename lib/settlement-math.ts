export type SettlementBalance = {
  userId: string
  balance: number
}

export type ComputedTransfer = {
  fromUserId: string
  toUserId: string
  amount: number
}

export type ExpenseSplitInput = {
  amount: number
  payerId: string
  /** Users who share this expense. Empty → treat as payer-only. */
  participantIds: string[]
}

/**
 * Fair share per member (원 단위 반올림).
 */
export function calcPerPerson(total: number, memberCount: number) {
  if (memberCount <= 0) return 0
  return Math.round(total / memberCount)
}

/**
 * Split one expense across participants so shares sum exactly to `amount`.
 * First n-1 get floor; last gets the remainder.
 */
export function splitExpenseShares(amount: number, participantIds: string[]): Record<string, number> {
  const ids = [...new Set(participantIds.map((id) => String(id ?? "").trim()).filter(Boolean))]
  const shares: Record<string, number> = {}
  if (ids.length === 0 || amount <= 0) return shares

  const base = Math.floor(amount / ids.length)
  let remainder = amount - base * ids.length
  for (const userId of ids) {
    const extra = remainder > 0 ? 1 : 0
    if (remainder > 0) remainder -= 1
    shares[userId] = base + extra
  }
  return shares
}

/**
 * Variable-participant balances:
 * balance = paid − owed
 * (positive ⇒ should receive, negative ⇒ should pay)
 *
 * For each expense: amount is split among its participants only.
 */
export function calcVariableMemberBalances(
  memberIds: string[],
  expenses: ExpenseSplitInput[]
): SettlementBalance[] {
  const ids = [...new Set(memberIds.map((id) => String(id ?? "").trim()).filter(Boolean))]
  const paid: Record<string, number> = {}
  const owed: Record<string, number> = {}
  for (const userId of ids) {
    paid[userId] = 0
    owed[userId] = 0
  }

  // Include any payer/participant not in the trip member list so balances stay consistent.
  const ensure = (userId: string) => {
    if (!userId) return
    if (!(userId in paid)) {
      paid[userId] = 0
      owed[userId] = 0
      ids.push(userId)
    }
  }

  for (const expense of expenses) {
    const amount = Math.round(Number(expense.amount) || 0)
    if (amount <= 0) continue
    const payerId = String(expense.payerId ?? "").trim()
    let participants = [
      ...new Set((expense.participantIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean)),
    ]
    if (participants.length === 0 && payerId) {
      participants = [payerId]
    }

    ensure(payerId)
    for (const userId of participants) ensure(userId)

    if (payerId) {
      paid[payerId] = (paid[payerId] ?? 0) + amount
    }

    const shares = splitExpenseShares(amount, participants)
    for (const [userId, share] of Object.entries(shares)) {
      owed[userId] = (owed[userId] ?? 0) + share
    }
  }

  return ids.map((userId) => ({
    userId,
    balance: Math.round((paid[userId] ?? 0) - (owed[userId] ?? 0)),
  }))
}

/**
 * 공동 자금(이월) 반영 — 정산 전에 모아둔 돈으로 먼저 부담을 덜어준다.
 * 적용 대상(applicableIds; 비었으면 전체)끼리 carryover 를 균등하게 나눠
 * 각자의 owed 를 줄인다 = balance 에 carryPerHead 를 더한다.
 * (합계 balance 가 carryover 만큼 (+) 로 남고, 그 금액은 모아둔 돈이 대신 갚는다.)
 */
export function applyCarryoverCredit(
  balances: SettlementBalance[],
  carryover: number,
  applicableIds?: string[]
): SettlementBalance[] {
  const carry = Math.max(0, Math.round(carryover || 0))
  if (carry <= 0) return balances
  const memberIds = balances.map((b) => b.userId)
  const sel =
    applicableIds && applicableIds.length > 0
      ? applicableIds.filter((id) => memberIds.includes(id))
      : memberIds
  if (sel.length === 0) return balances
  const perHead = Math.round(carry / sel.length)
  const applicable = new Set(sel)
  return balances.map((b) =>
    applicable.has(b.userId) ? { ...b, balance: b.balance + perHead } : b
  )
}

/**
 * balance = paid - fairShare (equal split across all members).
 * Prefer calcVariableMemberBalances for selective participants.
 */
export function calcMemberBalances(
  memberIds: string[],
  paidByUser: Record<string, number>,
  perPerson: number
): SettlementBalance[] {
  return memberIds.map((userId) => ({
    userId,
    balance: Math.round((paidByUser[userId] ?? 0) - perPerson),
  }))
}

/**
 * Greedy minimize-cash-flow: match debtors → creditors.
 */
export function computeMinTransfers(balances: SettlementBalance[]): ComputedTransfer[] {
  const debtors = balances
    .filter((item) => item.balance < -0.5)
    .map((item) => ({ userId: item.userId, amount: -item.balance }))
    .sort((a, b) => b.amount - a.amount)

  const creditors = balances
    .filter((item) => item.balance > 0.5)
    .map((item) => ({ userId: item.userId, amount: item.balance }))
    .sort((a, b) => b.amount - a.amount)

  const transfers: ComputedTransfer[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount)
    if (pay > 0) {
      transfers.push({
        fromUserId: debtors[i].userId,
        toUserId: creditors[j].userId,
        amount: pay,
      })
    }
    debtors[i].amount -= pay
    creditors[j].amount -= pay
    if (debtors[i].amount <= 0) i += 1
    if (creditors[j].amount <= 0) j += 1
  }

  return transfers
}

/**
 * Human-readable split label for expense list rows.
 * e.g. "4명 전원 분할", "3명 분할 (임석희 제외)", "1인 단독 지출"
 */
export function formatExpenseSplitLabel(
  participantIds: string[],
  allMembers: Array<{ userId: string; nickname: string }>
): string {
  const participants = [
    ...new Set(participantIds.map((id) => String(id ?? "").trim()).filter(Boolean)),
  ]
  const total = allMembers.length
  const count = participants.length

  if (count <= 0) return "참여자 없음"
  if (count === 1) return "1인 단독 지출"
  if (total > 0 && count >= total) return `${count}명 전원 분할`

  const excluded = allMembers.filter((member) => !participants.includes(member.userId))
  if (excluded.length === 1) {
    return `${count}명 분할 (${excluded[0].nickname} 제외)`
  }
  if (excluded.length === 2) {
    return `${count}명 분할 (${excluded[0].nickname}, ${excluded[1].nickname} 제외)`
  }
  if (excluded.length > 2) {
    return `${count}명 분할 (${excluded[0].nickname} 외 ${excluded.length - 1}명 제외)`
  }
  return `${count}명 분할`
}
