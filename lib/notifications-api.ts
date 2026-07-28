import { getCurrentUserId } from "@/lib/auth-session"
import { createClient } from "@/utils/supabase/client"

export type NotificationType =
  | "trip_invite"
  | "clip_invite"
  | "friend_request"
  | "clip_like"
  | "clip_comment"

export type NotificationRowStatus = "pending" | "accepted" | "rejected" | "dismissed"

export type AppNotificationRow = {
  id: string
  userId: string
  actorId?: string
  type: NotificationType
  message: string
  referenceId?: string
  tripMemberId?: string
  isRead: boolean
  status: NotificationRowStatus
  createdAt: string
  actorName?: string
  actorAvatarUrl?: string
  tripTitle?: string
}

type DbNotificationRow = {
  id?: string
  user_id?: string
  actor_id?: string | null
  type?: string
  message?: string | null
  reference_id?: string | null
  trip_member_id?: string | null
  is_read?: boolean | null
  status?: string | null
  created_at?: string | null
}

function formatError(err: unknown) {
  if (err == null) return "알 수 없는 오류"
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message
  if (typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message ?? "알 수 없는 오류")
  }
  return "알 수 없는 오류"
}

function isMissingTableError(message: string) {
  return /notifications|relation .* does not exist|could not find the table/i.test(message)
}

function mapRow(row: DbNotificationRow): AppNotificationRow | null {
  const id = String(row.id ?? "").trim()
  const userId = String(row.user_id ?? "").trim()
  const type = String(row.type ?? "").trim() as NotificationType
  if (!id || !userId || !type) return null
  return {
    id,
    userId,
    actorId: String(row.actor_id ?? "").trim() || undefined,
    type,
    message: String(row.message ?? "").trim(),
    referenceId: String(row.reference_id ?? "").trim() || undefined,
    tripMemberId: String(row.trip_member_id ?? "").trim() || undefined,
    isRead: Boolean(row.is_read),
    status: (String(row.status ?? "pending").trim() || "pending") as NotificationRowStatus,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }
}

export async function createNotification(input: {
  /** Recipient (invited user) */
  userId: string
  actorId?: string | null
  type: NotificationType
  message: string
  referenceId?: string | null
  tripMemberId?: string | null
}): Promise<AppNotificationRow | null> {
  const userId = String(input.userId ?? "").trim()
  const message = String(input.message ?? "").trim()
  if (!userId || !message) return null

  const client = createClient()
  const actorId = String(input.actorId ?? "").trim() || null
  const referenceId = String(input.referenceId ?? "").trim() || null
  const tripMemberId = String(input.tripMemberId ?? "").trim() || null

  // Replace prior pending invite of the same type + reference for this user
  if (referenceId && (input.type === "trip_invite" || input.type === "clip_invite")) {
    await client
      .from("notifications")
      .delete()
      .eq("user_id", userId)
      .eq("type", input.type)
      .eq("reference_id", referenceId)
      .eq("status", "pending")
  }

  const { data, error } = await client
    .from("notifications")
    .insert({
      user_id: userId,
      actor_id: actorId,
      type: input.type,
      message,
      reference_id: referenceId,
      trip_member_id: tripMemberId,
      is_read: false,
      status: "pending",
    })
    .select(
      "id, user_id, actor_id, type, message, reference_id, trip_member_id, is_read, status, created_at"
    )
    .maybeSingle()

  if (error) {
    const messageText = formatError(error)
    if (isMissingTableError(messageText)) {
      console.warn(
        "[createNotification] notifications table missing — run supabase/notifications.sql"
      )
      return null
    }
    console.error("[createNotification]", messageText)
    return null
  }

  return data ? mapRow(data as DbNotificationRow) : null
}

