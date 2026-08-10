import { createClient } from "@/utils/supabase/client"
import { getCurrentUserId } from "@/lib/auth-session"
import {
  createNotification,
  resolveActorDisplayName,
  resolveInviteeUserId,
} from "@/lib/notifications-api"
import { toTripGroupMember, type TripGroupMember } from "@/lib/trip-group"

function formatMemberError(err: unknown) {
  if (err == null) return "알 수 없는 오류"
  if (typeof err === "string") return err.trim() || "알 수 없는 오류"
  if (err instanceof Error && err.message) return err.message
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

export type TripMemberStatus = "pending" | "accepted" | "rejected"

export type TripMember = {
  id: string
  userId: string
  email: string
  name: string
  avatarUrl?: string
  role?: string
  status?: TripMemberStatus
}

export type TripInvitation = {
  id: string
  tripId: string
  tripTitle: string
  inviterName: string
  inviterAvatarUrl?: string
  createdAt?: string
}

type ProfileJoin = {
  id?: string
  email?: string | null
  nickname?: string | null
  full_name?: string | null
  avatar_url?: string | null
}

type TripMemberJoinedRow = {
  id?: string
  trip_id?: string
  user_id?: string
  role?: string | null
  status?: string | null
  profiles?: ProfileJoin | ProfileJoin[] | null
}

const MEMBER_SELECT_WITH_ROLE = `
  id,
  trip_id,
  user_id,
  role,
  status,
  profiles:user_id (
    id,
    nickname,
    avatar_url,
    email
  )
`

const MEMBER_SELECT_NO_ROLE = `
  id,
  trip_id,
  user_id,
  status,
  profiles:user_id (
    id,
    nickname,
    avatar_url,
    email
  )
`

const MEMBER_SELECT_LEGACY = `
  id,
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

function normalizeStatus(value: unknown): TripMemberStatus {
  const raw = String(value ?? "").trim().toLowerCase()
  if (raw === "pending" || raw === "rejected" || raw === "accepted") return raw
  // Legacy rows without status are treated as accepted
  return "accepted"
}

function unwrapProfile(
  profiles: ProfileJoin | ProfileJoin[] | null | undefined
): ProfileJoin | null {
  if (!profiles) return null
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles
}

/** Prefer nickname / full_name; never expose raw email as the label. */
export function resolveProfileDisplayName(profile: {
  nickname?: string | null
  full_name?: string | null
  name?: string | null
  email?: string | null
} | null | undefined): string {
  const nickname = String(profile?.nickname ?? "").trim()
  if (nickname && !nickname.includes("@")) return nickname

  const fullName = String(profile?.full_name ?? profile?.name ?? "").trim()
  if (fullName && !fullName.includes("@")) return fullName

  // Nickname may incorrectly store an email — strip domain.
  if (nickname.includes("@")) return nickname.split("@")[0] || "멤버"

  const email = String(profile?.email ?? "").trim()
  if (email.includes("@")) return email.split("@")[0] || "멤버"
  if (email) return email
  return "멤버"
}

function mapJoinedRow(row: TripMemberJoinedRow): TripMember | null {
  const userId = String(row.user_id ?? "").trim()
  if (!userId) return null

  const profile = unwrapProfile(row.profiles)
  const email = String(profile?.email ?? "").trim()
  const name = resolveProfileDisplayName(profile)
  const avatarUrl = String(profile?.avatar_url ?? "").trim() || undefined
  const role = String(row.role ?? "").trim() || undefined

  return {
    id: String(row.id ?? userId),
    userId,
    email,
    name,
    avatarUrl,
    role,
    status: normalizeStatus(row.status),
  }
}

/**
 * Query trip_members with profiles join.
 * Falls back when `role` is missing or the FK embed hint fails.
 */
async function queryTripMembers(options: {
  tripId?: string
  tripIds?: string[]
}): Promise<TripMemberJoinedRow[]> {
  const client = createClient()
  const tripId = String(options.tripId ?? "").trim()
  const tripIds = (options.tripIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean)

  const runSelect = async (selectClause: string) => {
    let query = client.from("trip_members").select(selectClause)
    if (tripId) query = query.eq("trip_id", tripId)
    else if (tripIds.length > 0) query = query.in("trip_id", tripIds)
    return query
  }

  const withRole = await runSelect(MEMBER_SELECT_WITH_ROLE)

  if (!withRole.error) {
    return (withRole.data as TripMemberJoinedRow[] | null) ?? []
  }

  if (/status|column .* does not exist/i.test(withRole.error.message ?? "")) {
    const legacy = await runSelect(MEMBER_SELECT_LEGACY)
    if (!legacy.error) {
      return (legacy.data as TripMemberJoinedRow[] | null) ?? []
    }
  }

  if (/role|column .* does not exist/i.test(withRole.error.message ?? "")) {
    const withoutRole = await runSelect(MEMBER_SELECT_NO_ROLE)
    if (!withoutRole.error) {
      return (withoutRole.data as TripMemberJoinedRow[] | null) ?? []
    }
    console.error("[queryTripMembers] without role:", withoutRole.error.message)
  } else {
    console.error("[queryTripMembers] embed:", withRole.error.message)
  }

  // Final fallback: plain user_ids + separate profiles query
  const plain = await runSelect("id, trip_id, user_id")
  if (plain.error) {
    console.error("[queryTripMembers] plain:", plain.error.message)
    return []
  }

  const plainRows =
    (plain.data as Array<{
      id?: string
      trip_id?: string
      user_id?: string
    }> | null) ?? []
  const userIds = [
    ...new Set(plainRows.map((row) => String(row.user_id ?? "").trim()).filter(Boolean)),
  ]

  let profileMap = new Map<string, ProfileJoin>()
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await client
      .from("profiles")
      .select("id, email, nickname, avatar_url")
      .in("id", userIds)

    if (profileError) {
      console.error("[queryTripMembers] profiles:", profileError.message)
    } else {
      profileMap = new Map(
        ((profiles as ProfileJoin[] | null) ?? []).map((profile) => [
          String(profile.id ?? "").trim(),
          profile,
        ])
      )
    }
  }

  return plainRows.map((row) => {
    const userId = String(row.user_id ?? "").trim()
    return {
      id: row.id,
      trip_id: row.trip_id,
      user_id: userId,
      profiles: profileMap.get(userId) ?? null,
    }
  })
}

export async function fetchTripInviteCode(tripId: string): Promise<string | null> {
  const id = String(tripId ?? "").trim()
  if (!id) return null

  const client = createClient()
  const { data, error } = await client
    .from("trips")
    .select("invite_code")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error(
      "[fetchTripInviteCode] Supabase error:",
      error.message || error.details || error
    )
    return null
  }

  return String((data as { invite_code?: string | null } | null)?.invite_code ?? "").trim() || null
}

/**
 * Load trip_members with profiles (nickname / avatar / email) via user_id FK join.
 * Returns accepted members for the roster UI.
 */
export async function fetchTripMembers(tripId: string): Promise<TripMember[]> {
  const id = String(tripId ?? "").trim()
  if (!id) return []

  const rows = await queryTripMembers({ tripId: id })
  const result: TripMember[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const mapped = mapJoinedRow(row)
    if (!mapped || seen.has(mapped.userId)) continue
    // Roster shows accepted members only (pending stays in notification inbox)
    if (mapped.status && mapped.status !== "accepted") continue
    seen.add(mapped.userId)
    result.push(mapped)
  }

  return result
}

/**
 * 여행의 호스트(방장) = trips.user_id. 호스트는 모든 항목을 수정·삭제할 수 있다.
 */
export async function fetchTripOwnerId(tripId: string): Promise<string> {
  const id = String(tripId ?? "").trim()
  if (!id) return ""
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("trips")
      .select("user_id")
      .eq("id", id)
      .maybeSingle()
    if (error) {
      console.error("[fetchTripOwnerId]", error.message)
      return ""
    }
    return String((data as { user_id?: string | null } | null)?.user_id ?? "").trim()
  } catch (err) {
    console.error("[fetchTripOwnerId] unexpected:", err)
    return ""
  }
}

/**
 * Accepted members + trip owner (owner may not be in trip_members).
 * Used for flight passenger pickers and author display.
 */
export async function fetchTripRoster(tripId: string): Promise<TripMember[]> {
  const id = String(tripId ?? "").trim()
  if (!id) return []

  const members = await fetchTripMembers(id)
  const byId = new Map(members.map((member) => [member.userId, member]))

  try {
    const client = createClient()
    const { data: tripRow, error: tripError } = await client
      .from("trips")
      .select("user_id")
      .eq("id", id)
      .maybeSingle()

    if (tripError) {
      console.error("[fetchTripRoster] trip lookup:", tripError.message)
      return members
    }

    const ownerId = String((tripRow as { user_id?: string | null } | null)?.user_id ?? "").trim()
    if (!ownerId || byId.has(ownerId)) return members

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id, nickname, email, avatar_url")
      .eq("id", ownerId)
      .maybeSingle()

    if (profileError) {
      console.error("[fetchTripRoster] owner profile:", profileError.message)
    }

    const row = profile as ProfileJoin | null
    const name = resolveProfileDisplayName(row) || "여행 호스트"

    byId.set(ownerId, {
      id: `owner:${ownerId}`,
      userId: ownerId,
      email: String(row?.email ?? "").trim(),
      name,
      avatarUrl: String(row?.avatar_url ?? "").trim() || undefined,
      role: "owner",
      status: "accepted",
    })
  } catch (err) {
    console.error("[fetchTripRoster] unexpected:", err)
    return members
  }

  return Array.from(byId.values())
}

/**
 * Batch-load profiles for flight author / passenger chips.
 * Falls back gracefully when `full_name` column is missing.
 */
export async function fetchProfilesByIds(userIds: string[]): Promise<TripMember[]> {
  const ids = [
    ...new Set(userIds.map((id) => String(id ?? "").trim()).filter(Boolean)),
  ]
  if (ids.length === 0) return []

  const client = createClient()
  const mapRow = (row: ProfileJoin): TripMember | null => {
    const userId = String(row.id ?? "").trim()
    if (!userId) return null
    return {
      id: userId,
      userId,
      email: String(row.email ?? "").trim(),
      name: resolveProfileDisplayName(row),
      avatarUrl: String(row.avatar_url ?? "").trim() || undefined,
      status: "accepted",
    }
  }

  try {
    const withFullName = await client
      .from("profiles")
      .select("id, nickname, full_name, email, avatar_url")
      .in("id", ids)

    if (!withFullName.error) {
      return ((withFullName.data as ProfileJoin[] | null) ?? [])
        .map(mapRow)
        .filter((row): row is TripMember => Boolean(row))
    }

    if (!/full_name|column .* does not exist/i.test(withFullName.error.message ?? "")) {
      console.error("[fetchProfilesByIds]", withFullName.error.message)
    }

    const basic = await client
      .from("profiles")
      .select("id, nickname, email, avatar_url")
      .in("id", ids)

    if (basic.error) {
      console.error("[fetchProfilesByIds] basic:", basic.error.message)
      return []
    }

    return ((basic.data as ProfileJoin[] | null) ?? [])
      .map(mapRow)
      .filter((row): row is TripMember => Boolean(row))
  } catch (err) {
    console.error("[fetchProfilesByIds] unexpected:", err)
    return []
  }
}

/** All non-rejected membership states for invite UI (accepted + pending). */
export async function fetchTripMembershipStates(
  tripId: string
): Promise<Record<string, TripMemberStatus>> {
  const id = String(tripId ?? "").trim()
  if (!id) return {}

  const rows = await queryTripMembers({ tripId: id })
  const result: Record<string, TripMemberStatus> = {}
  for (const row of rows) {
    const mapped = mapJoinedRow(row)
    if (!mapped) continue
    if (mapped.status === "rejected") continue
    result[mapped.userId] = mapped.status ?? "accepted"
  }
  return result
}

export async function fetchTripGroupMembers(tripId: string): Promise<TripGroupMember[]> {
  const members = await fetchTripMembers(tripId)
  return members.map((member, index) =>
    toTripGroupMember({
      userId: member.userId,
      name: member.name,
      avatarUrl: member.avatarUrl,
      index,
    })
  )
}

/** Batch-load group members for many trips (used when listing home cards). */
export async function fetchGroupMembersByTripIds(
  tripIds: string[]
): Promise<Record<string, TripGroupMember[]>> {
  const ids = [...new Set(tripIds.map((id) => String(id ?? "").trim()).filter(Boolean))]
  const result: Record<string, TripGroupMember[]> = {}
  for (const id of ids) result[id] = []
  if (ids.length === 0) return result

  const rows = await queryTripMembers({ tripIds: ids })
  const counts = new Map<string, number>()

  for (const row of rows) {
    const tripId = String(row.trip_id ?? "").trim()
    const mapped = mapJoinedRow(row)
    if (!tripId || !mapped) continue
    if (mapped.status && mapped.status !== "accepted") continue

    const list = result[tripId] ?? (result[tripId] = [])
    if (list.some((member) => member.userId === mapped.userId)) continue

    const index = counts.get(tripId) ?? 0
    counts.set(tripId, index + 1)
    list.push(
      toTripGroupMember({
        userId: mapped.userId,
        name: mapped.name,
        avatarUrl: mapped.avatarUrl,
        index,
      })
    )
  }

  return result
}

export async function addTripMember(input: {
  tripId: string
  userId?: string | null
  email?: string | null
  name?: string | null
  nickname?: string | null
  avatarUrl?: string | null
}) {
  const tripId = String(input.tripId ?? "").trim()
  if (!tripId) {
    throw new Error("tripId가 필요합니다.")
  }

  const client = createClient()
  const authUserId = await getCurrentUserId()
  if (!authUserId) {
    throw new Error("로그인이 필요해요. 다시 로그인한 뒤 초대해 주세요.")
  }

  // 1) Resolve invitee UUID from userId / email / nickname
  let invitedUserId: string
  try {
    invitedUserId = await resolveInviteeUserId({
      userId: input.userId,
      email: input.email,
      nickname: input.nickname ?? input.name,
      name: input.name,
    })
  } catch (err) {
    console.error("[addTripMember] resolveInviteeUserId failed:", err)
    throw err instanceof Error
      ? err
      : new Error("초대 대상 사용자를 찾지 못했어요.")
  }

  console.info("[addTripMember] resolved invitee", {
    tripId,
    invitedUserId,
    inputUserId: input.userId,
    email: input.email,
    name: input.name,
  })

  // Owner (or existing member) may invite; verify trip is reachable under RLS.
  const { data: tripRow, error: tripError } = await client
    .from("trips")
    .select("id, user_id, title")
    .eq("id", tripId)
    .maybeSingle()

  if (tripError) {
    console.error(
      "[addTripMember] trip lookup failed:",
      tripError.message || tripError.details || tripError.code || tripError
    )
    throw new Error(
      formatMemberError(tripError) || "여행 정보를 확인하지 못했어요."
    )
  }

  if (!tripRow) {
    throw new Error("초대를 보낼 여행을 찾을 수 없어요. 소유자만 멤버를 초대할 수 있어요.")
  }

  const ownerId = String((tripRow as { user_id?: string | null }).user_id ?? "").trim()
  if (ownerId && ownerId !== authUserId) {
    const { data: membership, error: membershipError } = await client
      .from("trip_members")
      .select("id, status")
      .eq("trip_id", tripId)
      .eq("user_id", authUserId)
      .maybeSingle()

    if (membershipError) {
      console.error(
        "[addTripMember] membership check failed:",
        membershipError.message || membershipError.details || membershipError
      )
    }

    const memberStatus = normalizeStatus(
      (membership as { status?: string } | null)?.status
    )
    if (!membership || memberStatus !== "accepted") {
      throw new Error("이 여행의 멤버만 친구를 초대할 수 있어요.")
    }
  }

  if (invitedUserId === authUserId) {
    throw new Error("자기 자신은 초대할 수 없어요.")
  }

  // 2) Dual write: trip_members (pending) + notifications (recipient = invitedUserId)
  let memberId = ""

  const existing = await client
    .from("trip_members")
    .select("id, status")
    .eq("trip_id", tripId)
    .eq("user_id", invitedUserId)
    .maybeSingle()

  if (existing.error) {
    console.error("trip_members error:", existing.error)
  }

  if (existing.data) {
    memberId = String((existing.data as { id?: string }).id ?? "").trim()
    const currentStatus = normalizeStatus(
      (existing.data as { status?: string }).status
    )
    if (currentStatus === "accepted") {
      throw new Error("이미 참여 중인 멤버예요.")
    }
    const { error: updateError } = await client
      .from("trip_members")
      .update({ status: "pending" })
      .eq("id", memberId)
    if (updateError) {
      console.error("trip_members error:", updateError)
      if (!/status|column .* does not exist/i.test(updateError.message ?? "")) {
        throw new Error(formatMemberError(updateError))
      }
    }
  } else {
    const { data: inserted, error: memberError } = await client
      .from("trip_members")
      .insert({
        trip_id: tripId,
        user_id: invitedUserId,
        status: "pending",
      })
      .select("id")
      .maybeSingle()

    if (memberError) {
      console.error("trip_members error:", memberError)
      // Upsert fallback for unique conflicts
      if (/duplicate|unique/i.test(memberError.message ?? "")) {
        const again = await client
          .from("trip_members")
          .select("id")
          .eq("trip_id", tripId)
          .eq("user_id", invitedUserId)
          .maybeSingle()
        memberId = String((again.data as { id?: string } | null)?.id ?? "").trim()
      } else if (/status|column .* does not exist/i.test(memberError.message ?? "")) {
        const legacy = await client
          .from("trip_members")
          .insert({ trip_id: tripId, user_id: invitedUserId })
          .select("id")
          .maybeSingle()
        if (legacy.error) {
          console.error("trip_members error:", legacy.error)
          throw new Error(formatMemberError(legacy.error))
        }
        memberId = String((legacy.data as { id?: string } | null)?.id ?? "").trim()
      } else if (/row-level security|rls|permission|policy/i.test(memberError.message ?? "")) {
        throw new Error(
          "멤버 초대 권한이 없어요. Supabase에서 trip_members RLS 정책(소유자 INSERT 허용)을 확인해 주세요."
        )
      } else if (/foreign key|violates foreign key/i.test(memberError.message ?? "")) {
        throw new Error(
          "초대 대상 계정이 profiles/auth에 없어요. 친구가 한 번 로그인한 뒤 다시 초대해 주세요."
        )
      } else {
        throw new Error(formatMemberError(memberError) || "멤버 초대에 실패했어요.")
      }
    } else {
      memberId = String((inserted as { id?: string } | null)?.id ?? "").trim()
    }
  }

  if (!memberId) {
    const lookup = await client
      .from("trip_members")
      .select("id")
      .eq("trip_id", tripId)
      .eq("user_id", invitedUserId)
      .maybeSingle()
    memberId = String((lookup.data as { id?: string } | null)?.id ?? "").trim()
  }

  if (!memberId) {
    console.error("[addTripMember] trip_members id missing after insert", {
      tripId,
      invitedUserId,
    })
    throw new Error("초대 멤버 ID를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.")
  }

  console.info("[addTripMember] trip_members pending ready", {
    tripId,
    invitedUserId,
    memberId,
  })

  await createTripInviteNotification({
    tripId,
    tripTitle: String((tripRow as { title?: string | null }).title ?? "").trim() || "여행",
    inviteeUserId: invitedUserId,
    senderId: authUserId,
    tripMemberId: memberId,
  })

  return {
    tripId,
    userId: invitedUserId,
    status: "pending" as const,
    memberId,
  }
}

async function createTripInviteNotification(input: {
  tripId: string
  tripTitle: string
  inviteeUserId: string
  senderId: string
  tripMemberId: string
}) {
  const tripMemberId = String(input.tripMemberId ?? "").trim()
  if (!tripMemberId) {
    throw new Error("trip_member_id가 없어 알림을 만들 수 없어요.")
  }

  const actorName = await resolveActorDisplayName(input.senderId)
  const message = `${actorName}님이 '${input.tripTitle}'에 초대했습니다.`

  // user_id = 피초대자, actor_id = 초대한 사람, trip_member_id = trip_members.id
  // Always goes through createNotification → create_notification_safe RPC
  console.info("[createTripInviteNotification] inserting", {
    user_id: input.inviteeUserId,
    actor_id: input.senderId,
    type: "trip_invite",
    reference_id: input.tripId,
    trip_member_id: tripMemberId,
    message,
  })

  try {
    const row = await createNotification(
      {
        userId: input.inviteeUserId,
        actorId: input.senderId,
        type: "trip_invite",
        message,
        referenceId: input.tripId,
        tripMemberId,
      },
      { throwOnError: true }
    )
    console.info("[createTripInviteNotification] success", {
      id: row?.id,
      user_id: row?.userId,
      actor_id: row?.actorId,
      trip_member_id: row?.tripMemberId ?? tripMemberId,
    })
  } catch (err) {
    console.error("notification insert error:", err)
    throw err instanceof Error
      ? err
      : new Error("알림 생성에 실패했어요. notifications 테이블/RLS를 확인해 주세요.")
  }
}

/** Pending invitations addressed to the current user. */
export async function fetchPendingInvitations(): Promise<TripInvitation[]> {
  const authUserId = await getCurrentUserId()
  if (!authUserId) return []

  const client = createClient()
  const { data, error } = await client
    .from("trip_members")
    .select("id, trip_id, status, created_at, trips:trip_id(id, title, user_id)")
    .eq("user_id", authUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) {
    if (/status|column .* does not exist/i.test(error.message ?? "")) {
      console.warn("[fetchPendingInvitations] status column missing — run supabase/trip_members.sql")
      return []
    }
    console.error(
      "[fetchPendingInvitations]",
      error.message || error.details || error.code || error
    )
    return []
  }

  type InviteRow = {
    id?: string
    trip_id?: string
    created_at?: string | null
    trips?:
      | { id?: string; title?: string | null; user_id?: string | null }
      | Array<{ id?: string; title?: string | null; user_id?: string | null }>
      | null
  }

  const rows = (data as InviteRow[] | null) ?? []
  const ownerIds = [
    ...new Set(
      rows
        .map((row) => {
          const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips
          return String(trip?.user_id ?? "").trim()
        })
        .filter(Boolean)
    ),
  ]

  const profileMap = new Map<string, ProfileJoin>()
  if (ownerIds.length > 0) {
    const { data: profiles, error: profileError } = await client
      .from("profiles")
      .select("id, nickname, avatar_url, email")
      .in("id", ownerIds)
    if (profileError) {
      console.error("[fetchPendingInvitations] profiles:", profileError.message)
    } else {
      for (const profile of (profiles as ProfileJoin[] | null) ?? []) {
        const id = String(profile.id ?? "").trim()
        if (id) profileMap.set(id, profile)
      }
    }
  }

  const result: TripInvitation[] = []
  for (const row of rows) {
    const id = String(row.id ?? "").trim()
    const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips
    const tripId = String(trip?.id ?? row.trip_id ?? "").trim()
    if (!id || !tripId) continue

    const ownerId = String(trip?.user_id ?? "").trim()
    const profile = profileMap.get(ownerId)
    const email = String(profile?.email ?? "").trim()
    const inviterName =
      String(profile?.nickname ?? "").trim() ||
      (email ? email.split("@")[0] : "") ||
      "친구"
    const inviterAvatarUrl = String(profile?.avatar_url ?? "").trim() || undefined
    const tripTitle = String(trip?.title ?? "").trim() || "여행"

    result.push({
      id,
      tripId,
      tripTitle,
      inviterName,
      inviterAvatarUrl,
      createdAt: row.created_at ?? undefined,
    })
  }

  return result
}

export async function acceptTripInvitation(memberId: string): Promise<{ tripTitle: string }> {
  const id = String(memberId ?? "").trim()
  if (!id) throw new Error("초대 정보가 없어요.")

  const authUserId = await getCurrentUserId()
  if (!authUserId) throw new Error("로그인이 필요해요.")

  const client = createClient()
  const { data: row, error: lookupError } = await client
    .from("trip_members")
    .select("id, trip_id, user_id, trips:trip_id(title)")
    .eq("id", id)
    .eq("user_id", authUserId)
    .maybeSingle()

  if (lookupError) throw new Error(formatMemberError(lookupError))
  if (!row) throw new Error("초대를 찾을 수 없어요.")

  const { error } = await client
    .from("trip_members")
    .update({ status: "accepted" })
    .eq("id", id)
    .eq("user_id", authUserId)

  if (error) throw new Error(formatMemberError(error))

  const trip = (row as { trips?: { title?: string } | Array<{ title?: string }> | null }).trips
  const tripObj = Array.isArray(trip) ? trip[0] : trip
  const tripTitle = String(tripObj?.title ?? "").trim() || "여행"
  return { tripTitle }
}

export async function rejectTripInvitation(memberId: string): Promise<void> {
  const id = String(memberId ?? "").trim()
  if (!id) throw new Error("초대 정보가 없어요.")

  const authUserId = await getCurrentUserId()
  if (!authUserId) throw new Error("로그인이 필요해요.")

  const client = createClient()

  // Reject = delete the pending membership row
  const { error: deleteError } = await client
    .from("trip_members")
    .delete()
    .eq("id", id)
    .eq("user_id", authUserId)

  if (deleteError) throw new Error(formatMemberError(deleteError))
}

