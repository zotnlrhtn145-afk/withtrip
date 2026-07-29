import {
  acceptFriendRequest,
  fetchFriendships,
  getCurrentAuthUserId,
  rejectFriendRequest,
  resolveUsersByIds,
} from "@/lib/friends-api"
import {
  updateNotificationStatus,
  fetchMyNotifications,
  type NotificationType,
} from "@/lib/notifications-api"
import {
  acceptTripInvitation,
  fetchPendingInvitations,
  rejectTripInvitation,
} from "@/lib/trip-members-api"
import { createClient } from "@/utils/supabase/client"

export type NotificationFilter = "all" | "trip" | "friend" | "clip"

export type NotificationCategory = "trip" | "friend" | "clip"

export type NotificationActionState = "pending" | "accepted" | "declined" | "dismissed"

export type FeedNotification = {
  id: string
  /** DB notification type — used by tab filters */
  type: NotificationType
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
  /** notifications.id when sourced from notifications table */
  notificationId?: string
}

export type NotificationTimeGroup = "today" | "week" | "earlier"

const CLIP_TYPES: NotificationType[] = ["clip_invite", "clip_like", "clip_comment"]

function categoryFromType(type: NotificationType): NotificationCategory {
  if (type === "friend_request") return "friend"
  if (CLIP_TYPES.includes(type)) return "clip"
  return "trip"
}

export function filterNotifications(
  items: FeedNotification[],
  filter: NotificationFilter
): FeedNotification[] {
  if (filter === "all") return items
  if (filter === "trip") {
    return items.filter((item) => item.type === "trip_invite")
  }
  if (filter === "friend") {
    return items.filter((item) => item.type === "friend_request")
  }
  return items.filter((item) => CLIP_TYPES.includes(item.type))
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

async function fetchFriendRequestNotificationsFallback(): Promise<FeedNotification[]> {
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
          type: "friend_request" as const,
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
      "[fetchFriendRequestNotificationsFallback]",
      err instanceof Error ? err.message : err
    )
    return []
  }
}

async function fetchTripInviteNotificationsFallback(): Promise<FeedNotification[]> {
  const invites = await fetchPendingInvitations()
  return invites.map((invite) => ({
    id: `trip:${invite.id}`,
    type: "trip_invite" as const,
    category: "trip" as const,
    actorName: invite.inviterName,
    actorAvatarUrl: invite.inviterAvatarUrl,
    tripId: invite.tripId,
    tripTitle: invite.tripTitle,
    message: `${invite.inviterName}님이 '${invite.tripTitle}'에 초대했습니다.`,
    createdAt: invite.createdAt ?? new Date().toISOString(),
    actionState: "pending" as const,
    actionId: invite.id,
  }))
}

