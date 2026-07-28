import { createClient } from "@/utils/supabase/client"
import { getCurrentUserId } from "@/lib/auth-session"
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

function mapJoinedRow(row: TripMemberJoinedRow): TripMember | null {
  const userId = String(row.user_id ?? "").trim()
  if (!userId) return null

  const profile = unwrapProfile(row.profiles)
  const email = String(profile?.email ?? "").trim()
  const name =
    String(profile?.nickname ?? "").trim() ||
    (email ? email.split("@")[0] : "") ||
    "멤버"
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
  userId: string
  email?: string | null
  name?: string | null
  avatarUrl?: string | null
}) {
  const tripId = String(input.tripId ?? "").trim()
  const inviteeUserId = String(input.userId ?? "").trim()
  if (!tripId || !inviteeUserId) {
    throw new Error("tripId와 userId가 필요합니다.")
  }

  const client = createClient()
  const authUserId = await getCurrentUserId()
  if (!authUserId) {
    throw new Error("로그인이 필요해요. 다시 로그인한 뒤 초대해 주세요.")
  }

  // Owner (or existing member) may invite; verify trip is reachable under RLS.
  const { data: tripRow, error: tripError } = await client
    .from("trips")
    .select("id, user_id")
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
    // Allow if current user is already a member of the trip
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

  if (inviteeUserId === authUserId) {
    throw new Error("자기 자신은 초대할 수 없어요.")
  }

  // Pending invite — invitee must accept before joining the trip list
  const payload = {
    trip_id: tripId,
    user_id: inviteeUserId,
    status: "pending" as const,
  }

  console.info("[addTripMember] upsert", {
    tripId,
    inviteeUserId,
    authUserId,
    ownerId: ownerId || null,
    status: "pending",
  })

  const upsert = await client.from("trip_members").upsert(payload, {
    onConflict: "trip_id,user_id",
  })

  if (!upsert.error) {
    return { tripId, userId: inviteeUserId, status: "pending" as const }
  }

  console.error(
    "[addTripMember] upsert failed:",
    upsert.error.message || upsert.error.details || upsert.error.code || upsert.error
  )

  // Legacy DB without status column
  if (/status|column .* does not exist/i.test(upsert.error.message ?? "")) {
    const legacyPayload = { trip_id: tripId, user_id: inviteeUserId }
    const legacy = await client.from("trip_members").upsert(legacyPayload, {
      onConflict: "trip_id,user_id",
      ignoreDuplicates: true,
    })
    if (!legacy.error) return { tripId, userId: inviteeUserId, status: "pending" as const }
    const legacyInsert = await client.from("trip_members").insert(legacyPayload)
    if (legacyInsert.error) throw new Error(formatMemberError(legacyInsert.error))
    return { tripId, userId: inviteeUserId, status: "pending" as const }
  }

  // Fallback for DBs without unique(trip_id, user_id) for onConflict
  const existing = await client
    .from("trip_members")
    .select("id, status")
    .eq("trip_id", tripId)
    .eq("user_id", inviteeUserId)
    .maybeSingle()

  if (!existing.error && existing.data) {
    const update = await client
      .from("trip_members")
      .update({ status: "pending" })
      .eq("id", String((existing.data as { id?: string }).id ?? ""))
    if (update.error && !/status|column .* does not exist/i.test(update.error.message ?? "")) {
      throw new Error(formatMemberError(update.error))
    }
    return { tripId, userId: inviteeUserId, status: "pending" as const }
  }

  const insert = await client.from("trip_members").insert(payload).select("id").maybeSingle()
  if (insert.error) {
    console.error(
      "[addTripMember] insert failed:",
      insert.error.message || insert.error.details || insert.error.code || insert.error
    )
    const message = formatMemberError(insert.error)
    if (/row-level security|rls|permission|policy/i.test(message)) {
      throw new Error(
        "멤버 초대 권한이 없어요. Supabase에서 trip_members RLS 정책(소유자 INSERT 허용)을 확인해 주세요."
      )
    }
    if (/foreign key|violates foreign key/i.test(message)) {
      throw new Error(
        "초대 대상 계정이 profiles에 없어요. 친구가 한 번 로그인한 뒤 다시 초대해 주세요."
      )
    }
    if (/duplicate|unique/i.test(message)) {
      return { tripId, userId: inviteeUserId, status: "pending" as const }
    }
    throw new Error(message || "멤버 초대에 실패했어요.")
  }

  return { tripId, userId: inviteeUserId, status: "pending" as const }
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

  // Prefer soft-reject; fall back to delete if update fails
  const { error: updateError } = await client
    .from("trip_members")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("user_id", authUserId)

  if (!updateError) return

  console.error(
    "[rejectTripInvitation] update failed:",
    updateError.message || updateError.details || updateError
  )

  const { error: deleteError } = await client
    .from("trip_members")
    .delete()
    .eq("id", id)
    .eq("user_id", authUserId)

  if (deleteError) throw new Error(formatMemberError(deleteError))
}

