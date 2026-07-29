import { getCurrentUserId } from "@/lib/auth-session"
import { createClient } from "@/utils/supabase/client"

export type NotificationType =
  | "trip_invite"
  | "clip_invite"
  | "friend_request"
  | "clip_like"
  | "clip_comment"

export type NotificationRowStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "rejected"
  | "dismissed"

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
  sender_id?: string | null
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
  if (typeof err === "object") {
    const row = err as {
      message?: unknown
      details?: unknown
      hint?: unknown
      code?: unknown
    }
    const parts = [row.message, row.details, row.hint, row.code]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
    if (parts.length > 0) return parts.join(" | ")
  }
  return "알 수 없는 오류"
}

function isMissingTableError(message: string) {
  return /notifications|relation .* does not exist|could not find the table/i.test(message)
}

function isMissingColumnError(message: string) {
  return /column .* does not exist|Could not find the/i.test(message)
}

function mapRow(row: DbNotificationRow): AppNotificationRow | null {
  const id = String(row.id ?? "").trim()
  const userId = String(row.user_id ?? "").trim()
  const type = String(row.type ?? "").trim() as NotificationType
  if (!id || !userId || !type) return null
  // Prefer actor_id (canonical sender); fall back to sender_id for legacy rows
  const actorId =
    String(row.actor_id ?? "").trim() || String(row.sender_id ?? "").trim() || undefined
  return {
    id,
    userId,
    actorId,
    type,
    message: String(row.message ?? "").trim(),
    referenceId: String(row.reference_id ?? "").trim() || undefined,
    tripMemberId: String(row.trip_member_id ?? "").trim() || undefined,
    isRead: Boolean(row.is_read),
    status: (String(row.status ?? "pending").trim() || "pending") as NotificationRowStatus,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Resolve invitee auth UUID from userId / email / nickname via `profiles`.
 */
export async function resolveInviteeUserId(input: {
  userId?: string | null
  email?: string | null
  nickname?: string | null
  name?: string | null
}): Promise<string> {
  const client = createClient()
  const directId = String(input.userId ?? "").trim()
  const email = String(input.email ?? "").trim().toLowerCase()
  const nickname = String(input.nickname ?? input.name ?? "").trim()

  if (directId && UUID_RE.test(directId)) {
    const { data, error } = await client
      .from("profiles")
      .select("id")
      .eq("id", directId)
      .maybeSingle()
    if (error) {
      console.error("[resolveInviteeUserId] profiles by id:", formatError(error))
    }
    const found = String((data as { id?: string } | null)?.id ?? "").trim()
    if (found) return found
    // Auth UUID may exist even if profile row is missing — still usable for trip_members FK
    console.warn(
      "[resolveInviteeUserId] profile missing for UUID — using provided userId:",
      directId
    )
    return directId
  }

  if (email) {
    const { data, error } = await client
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .limit(1)
      .maybeSingle()
    if (error) console.error("[resolveInviteeUserId] profiles by email:", formatError(error))
    const found = String((data as { id?: string } | null)?.id ?? "").trim()
    if (found) return found
  }

  if (nickname) {
    const { data, error } = await client
      .from("profiles")
      .select("id, nickname")
      .ilike("nickname", nickname)
      .limit(1)
      .maybeSingle()
    if (error) console.error("[resolveInviteeUserId] profiles by nickname:", formatError(error))
    const found = String((data as { id?: string } | null)?.id ?? "").trim()
    if (found) return found
  }

  throw new Error(
    "초대 대상 사용자를 찾지 못했어요. 이메일/닉네임으로 가입된 계정인지 확인해 주세요."
  )
}

/**
 * Sole write path for creating notifications.
 * Uses SECURITY DEFINER RPC `create_notification_safe` (never direct table INSERT)
 * so inviters can notify other users without hitting RLS 42501.
 *
 * Call sites: createTripInviteNotification (trip-members-api), sendFriendRequest (friends-api).
 *
 * Canonical columns:
 * - `user_id`  = recipient (피초대자 / 친구요청 수신자)
 * - `actor_id` = sender (초대한 사람 / 친구요청 발신자)
 */
export async function createNotification(
  input: {
    /** Recipient — notifications.user_id */
    userId: string
    /** Sender — notifications.actor_id */
    actorId: string
    /** @deprecated Use actorId. Kept for call-site compat. */
    senderId?: string | null
    type: NotificationType
    message: string
    referenceId?: string | null
    tripMemberId?: string | null
  },
  options?: { throwOnError?: boolean }
): Promise<AppNotificationRow | null> {
  const recipientUserId = String(input.userId ?? "").trim()
  const actorUserId = String(input.actorId ?? input.senderId ?? "").trim()
  const message = String(input.message ?? "").trim()
  const referenceId = String(input.referenceId ?? "").trim() || null
  const tripMemberId = String(input.tripMemberId ?? "").trim() || null

  if (!recipientUserId || !message) {
    console.error("[createNotification] missing user_id (recipient) or message", {
      user_id: recipientUserId,
      actor_id: actorUserId,
      message,
    })
    if (options?.throwOnError !== false) {
      throw new Error("알림 생성에 필요한 정보가 없어요.")
    }
    return null
  }

  if (!actorUserId) {
    console.error("[createNotification] missing actor_id (sender)", {
      user_id: recipientUserId,
    })
    if (options?.throwOnError !== false) {
      throw new Error("알림 발신자(actor_id)가 없어요.")
    }
    return null
  }

  if (recipientUserId === actorUserId) {
    console.error("[createNotification] actor_id and user_id must differ", {
      user_id: recipientUserId,
      actor_id: actorUserId,
    })
    if (options?.throwOnError !== false) {
      throw new Error("알림 발신자와 수신자가 같을 수 없어요.")
    }
    return null
  }

  const client = createClient()

  console.info("[createNotification] RPC attempt", {
    p_user_id: recipientUserId,
    p_actor_id: actorUserId,
    p_type: input.type,
    p_reference_id: referenceId,
    p_trip_member_id: tripMemberId,
  })

  const { data, error } = await client.rpc("create_notification_safe", {
    p_user_id: recipientUserId,
    p_actor_id: actorUserId,
    p_type: input.type,
    p_message: message,
    p_reference_id: referenceId,
    p_trip_member_id: tripMemberId,
  })

  if (error) {
    console.error("[createNotification] RPC insert failed:", error)
    const messageText = formatError(error)
    if (options?.throwOnError === false) return null
    throw new Error(
      messageText ||
        "알림 생성에 실패했어요. Supabase에서 create_notification_safe RPC를 확인해 주세요."
    )
  }

  // RPC may return a row object, an id uuid, or an array depending on definition
  const row = Array.isArray(data) ? data[0] : data
  if (row && typeof row === "object") {
    const mapped = mapRow(row as DbNotificationRow)
    if (mapped) {
      console.info("[createNotification] ok", {
        id: mapped.id,
        user_id: mapped.userId,
        actor_id: mapped.actorId,
        trip_member_id: mapped.tripMemberId ?? tripMemberId,
        type: mapped.type,
      })
      return mapped
    }
  }

  console.info("[createNotification] ok (rpc raw)", data)
  return {
    id: String(row ?? "").trim() || crypto.randomUUID(),
    userId: recipientUserId,
    actorId: actorUserId,
    type: input.type,
    message,
    referenceId: referenceId || undefined,
    tripMemberId: tripMemberId || undefined,
    isRead: false,
    status: "pending",
    createdAt: new Date().toISOString(),
  }
}

export async function fetchMyNotifications(): Promise<AppNotificationRow[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const client = createClient()
  const selectFull =
    "id, user_id, sender_id, actor_id, type, message, reference_id, trip_member_id, is_read, status, created_at"
  const selectBasic =
    "id, user_id, sender_id, actor_id, type, message, reference_id, is_read, created_at"

  let data: DbNotificationRow[] | null = null
  let error: { message?: string } | null = null

  // Keep history: pending + accepted + declined (and legacy rejected)
  {
    const result = await client
      .from("notifications")
      .select(selectFull)
      .eq("user_id", userId)
      .in("status", ["pending", "accepted", "declined", "rejected", "dismissed"])
      .order("created_at", { ascending: false })
      .limit(100)
    data = result.data as DbNotificationRow[] | null
    error = result.error
  }

  if (error && isMissingColumnError(formatError(error))) {
    const result = await client
      .from("notifications")
      .select(selectBasic)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)
    data = result.data as DbNotificationRow[] | null
    error = result.error
  }

  if (error) {
    // Broad fetch without status filter
    const result = await client
      .from("notifications")
      .select(selectFull)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)
    if (!result.error) {
      data = result.data as DbNotificationRow[] | null
      error = null
    } else {
      data = null
      error = result.error
    }
  }

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
    .filter((row) =>
      ["pending", "accepted", "declined", "rejected"].includes(row.status)
    )

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

/**
 * Update notification status without deleting the row (history preserved).
 * - accept → status='accepted', is_read=true
 * - decline → status='declined', is_read=true
 */
export async function updateNotificationStatus(
  notificationId: string,
  status: NotificationRowStatus
): Promise<void> {
  const id = String(notificationId ?? "").trim()
  if (!id) return

  const userId = await getCurrentUserId()
  if (!userId) return

  const client = createClient()
  const payload = { is_read: true, status }

  const { error } = await client
    .from("notifications")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)

  if (!error) {
    console.info("[updateNotificationStatus] ok", { id, status })
    return
  }

  const messageText = formatError(error)
  console.error("[updateNotificationStatus]", messageText)

  // Legacy DBs that only allow 'rejected' instead of 'declined'
  if (status === "declined" && /check|constraint|invalid/i.test(messageText)) {
    const retry = await client
      .from("notifications")
      .update({ is_read: true, status: "rejected" })
      .eq("id", id)
      .eq("user_id", userId)
    if (!retry.error) return
    console.error("[updateNotificationStatus] rejected fallback:", formatError(retry.error))
  }

  // Fallback without status column
  if (isMissingColumnError(messageText)) {
    const retry = await client
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", userId)
    if (retry.error) console.error("[updateNotificationStatus] is_read only:", formatError(retry.error))
    return
  }

  throw new Error(messageText || "알림 상태 업데이트에 실패했어요.")
}

/** @deprecated Prefer updateNotificationStatus */
export async function markNotificationRead(
  notificationId: string,
  status: NotificationRowStatus = "accepted"
): Promise<void> {
  await updateNotificationStatus(notificationId, status)
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
  if (!id) return "누군가"
  const client = createClient()

  try {
    const { data: authData } = await client.auth.getUser()
    if (authData.user?.id === id) {
      const meta = (authData.user.user_metadata ?? {}) as Record<string, unknown>
      const metaName = [meta.full_name, meta.name, meta.nickname, meta.preferred_username]
        .map((value) => String(value ?? "").trim())
        .find(Boolean)
      if (metaName) return metaName
    }
  } catch {
    // ignore
  }

  const { data } = await client
    .from("profiles")
    .select("nickname, email")
    .eq("id", id)
    .maybeSingle()
  const email = String((data as { email?: string } | null)?.email ?? "").trim()
  return (
    String((data as { nickname?: string } | null)?.nickname ?? "").trim() ||
    (email ? email.split("@")[0] : "") ||
    "누군가"
  )
}
