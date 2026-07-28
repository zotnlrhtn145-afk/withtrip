import {
  acceptFriendRequest,
  fetchFriendships,
  getCurrentAuthUserId,
  rejectFriendRequest,
  resolveUsersByIds,
} from "@/lib/friends-api"
import { getCurrentUserId } from "@/lib/auth-session"
import {
  acceptTripInvitation,
  fetchPendingInvitations,
  rejectTripInvitation,
} from "@/lib/trip-members-api"
import { createClient } from "@/utils/supabase/client"

export type NotificationFilter = "all" | "trip" | "friend" | "clip"

export type NotificationCategory = "trip" | "friend" | "clip"

export type NotificationActionState = "pending" | "accepted" | "dismissed"

export type FeedNotification = {
  id: string
  category: NotificationCategory
  actorName: string
  actorAvatarUrl?: string
  actors?: { name: string; avatarUrl?: string }[]
  tripId?: string
  tripTitle?: string
  message: string
  createdAt: string
  actionState: NotificationActionState
  /** trip_members.id | friendships.id | trip_clips.id */
  actionId: string
}

export type NotificationTimeGroup = "today" | "week" | "earlier"

const FILTER_TO_CATEGORY: Record<Exclude<NotificationFilter, "all">, NotificationCategory> = {
  trip: "trip",
  friend: "friend",
  clip: "clip",
}

export function filterNotifications(
  items: FeedNotification[],
  filter: NotificationFilter
): FeedNotification[] {
  if (filter === "all") return items
  const category = FILTER_TO_CATEGORY[filter]
  return items.filter((item) => item.category === category)
}

export function formatRelativeTimeKo(iso?: string | null): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diffMs = Date.now() - then
  if (diffMs < 0) return "방금"
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "방금"
  if (mins < 60) return `${mins}분`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}주`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}개월`
  const years = Math.floor(days / 365)
  return `${Math.max(1, years)}년`
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function getNotificationTimeGroup(iso?: string | null): NotificationTimeGroup {
  if (!iso) return "earlier"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "earlier"
  const now = new Date()
  const todayStart = startOfLocalDay(now)
  if (then >= todayStart) return "today"
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000
  if (then >= weekStart) return "week"
  return "earlier"
}

export function groupNotificationsByTime(
  items: FeedNotification[]
): { key: NotificationTimeGroup; label: string; items: FeedNotification[] }[] {
  const buckets: Record<NotificationTimeGroup, FeedNotification[]> = {
    today: [],
    week: [],
    earlier: [],
  }
  for (const item of items) {
    buckets[getNotificationTimeGroup(item.createdAt)].push(item)
  }
  const order: { key: NotificationTimeGroup; label: string }[] = [
    { key: "today", label: "오늘" },
    { key: "week", label: "이번 주" },
    { key: "earlier", label: "이전 활동" },
  ]
  return order
    .map((section) => ({ ...section, items: buckets[section.key] }))
    .filter((section) => section.items.length > 0)
}

async function fetchFriendRequestNotifications(): Promise<FeedNotification[]> {
  const userId = await getCurrentAuthUserId()
  if (!userId) return []

  try {
    const rows = await fetchFriendships(userId)
    return rows
      .filter((row) => row.status === "pending" && row.friend_id === userId)
      .map((row) => {
        const profile = row.user_profile
        const email = String(profile?.email ?? "").trim()
        const actorName =
          String(profile?.nickname ?? "").trim() ||
          (email ? email.split("@")[0] : "") ||
          "친구"
        const actorAvatarUrl =
          String(profile?.avatar_url ?? profile?.profile_image ?? "").trim() || undefined
        return {
          id: `friend:${row.id}`,
          category: "friend" as const,
          actorName,
          actorAvatarUrl,
          message: `${actorName}님이 친구 요청을 보냈습니다.`,
          createdAt: String(row.created_at ?? new Date().toISOString()),
          actionState: "pending" as const,
          actionId: row.id,
        }
      })
  } catch (err) {
    console.error(
      "[fetchFriendRequestNotifications]",
      err instanceof Error ? err.message : err
    )
    return []
  }
}

