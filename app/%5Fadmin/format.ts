/** 관리자 화면에서 쓰는 자잘한 변환들. */

/**
 * 한국 날짜로 오늘 (YYYY-MM-DD).
 *
 * ⚠️ 서버는 UTC 로 돈다. `new Date()` 를 그냥 쓰면 **한국 새벽 9시 전에는
 *    어제 날짜가 나온다** — 아침에 대시보드를 열면 오늘 칸이 없다.
 */
export function seoulToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

/** 그 날짜가 속한 달의 1일 */
export function monthOf(day: string): string {
  return `${day.slice(0, 7)}-01`
}

/** from 부터 to 까지 하루씩 (양 끝 포함) */
export function dayList(from: string, to: string): string[] {
  const out: string[] = []
  const end = new Date(`${to}T00:00:00Z`).getTime()
  for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

/** 지난 n 개월의 1일 목록 (이번 달부터 거슬러) */
export function recentMonths(n: number): string[] {
  const now = new Date(Date.now() + 9 * 3600_000)
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/** 원 단위 — 소수점은 버린다. 백 원 단위까지 보여 봐야 읽기만 어렵다 */
export function krw(n: number): string {
  return Math.round(n).toLocaleString("ko-KR")
}

export function usd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "8월 19일 14:32" */
export function when(iso: string | null): string {
  if (!iso) return "-"
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000)
  const now = new Date(Date.now() + 9 * 3600_000)
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear()
  const md = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`
  const hm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
  return sameYear ? `${md} ${hm}` : `${d.getUTCFullYear()}. ${md}`
}

/** 며칠 전인지 — 목록에서 최근 것만 빨리 훑을 때 */
export function ago(iso: string | null): string {
  if (!iso) return "-"
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "방금"
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}일 전`
  return when(iso)
}

/** 긴 글은 잘라서 보여 준다 (표가 세로로 늘어지면 훑기가 어렵다) */
export function cut(s: string, n = 90): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}
