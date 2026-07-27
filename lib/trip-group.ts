/** Canonical Paris demo trip ID used across cards / settlement / friends. */
export const PARIS_TRIP_ID = "77777777-7777-7777-7777-777777777777"
export const PARIS_TRIP_TITLE = "파리 여행"
export const PARIS_GROUP_TAG = "파리 여행 그룹"

const MEMBER_COLORS = [
  "bg-primary text-primary-foreground",
  "bg-chart-2 text-background",
  "bg-foreground text-background",
  "bg-secondary text-secondary-foreground",
]

export type TripGroupMember = {
  id: string
  userId: string
  name: string
  initials: string
  color: string
  avatarUrl?: string
}

export function initialsFromDisplayName(name: string) {
  const cleaned = String(name ?? "").trim().replace(/\s+/g, "")
  if (!cleaned) return "MB"
  if (/[가-힣]/.test(cleaned)) return cleaned.slice(0, 2)
  return cleaned.slice(0, 2).toUpperCase()
}

export function toTripGroupMember(input: {
  userId: string
  name: string
  avatarUrl?: string
  index?: number
}): TripGroupMember {
  const userId = String(input.userId ?? "").trim()
  const name = String(input.name ?? "").trim() || "멤버"
  const index = input.index ?? 0
  return {
    id: userId || `member-${index}`,
    userId,
    name,
    initials: initialsFromDisplayName(name),
    color: MEMBER_COLORS[index % MEMBER_COLORS.length],
    avatarUrl: input.avatarUrl,
  }
}

/**
 * "김철수, 이미영 외 2명" style summary.
 * Shows first two names, then "외 N명" when more than 2.
 */
export function formatMemberSummary(names: string[]): string {
  const cleaned = names.map((n) => String(n ?? "").trim()).filter(Boolean)
  if (cleaned.length === 0) return "멤버 없음"
  if (cleaned.length === 1) return cleaned[0]
  if (cleaned.length === 2) return `${cleaned[0]}, ${cleaned[1]}`
  return `${cleaned[0]}, ${cleaned[1]} 외 ${cleaned.length - 2}명`
}

export function pickPreferredTripId(
  tripIds: string[],
  currentId?: string | null
): string | null {
  const ids = tripIds.map((id) => String(id ?? "").trim()).filter(Boolean)
  if (ids.length === 0) return null
  const current = String(currentId ?? "").trim()
  if (current && ids.includes(current)) return current
  if (ids.includes(PARIS_TRIP_ID)) return PARIS_TRIP_ID
  return ids[0] ?? null
}
