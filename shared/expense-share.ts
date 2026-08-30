/**
 * 지출 하나를 사람별로 얼마씩 나눌지 계산한다.
 *
 * ## ⚠️ 「모드」가 없다
 *
 * 균등/직접/비율 같은 모드를 두면 사용자가 **먼저 모드를 고르고** 시작해야
 * 하고, 한 지출 안에서 섞어 쓸 수가 없다. 그런데 실제로 필요한 건 늘 섞인
 * 형태다 — "한 명만 50만 정해 두고 나머지는 알아서".
 *
 * 그래서 규칙이 하나뿐이다.
 *
 *     amount 가 숫자   →  이 사람은 딱 이만큼
 *     amount 가 null   →  남은 금액을 다른 null 인 사람들과 나눠 낸다
 *
 * 전원이 null 이면 예전과 똑같은 균등 분할이다. **기존 데이터가 전부 null 이라
 * 지금까지의 정산은 그대로 남는다.**
 *
 * ⚠️ 이 파일은 `~/withtrip/shared/` 가 원본이다.
 *    앱 쪽 `src/lib/shared/` 는 복사본이므로 직접 고치지 말 것.
 */

export type SharePart = {
  /** 사람 식별자 (회원 id 또는 게스트 id) */
  id: string
  /** 정해 둔 금액(원). `null` 이면 남은 금액을 나눠 낸다 */
  amount: number | null
}

export type SplitResult = {
  /** 사람별로 낼 금액 */
  byPerson: Map<string, number>
  /** 금액을 정해 둔 사람들의 합계 */
  fixedTotal: number
  /** 나눠 가질 금액 (총액 − 정한 합계). 음수일 수 있다 */
  rest: number
  /** 나눠 갖는 사람 수 */
  restCount: number
  /**
   * 뭔가 어긋났을 때의 이유. 정상이면 `null`.
   * ⚠️ 여기서 막지 않는다 — 막는 건 화면이 할 일이고, 계산은 **늘 답을 낸다.**
   *    계산이 예외를 던지면 정산 화면 전체가 안 뜬다.
   */
  problem: null | "over" | "under" | "empty"
}

/**
 * ⚠️ **원 단위로 딱 맞춘다.** 200만원을 3명이 나누면 666,666.67원인데,
 *    그냥 나누면 각자 낼 금액의 합이 총액과 안 맞는다(1원이 빈다).
 *    남는 원은 **앞사람부터 1원씩** 더 얹는다. 순서가 정해져 있어야
 *    화면을 다시 열어도 같은 값이 나온다.
 */
export function splitExpense(total: number, parts: SharePart[]): SplitResult {
  const byPerson = new Map<string, number>()
  const amount = Math.max(0, Math.round(Number(total) || 0))

  if (parts.length === 0) {
    return { byPerson, fixedTotal: 0, rest: amount, restCount: 0, problem: "empty" }
  }

  const fixed = parts.filter((p) => p.amount != null)
  const blanks = parts.filter((p) => p.amount == null)
  const fixedTotal = fixed.reduce((s, p) => s + Math.max(0, Math.round(p.amount as number)), 0)
  for (const p of fixed) byPerson.set(p.id, Math.max(0, Math.round(p.amount as number)))

  const rest = amount - fixedTotal

  /*
    ⚠️ 아무도 안 비워 뒀는데 합계가 총액과 다르면 **말해 준다.** 조용히
       총액을 바꾸거나 누군가에게 몰아주면, 나중에 "왜 금액이 다르지?" 가 된다.
  */
  if (blanks.length === 0) {
    return {
      byPerson,
      fixedTotal,
      rest,
      restCount: 0,
      problem: rest === 0 ? null : rest > 0 ? "under" : "over",
    }
  }

  if (rest < 0) {
    // 정해 둔 금액만으로 총액을 넘었다 — 나눠 갖는 사람은 0원
    for (const p of blanks) byPerson.set(p.id, 0)
    return { byPerson, fixedTotal, rest, restCount: blanks.length, problem: "over" }
  }

  const each = Math.floor(rest / blanks.length)
  let leftover = rest - each * blanks.length
  for (const p of blanks) {
    byPerson.set(p.id, each + (leftover > 0 ? 1 : 0))
    if (leftover > 0) leftover -= 1
  }

  return { byPerson, fixedTotal, rest, restCount: blanks.length, problem: null }
}

/**
 * 화면에 한 줄로 보여 줄 안내 문구.
 *
 * ⚠️ 숫자만 늘어놓지 않는다. "정한 금액 50만 · 남은 200만을 2명이 각 100만"
 *    처럼 **누가 얼마를 내는지**가 바로 읽혀야 고칠지 말지 판단할 수 있다.
 */
export function splitSummary(total: number, parts: SharePart[]): string {
  const r = splitExpense(total, parts)
  const won = (n: number) => `${Math.round(n).toLocaleString()}원`

  if (r.problem === "empty") return "정산할 사람을 골라 주세요."
  if (r.problem === "over") {
    return `정한 금액이 ${won(-r.rest)} 더 많아요. 총액은 ${won(total)}이에요.`
  }
  if (r.problem === "under") {
    return `${won(r.rest)}이 남았어요. 남길 사람의 금액을 비워 두면 나눠 냅니다.`
  }
  if (r.fixedTotal === 0) {
    const each = r.byPerson.values().next().value ?? 0
    return `${r.restCount}명이 각 ${won(each)}`
  }
  if (r.restCount === 0) return `정한 금액 ${won(r.fixedTotal)}`
  const each = r.rest > 0 ? Math.floor(r.rest / r.restCount) : 0
  return `정한 금액 ${won(r.fixedTotal)} · 남은 ${won(r.rest)}을 ${r.restCount}명이 각 ${won(each)}`
}
