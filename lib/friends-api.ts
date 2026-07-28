import { createClient } from "@/utils/supabase/client"

export type UserSummary = {
  userId: string
  nickname: string
  email: string
  avatarUrl?: string
}

export type FriendshipStatus = "pending" | "accepted" | "rejected"

/** friendships row: user_id = requester, friend_id = receiver */
export type FriendshipRow = {
  id: string
  user_id: string
  friend_id: string
  status: FriendshipStatus
  created_at?: string
}

export type JoinedProfile = {
  id?: string
  user_id?: string
  email?: string
  nickname?: string
  avatar_url?: string
  profile_image?: string
}

export type FriendshipJoinedRow = FriendshipRow & {
  user_profile?: JoinedProfile | null
  friend_profile?: JoinedProfile | null
}

function safeNameFromEmail(email: string) {
  const value = String(email ?? "").trim()
  if (!value) return "사용자"
  return value.split("@")[0] || "사용자"
}

export function profileToUserSummary(
  row: JoinedProfile | Record<string, unknown> | null | undefined
): UserSummary | null {
  if (!row) return null
  const record = row as Record<string, unknown>
  const userId = String(record.user_id ?? record.id ?? "").trim()
  if (!userId) return null
  const email = String(record.email ?? "").trim()
  const nickname = String(record.nickname ?? "").trim() || safeNameFromEmail(email)
  const avatarUrl =
    String(record.avatar_url ?? record.profile_image ?? "").trim() || undefined
  return { userId, email, nickname, avatarUrl }
}

function logSupabaseError(scope: string, error: { message?: string; details?: string; hint?: string }) {
  console.error(`[${scope}]`, error.message, error.details, error.hint)
}

export async function getCurrentAuthUserId() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return String(data.user?.id ?? "").trim() || null
}

/**
 * Search users from `profiles` by email / nickname (ilike).
 * Excludes the current user.
 */
