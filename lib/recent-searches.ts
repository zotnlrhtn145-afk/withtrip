export const RECENT_SEARCHES_KEY = "withtrip_recent_searches"
export const RECENT_SEARCHES_LIMIT = 20

export type RecentSearchItem = {
  id: string
  nickname: string
  email: string
  avatar_url: string | null
}

function isRecentSearchItem(value: unknown): value is RecentSearchItem {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return typeof item.id === "string" && item.id.trim().length > 0
}

export function loadRecentSearches(): RecentSearchItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(isRecentSearchItem)
      .map((item) => ({
        id: String(item.id).trim(),
        nickname: String(item.nickname ?? "").trim() || "사용자",
        email: String(item.email ?? "").trim(),
        avatar_url: item.avatar_url ? String(item.avatar_url).trim() : null,
      }))
      .slice(0, RECENT_SEARCHES_LIMIT)
  } catch {
    return []
  }
}

export function saveRecentSearches(items: RecentSearchItem[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(items.slice(0, RECENT_SEARCHES_LIMIT))
    )
  } catch (err) {
    console.error("[recent-searches] save failed:", err)
  }
}

export function upsertRecentSearch(
  items: RecentSearchItem[],
  next: RecentSearchItem
): RecentSearchItem[] {
  const id = String(next.id ?? "").trim()
  if (!id) return items
  const filtered = items.filter((item) => item.id !== id)
  return [
    {
      id,
      nickname: String(next.nickname ?? "").trim() || "사용자",
      email: String(next.email ?? "").trim(),
      avatar_url: next.avatar_url ? String(next.avatar_url).trim() : null,
    },
    ...filtered,
  ].slice(0, RECENT_SEARCHES_LIMIT)
}

export function removeRecentSearch(items: RecentSearchItem[], id: string): RecentSearchItem[] {
  const target = String(id ?? "").trim()
  return items.filter((item) => item.id !== target)
}
