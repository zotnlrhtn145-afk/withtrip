/**
 * 여행 "N일차" 를 실제 날짜·요일로 바꾼다.
 *
 * 웹과 앱이 **같은 값**을 보여야 한다. 한쪽이 "8/27 (목)" 이고 다른 쪽이
 * "8월 27일 목요일" 이면, 같은 화면을 두 기기로 볼 때 다르게 읽힌다.
 *
 * ⚠️ 이 파일은 `~/withtrip/shared/` 가 원본이다.
 *    앱 쪽 `src/lib/shared/` 는 복사본이므로 직접 고치지 말 것.
 */

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const

/**
 * 여행 시작일과 일차 번호로 그 날의 날짜를 구한다.
 * 1일차 = 시작일.
 *
 * ⚠️ 날짜만 있는 문자열("2026-08-27")을 `new Date()` 에 그대로 넣으면
 *    **UTC 자정**으로 읽혀서, 한국처럼 UTC 보다 앞선 곳에서는 하루가
 *    밀려 보인다. 숫자로 쪼개서 그 지역 자정으로 만든다.
 */
export function dayDate(startDate: string | null | undefined, day: number): Date | null {
  const s = String(startDate ?? "").trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + Math.max(1, day) - 1)
  return d
}

/**
 * 일차 옆에 붙일 짧은 딱지. 예: `8/27 (목)`
 *
 * 시작일을 모르면 빈 문자열 — 부르는 쪽에서 아예 안 그리면 된다.
 * (예전에는 "1일차" 만 있어서 그게 며칠인지 매번 세어야 했다)
 */
export function dayLabel(startDate: string | null | undefined, day: number): string {
  const d = dayDate(startDate, day)
  if (!d) return ""
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`
}
