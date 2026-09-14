/** Public place fields only. Never serialize a saved-place row, memo, or user ID. */
export type SharePlace = { name?: string | null; address?: string | null; lat?: number | null; lng?: number | null; imageUrl?: string | null; category?: string | null; rating?: number | null; reviewCount?: number | null; description?: string | null }
export type PlaceShare = { token: string; sender: string; place: SharePlace }
export const validShareToken = (s: unknown): s is string => typeof s === "string" && /^[a-f0-9]{48}$/.test(s)
export const placeShareUrl = (origin: string, token: string) => `${origin.replace(/\/$/, "")}/s/place/${token}`
export const placeShareAppUrl = (token: string) => `withtripapp://place/shared?token=${token}`
export function placeShareSummary(p: SharePlace) {
  return [p.category, p.rating != null ? `★ ${p.rating}${p.reviewCount != null ? ` (${p.reviewCount.toLocaleString("ko-KR")})` : ""}` : null, p.address, p.description].filter(Boolean).join(" · ")
}
export function kakaoPlaceFeed(share: PlaceShare, origin: string) {
  const url = placeShareUrl(origin, share.token)
  const link = { mobileWebUrl: url, webUrl: url }
  return { objectType: "feed", content: { title: share.place.name || "공유한 장소", description: placeShareSummary(share.place).slice(0, 200), imageUrl: share.place.imageUrl || `${origin}/design/withtrip-share-logo.png`, link }, itemContent: { profileText: `${share.sender}님이 이 장소를 공유합니다`, profileImageUrl: `${origin}/design/withtrip-share-logo.png` }, buttons: [{ title: "공유한 장소 보기", link }] }
}
