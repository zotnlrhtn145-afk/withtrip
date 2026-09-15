/** Public place fields only. Never serialize a saved-place row, memo, or user ID. */
export type ShareQuestion = "place" | "schedule"
export type SharedSchedule = { tripTitle: string; date: string | null; day: number; time: string | null; question: ShareQuestion }
export const shareQuestionText = (q: ShareQuestion) => q === "place" ? "이 장소 괜찮나요?" : "이 일정 괜찮나요?"
/** Compact date heading; year remains visible in the secondary context. */
export function scheduleShareHeading(s: SharedSchedule) {
  const date = s.date ? new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", timeZone: "UTC" }).format(new Date(`${s.date}T00:00:00Z`)) : `Day ${s.day} · 날짜 미정`
  return `${date} · ${s.time || "시간 미정"}`
}
export function scheduleShareContext(s: SharedSchedule) {
  return [s.date ? `${s.date.slice(0, 4)}년` : null, "현지 시간", s.tripTitle].filter(Boolean).join(" · ")
}
export function scheduleShareWhen(s: SharedSchedule) {
  const date = s.date ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short", timeZone: "UTC" }).format(new Date(`${s.date}T00:00:00Z`)) : `Day ${s.day} · 날짜 미정`
  return `${date} · ${s.time || "시간 미정"} (현지 시간)`
}
export type SharePlace = { schedule?: SharedSchedule; name?: string | null; address?: string | null; lat?: number | null; lng?: number | null; imageUrl?: string | null; category?: string | null; rating?: number | null; reviewCount?: number | null; description?: string | null }
export type PlaceShare = { token: string; sender: string; place: SharePlace }
export const validShareToken = (s: unknown): s is string => typeof s === "string" && /^[a-f0-9]{48}$/.test(s)
export const placeShareUrl = (origin: string, token: string) => `${origin.replace(/\/$/, "")}/s/place/${token}`
export const placeShareAppUrl = (token: string) => `withtripapp://place/shared?token=${token}`
export function placeShareSummary(p: SharePlace) {
  return [p.category, p.rating != null ? `★ ${p.rating}${p.reviewCount != null ? ` (${p.reviewCount.toLocaleString("ko-KR")})` : ""}` : null, p.address, p.description].filter(Boolean).join(" · ")
}
export function kakaoPlaceFeed(share: PlaceShare, origin: string, nativeAppLinks = false) {
  const url = placeShareUrl(origin, share.token)
  const schedule = share.place.schedule
  // Enable only after the native Kakao scheme is registered and released on both platforms.
  const link = { mobileWebUrl: url, webUrl: url, ...(nativeAppLinks ? {
    androidExecutionParams: `placeShareToken=${share.token}`,
    iosExecutionParams: `placeShareToken=${share.token}`,
  } : {}) }
  return { objectType: "feed", content: { title: schedule ? `${shareQuestionText(schedule.question)}\n${share.place.name || "공유한 장소"}` : share.place.name || "공유한 장소", description: (schedule ? `${scheduleShareWhen(schedule)}\n${schedule.tripTitle}\n${placeShareSummary(share.place)}` : placeShareSummary(share.place)).slice(0, 200), imageUrl: share.place.imageUrl || `${origin}/design/withtrip-share-logo.png`, link }, itemContent: { profileText: `${share.sender}님이 ${schedule ? "여행 일정을" : "이 장소를"} 공유합니다`, profileImageUrl: `${origin}/design/withtrip-share-logo.png` }, buttons: [{ title: "공유한 장소 보기", link }] }
}