/** Soft clip activity from shared trips (when no clip_invite rows exist yet). */
async function fetchClipActivityFallback(): Promise<FeedNotification[]> {
  const userId = await getCurrentAuthUserId()
  if (!userId) return []

  const client = createClient()
  const { data, error } = await client
    .from("trip_clips")
    .select("id, trip_id, user_id, created_at, trips:trip_id(title)")
    .neq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12)

  if (error) return []

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
      return {
        id: `clip-like:${id}`,
        type: "clip_comment" as const,
        category: "clip" as const,
        actorName,
        actorAvatarUrl: profile?.avatarUrl,
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

function mapDbNotification(row: Awaited<ReturnType<typeof fetchMyNotifications>>[number]): FeedNotification {
  const type = row.type
  const category = categoryFromType(type)
  const actorName = row.actorName || "친구"
  const tripId =
    type === "trip_invite" || type === "clip_invite" ? row.referenceId : undefined
  const actionId =
    row.tripMemberId ||
    (type === "friend_request" ? row.referenceId : undefined) ||
    row.referenceId ||
    row.id

  let actionState: NotificationActionState = "pending"
  if (row.status === "accepted") actionState = "accepted"
  else if (row.status === "declined" || row.status === "rejected") actionState = "declined"
  else if (row.status === "dismissed") actionState = "dismissed"

  return {
    id: `notif:${row.id}`,
    type,
    category,
    actorName,
    actorAvatarUrl: row.actorAvatarUrl,
    tripId,
    tripTitle: row.tripTitle,
    message: row.message || `${actorName}님의 알림`,
    createdAt: row.createdAt,
    actionState,
    actionId: String(actionId ?? "").trim(),
    notificationId: row.id,
  }
}

export async function fetchFeedNotifications(): Promise<FeedNotification[]> {
  const dbRows = await fetchMyNotifications()

  if (dbRows.length > 0) {
    const mapped = dbRows.map(mapDbNotification)
    // Merge friend requests that may not have notification rows yet
    const friendFallback = await fetchFriendRequestNotificationsFallback()
    const existingFriendIds = new Set(
      mapped
        .filter((item) => item.type === "friend_request")
        .map((item) => item.actionId)
    )
    const mergedFriends = friendFallback.filter(
      (item) => !existingFriendIds.has(item.actionId)
    )

    // Merge pending trip invites missing from notifications table
    const tripFallback = await fetchTripInviteNotificationsFallback()
    const existingTripMemberIds = new Set(
      mapped
        .filter((item) => item.type === "trip_invite")
        .map((item) => item.actionId)
    )
    const mergedTrips = tripFallback.filter(
      (item) => !existingTripMemberIds.has(item.actionId)
    )

    const hasClipNotifs = mapped.some((item) => CLIP_TYPES.includes(item.type))
    const clips = hasClipNotifs ? [] : await fetchClipActivityFallback()

    return [...mapped, ...mergedFriends, ...mergedTrips, ...clips].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  // Full fallback when notifications table is empty / missing
  const [trips, friends, clips] = await Promise.all([
    fetchTripInviteNotificationsFallback(),
    fetchFriendRequestNotificationsFallback(),
    fetchClipActivityFallback(),
  ])

  return [...trips, ...friends, ...clips].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function acceptFeedNotification(
  item: FeedNotification
): Promise<{ toast: string; tripId?: string }> {
  if (item.type === "trip_invite" || item.type === "clip_invite") {
    if (!item.actionId) throw new Error("초대 정보가 없어요.")
    await acceptTripInvitation(item.actionId)
    if (item.notificationId) {
      await updateNotificationStatus(item.notificationId, "accepted")
    }
    return {
      toast: "여행 멤버로 합류했습니다!",
      tripId: item.tripId,
    }
  }

  if (item.type === "friend_request") {
    await acceptFriendRequest(item.actionId)
    if (item.notificationId) {
      await updateNotificationStatus(item.notificationId, "accepted")
    }
    return { toast: `${item.actorName}님과 친구가 되었어요.` }
  }

  // clip_like / clip_comment — mark accepted/read, keep row
  if (item.notificationId) {
    await updateNotificationStatus(item.notificationId, "accepted")
  }
  return { toast: "확인했습니다." }
}

export async function rejectFeedNotification(
  item: FeedNotification
): Promise<{ toast: string }> {
  if (item.type === "trip_invite" || item.type === "clip_invite") {
    if (item.actionId) {
      await rejectTripInvitation(item.actionId)
    }
    if (item.notificationId) {
      await updateNotificationStatus(item.notificationId, "declined")
    }
    return { toast: "초대를 거절했어요." }
  }

  if (item.type === "friend_request") {
    await rejectFriendRequest(item.actionId)
    if (item.notificationId) {
      await updateNotificationStatus(item.notificationId, "declined")
    }
    return { toast: "친구 요청을 거절했어요." }
  }

  if (item.notificationId) {
    await updateNotificationStatus(item.notificationId, "declined")
  }
  return { toast: "알림을 거절했어요." }
}

/** Pending actionable count (trip/clip invites + friend requests). */
export function countActionableNotifications(items: FeedNotification[]): number {
  return items.filter(
    (item) =>
      item.actionState === "pending" &&
      (item.type === "trip_invite" ||
        item.type === "clip_invite" ||
        item.type === "friend_request")
  ).length
}