export async function fetchMyNotifications(): Promise<AppNotificationRow[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const client = createClient()
  const { data, error } = await client
    .from("notifications")
    .select(
      "id, user_id, actor_id, type, message, reference_id, trip_member_id, is_read, status, created_at"
    )
    .eq("user_id", userId)
    .in("status", ["pending"])
    .order("created_at", { ascending: false })
    .limit(80)

  if (error) {
    const messageText = formatError(error)
    if (isMissingTableError(messageText)) {
      console.warn(
        "[fetchMyNotifications] notifications table missing — run supabase/notifications.sql"
      )
      return []
    }
    console.error("[fetchMyNotifications]", messageText)
    return []
  }

  const rows = ((data as DbNotificationRow[] | null) ?? [])
    .map(mapRow)
    .filter((row): row is AppNotificationRow => Boolean(row))

  const actorIds = [
    ...new Set(rows.map((row) => String(row.actorId ?? "").trim()).filter(Boolean)),
  ]

  if (actorIds.length === 0) return rows

  const { data: profiles, error: profileError } = await client
    .from("profiles")
    .select("id, nickname, avatar_url, email")
    .in("id", actorIds)

  if (profileError) {
    console.error("[fetchMyNotifications] profiles:", profileError.message)
    return rows
  }

  const profileMap = new Map<
    string,
    { nickname?: string | null; avatar_url?: string | null; email?: string | null }
  >()
  for (const profile of (profiles as Array<{
    id?: string
    nickname?: string | null
    avatar_url?: string | null
    email?: string | null
  }> | null) ?? []) {
    const id = String(profile.id ?? "").trim()
    if (id) profileMap.set(id, profile)
  }

  // Resolve trip titles for invite notifications
  const tripIds = [
    ...new Set(
      rows
        .filter((row) => row.type === "trip_invite" || row.type === "clip_invite")
        .map((row) => String(row.referenceId ?? "").trim())
        .filter(Boolean)
    ),
  ]

  const tripTitleMap = new Map<string, string>()
  if (tripIds.length > 0) {
    const { data: trips } = await client.from("trips").select("id, title").in("id", tripIds)
    for (const trip of (trips as Array<{ id?: string; title?: string | null }> | null) ?? []) {
      const id = String(trip.id ?? "").trim()
      if (id) tripTitleMap.set(id, String(trip.title ?? "").trim() || "여행")
    }
  }

  return rows.map((row) => {
    const profile = row.actorId ? profileMap.get(row.actorId) : undefined
    const email = String(profile?.email ?? "").trim()
    const actorName =
      String(profile?.nickname ?? "").trim() ||
      (email ? email.split("@")[0] : "") ||
      "친구"
    const actorAvatarUrl = String(profile?.avatar_url ?? "").trim() || undefined
    const tripTitle =
      row.referenceId && tripTitleMap.has(row.referenceId)
        ? tripTitleMap.get(row.referenceId)
        : undefined
    return {
      ...row,
      actorName,
      actorAvatarUrl,
      tripTitle,
    }
  })
}

export async function markNotificationRead(
  notificationId: string,
  status: NotificationRowStatus = "accepted"
): Promise<void> {
  const id = String(notificationId ?? "").trim()
  if (!id) return

  const userId = await getCurrentUserId()
  if (!userId) return

  const client = createClient()
  const { error } = await client
    .from("notifications")
    .update({ is_read: true, status })
    .eq("id", id)
    .eq("user_id", userId)

  if (error && !isMissingTableError(formatError(error))) {
    console.error("[markNotificationRead]", formatError(error))
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const id = String(notificationId ?? "").trim()
  if (!id) return

  const userId = await getCurrentUserId()
  if (!userId) return

  const client = createClient()
  const { error } = await client
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)

  if (error && !isMissingTableError(formatError(error))) {
    console.error("[deleteNotification]", formatError(error))
  }
}

export async function resolveActorDisplayName(userId: string): Promise<string> {
  const id = String(userId ?? "").trim()
  if (!id) return "친구"
  const client = createClient()
  const { data } = await client
    .from("profiles")
    .select("nickname, email")
    .eq("id", id)
    .maybeSingle()
  const email = String((data as { email?: string } | null)?.email ?? "").trim()
  return (
    String((data as { nickname?: string } | null)?.nickname ?? "").trim() ||
    (email ? email.split("@")[0] : "") ||
    "친구"
  )
}
