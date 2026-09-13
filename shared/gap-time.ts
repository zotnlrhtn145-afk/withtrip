/** 여행지의 달력 날짜와 출발 시각. 기기의 시간대가 영업시간 계산에 섞이지 않게 한다. */
export function planningDayUtc(startDate: string | null, day: number | null): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate ?? '')
  if (!m || day == null || !Number.isInteger(day) || day < 1) return null
  const base = Date.UTC(+m[1], +m[2] - 1, +m[3])
  const d = new Date(base)
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2]-1 || d.getUTCDate() !== +m[3]) return null
  return base + (day - 1) * 86400000
}
export function departureError(start: number | null, earliest: number | null, deadline: number | null): string | null {
  if (start == null) return '출발 시각을 선택해 주세요.'
  if (earliest != null && start < earliest) return '앞 일정의 시작 시각 이후로 선택해 주세요.'
  if (deadline != null && start >= deadline) return '다음 일정 시작 전으로 선택해 주세요.'
  return null
}
export function arrivalDayOffset(start: number, go: number, arrival: number): number {
  const earliest = start + go
  const actual = arrival + Math.max(0, Math.ceil((earliest - arrival) / 1440)) * 1440
  return Math.floor(actual / 1440)
}

/** 다음 일정이 없는 마지막 일정도 출발지 주변으로 검색한다. */
export function gapSearchCenter(from: {lat: number | null; lng: number | null} | null, to: {lat: number | null; lng: number | null} | null) {
  if (from?.lat == null || from.lng == null || !Number.isFinite(from.lat) || !Number.isFinite(from.lng)) return undefined
  if (to?.lat != null && to.lng != null && Number.isFinite(to.lat) && Number.isFinite(to.lng)) return {lat:(from.lat+to.lat)/2,lng:(from.lng+to.lng)/2}
  return {lat:from.lat,lng:from.lng}
}