export async function searchUsers(keyword: string, currentUserId: string): Promise<UserSummary[]> {
  const q = String(keyword ?? "").trim()
  if (!q) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, nickname, avatar_url")
    .or(`nickname.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(40)

  if (error) {
    logSupabaseError("searchUsers", error)
    throw error
  }

  const unique = new Map<string, UserSummary>()
  for (const raw of (data as JoinedProfile[] | null) ?? []) {
    const mapped = profileToUserSummary(raw)
    if (!mapped?.userId) continue
    if (mapped.userId === currentUserId) continue
    if (String(raw.id ?? "").trim() === currentUserId) continue
    if (!unique.has(mapped.userId)) unique.set(mapped.userId, mapped)
  }
  return [...unique.values()]
}

/** INSERT pending friendship: user_id = me, friend_id = target */
export async function sendFriendRequest(currentUserId: string, targetUserId: string) {
  const supabase = createClient()
  const payload = {
    user_id: currentUserId,
    friend_id: targetUserId,
    status: "pending" as const,
  }

  const { data, error } = await supabase
    .from("friendships")
    .insert(payload)
    .select("id")
    .maybeSingle()

  if (error) {
    logSupabaseError("sendFriendRequest", error)
    throw error
  }

  try {
    const { createNotification, resolveActorDisplayName } = await import(
      "@/lib/notifications-api"
    )
    const actorName = await resolveActorDisplayName(currentUserId)
    await createNotification({
      userId: targetUserId,
      actorId: currentUserId,
      type: "friend_request",
      message: `${actorName}님이 친구 요청을 보냈습니다.`,
      referenceId: String((data as { id?: string } | null)?.id ?? "").trim() || null,
    })
  } catch (err) {
    console.warn(
      "[sendFriendRequest] notification skipped:",
      err instanceof Error ? err.message : err
    )
  }
}

export async function fetchFriendships(currentUserId: string): Promise<FriendshipJoinedRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("friendships")
    .select(
      "*, user_profile:profiles!friendships_user_id_fkey(id, email, nickname, avatar_url), friend_profile:profiles!friendships_friend_id_fkey(id, email, nickname, avatar_url)"
    )
    .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
    .order("created_at", { ascending: false })

  if (error) {
    logSupabaseError("fetchFriendships", error)
    throw error
  }
  return (data as FriendshipJoinedRow[] | null) ?? []
}

export async function acceptFriendRequest(requestId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", requestId)

  if (error) {
    logSupabaseError("acceptFriendRequest", error)
    throw error
  }
}

/** Reject = DELETE the friendship row */
export async function rejectFriendRequest(requestId: string) {
  const supabase = createClient()
  const { error } = await supabase.from("friendships").delete().eq("id", requestId)

  if (error) {
    logSupabaseError("rejectFriendRequest", error)
    throw error
  }
}

/** @deprecated Prefer acceptFriendRequest / rejectFriendRequest */
export async function updateFriendRequestStatus(
  requestId: string,
  status: Exclude<FriendshipStatus, "pending">
) {
  if (status === "rejected") {
    await rejectFriendRequest(requestId)
    return
  }
  await acceptFriendRequest(requestId)
}

export async function resolveUsersByIds(userIds: string[]): Promise<Record<string, UserSummary>> {
  const ids = [...new Set(userIds.map((id) => String(id ?? "").trim()).filter(Boolean))]
  if (ids.length === 0) return {}

  const supabase = createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, nickname, avatar_url")
    .in("id", ids)
    .limit(500)

  if (error) {
    logSupabaseError("resolveUsersByIds", error)
    return Object.fromEntries(
      ids.map((id) => [id, { userId: id, nickname: "사용자", email: "" } as UserSummary])
    )
  }

  const byId: Record<string, UserSummary> = {}
  for (const raw of (data as JoinedProfile[] | null) ?? []) {
    const mapped = profileToUserSummary(raw)
    if (!mapped) continue
    byId[mapped.userId] = mapped
    const profileId = String(raw.id ?? "").trim()
    if (profileId) byId[profileId] = mapped
  }

  for (const id of ids) {
    if (!byId[id]) {
      byId[id] = { userId: id, nickname: "사용자", email: "" }
    }
  }
  return byId
}

export type CoTraveler = UserSummary & {
  tripId: string
  tripTitle: string
  groupTag: string
}

type CoTravelerMemberRow = {
  trip_id?: string
  user_id?: string
  role?: string | null
  profiles?: JoinedProfile | JoinedProfile[] | null
}

function profileFromJoin(
  profiles: JoinedProfile | JoinedProfile[] | null | undefined
): JoinedProfile | null {
  if (!profiles) return null
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles
}

/**
 * People who share a trip with the current user (e.g. Paris group members).
 * Prefers the Paris trip when present.
 * Nicknames/avatars come from `profiles` via `trip_members.user_id` join.
 */
export async function fetchCoTravelers(currentUserId: string): Promise<CoTraveler[]> {
  const uid = String(currentUserId ?? "").trim()
  if (!uid) return []

  const supabase = createClient()

  const { data: myMemberships, error: mineError } = await supabase
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", uid)

  if (mineError) {
    logSupabaseError("fetchCoTravelers.mine", mineError)
    return []
  }

  let tripIds = [
    ...new Set(
      ((myMemberships as Array<{ trip_id?: string }> | null) ?? [])
        .map((row) => String(row.trip_id ?? "").trim())
        .filter(Boolean)
    ),
  ]

  if (tripIds.length === 0) return []

  // Prefer FK embed; fall back without `role` if that column is missing.
  let peerRows: CoTravelerMemberRow[] | null = null
  {
    const withRole = await supabase
      .from("trip_members")
      .select(
        `
        trip_id,
        user_id,
        role,
        profiles:user_id (
          id,
          nickname,
          avatar_url,
          email
        )
      `
      )
      .in("trip_id", tripIds)

    if (withRole.error && /role|column .* does not exist/i.test(withRole.error.message ?? "")) {
      const withoutRole = await supabase
        .from("trip_members")
        .select(
          `
          trip_id,
          user_id,
          profiles:user_id (
            id,
            nickname,
            avatar_url,
            email
          )
        `
        )
        .in("trip_id", tripIds)

      if (withoutRole.error) {
        logSupabaseError("fetchCoTravelers.peers", withoutRole.error)
        return []
      }
      peerRows = (withoutRole.data as CoTravelerMemberRow[] | null) ?? []
    } else if (withRole.error) {
      // Embed hint may differ — 2-step: members then profiles
      logSupabaseError("fetchCoTravelers.peers", withRole.error)
      const plain = await supabase
        .from("trip_members")
        .select("trip_id, user_id")
        .in("trip_id", tripIds)

      if (plain.error) {
        logSupabaseError("fetchCoTravelers.peers.plain", plain.error)
        return []
      }

      const plainRows = (plain.data as Array<{ trip_id?: string; user_id?: string }> | null) ?? []
      const userIds = [
        ...new Set(plainRows.map((row) => String(row.user_id ?? "").trim()).filter(Boolean)),
      ]
      const profilesById = userIds.length > 0 ? await resolveUsersByIds(userIds) : {}

      peerRows = plainRows.map((row) => {
        const userId = String(row.user_id ?? "").trim()
        const profile = profilesById[userId]
        return {
          trip_id: row.trip_id,
          user_id: userId,
          profiles: profile
            ? {
                id: profile.userId,
                nickname: profile.nickname,
                avatar_url: profile.avatarUrl,
                email: profile.email,
              }
            : null,
        }
      })
    } else {
      peerRows = (withRole.data as CoTravelerMemberRow[] | null) ?? []
    }
  }

  const peers = (peerRows ?? []).filter((row) => String(row.user_id ?? "").trim() !== uid)
  if (peers.length === 0) return []

  const tripTitleById: Record<string, string> = {}
  const { data: tripRows } = await supabase.from("trips").select("id, title").in("id", tripIds)
  for (const row of (tripRows as Array<{ id?: string; title?: string }> | null) ?? []) {
    const id = String(row.id ?? "").trim()
    if (id) tripTitleById[id] = String(row.title ?? "").trim() || "여행"
  }

  const result: CoTraveler[] = []
  const seen = new Set<string>()

  for (const row of peers) {
    const userId = String(row.user_id ?? "").trim()
    const tripId = String(row.trip_id ?? "").trim()
    if (!userId || !tripId || seen.has(userId)) continue
    seen.add(userId)

    const profile = profileFromJoin(row.profiles)
    const email = String(profile?.email ?? "").trim()
    const nickname =
      String(profile?.nickname ?? "").trim() ||
      (email ? email.split("@")[0] : "") ||
      "멤버"
    const avatarUrl = String(profile?.avatar_url ?? "").trim() || undefined
    const tripTitle = tripTitleById[tripId] || "여행"
    const groupTag = `${tripTitle} 그룹`

    result.push({
      userId,
      nickname,
      email,
      avatarUrl,
      tripId,
      tripTitle,
      groupTag,
    })
  }

  return result
}