async function fetchClipShareNotifications(): Promise<FeedNotification[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const client = createClient()
  const { data, error } = await client
    .from("trip_clips")
    .select(
      "id, trip_id, user_id, caption, created_at, trips:trip_id(title)"
    )
    .neq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    // Table may not exist yet — soft-fail
    console.warn("[fetchClipShareNotifications]", error.message || error)
    return []
  }

  type ClipRow = {
    id?: string
    trip_id?: string
    user_id?: string
    created_at?: string | null
    trips?: { title?: string | null } | Array<{ title?: string | null }> | null
  }

  const rows = (data as ClipRow[] | null) ?? []
  const authorIds = [
    ...new Set(rows.map((row) => String(row.user_id ?? "").trim()).filter(Boolean)),
  ]
  const profiles = await resolveUsersByIds(authorIds)

  return rows
    .map((row) => {
      const id = String(row.id ?? "").trim()
      const authorId = String(row.user_id ?? "").trim()
      if (!id || !authorId) return null
      const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips
      const tripTitle = String(trip?.title ?? "").trim() || "여행"
      const tripId = String(row.trip_id ?? "").trim() || undefined
      const profile = profiles[authorId]
      const actorName = profile?.nickname || "친구"
      const actorAvatarUrl = profile?.avatarUrl
      return {
        id: `clip:${id}`,
        category: "clip" as const,
        actorName,
        actorAvatarUrl,
        tripId,
        tripTitle,
        message: `${actorName}님이 '${tripTitle}'에 클립을 공유했습니다.`,
        createdAt: String(row.created_at ?? new Date().toISOString()),
        actionState: "pending" as const,
        actionId: id,
      } satisfies FeedNotification
    })
    .filter((item): item is FeedNotification => Boolean(item))
}

export async function fetchFeedNotifications(): Promise<FeedNotification[]> {
  const [invites, friends, clips] = await Promise.all([
    fetchPendingInvitations(),
    fetchFriendRequestNotifications(),
    fetchClipShareNotifications(),
  ])

  const tripItems: FeedNotification[] = invites.map((invite) => ({
    id: `trip:${invite.id}`,
    category: "trip",
    actorName: invite.inviterName,
    actorAvatarUrl: invite.inviterAvatarUrl,
    tripId: invite.tripId,
    tripTitle: invite.tripTitle,
    message: `${invite.inviterName}님이 '${invite.tripTitle}'에 초대했습니다.`,
    createdAt: invite.createdAt ?? new Date().toISOString(),
    actionState: "pending",
    actionId: invite.id,
  }))

  return [...tripItems, ...friends, ...clips].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export async function acceptFeedNotification(
  item: FeedNotification
): Promise<{ toast: string; tripId?: string }> {
  if (item.category === "trip") {
    const { tripTitle } = await acceptTripInvitation(item.actionId)
    return {
      toast: `'${tripTitle}' 여행에 참여했습니다!`,
      tripId: item.tripId,
    }
  }
  if (item.category === "friend") {
    await acceptFriendRequest(item.actionId)
    return { toast: `${item.actorName}님과 친구가 되었어요.` }
  }
  // Clip shares are informational — accepting marks as seen
  return { toast: "확인했습니다." }
}

export async function rejectFeedNotification(item: FeedNotification): Promise<{ toast: string }> {
  if (item.category === "trip") {
    await rejectTripInvitation(item.actionId)
    return { toast: "초대를 거절했어요." }
  }
  if (item.category === "friend") {
    await rejectFriendRequest(item.actionId)
    return { toast: "친구 요청을 거절했어요." }
  }
  return { toast: "알림을 삭제했어요." }
}

/** Pending actionable count (trip invites + friend requests). */
export function countActionableNotifications(items: FeedNotification[]): number {
  return items.filter(
    (item) =>
      item.actionState === "pending" &&
      (item.category === "trip" || item.category === "friend")
  ).length
}
