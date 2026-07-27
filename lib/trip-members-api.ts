import { createClient } from "@/utils/supabase/client"
import { supabase } from "@/lib/supabase"
import { toTripGroupMember, type TripGroupMember } from "@/lib/trip-group"

export type TripMember = {
  id: string
  userId: string
  email: string
  name: string
  avatarUrl?: string
  role?: string
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
  profiles?: ProfileJoin | ProfileJoin[] | null
}

const MEMBER_SELECT_WITH_ROLE = `
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

const MEMBER_SELECT_NO_ROLE = `
  id,
  trip_id,
  user_id,
  profiles:user_id (
    id,
    nickname,
    avatar_url,
    email
  )
`

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

  const { data, error } = await supabase
    .from("trips")
    .select("invite_code")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[fetchTripInviteCode] Supabase error:", error.message)
    return null
  }

  return String((data as { invite_code?: string | null } | null)?.invite_code ?? "").trim() || null
}

/**
 * Load trip_members with profiles (nickname / avatar / email) via user_id FK join.
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
    seen.add(mapped.userId)
    result.push(mapped)
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
  const userId = String(input.userId ?? "").trim()
  if (!tripId || !userId) throw new Error("tripId와 userId가 필요합니다.")

  // trip_members only stores trip_id + user_id (profile fields live on profiles)
  const payload = {
    trip_id: tripId,
    user_id: userId,
  }

  const upsert = await supabase.from("trip_members").upsert(payload, {
    onConflict: "trip_id,user_id",
    ignoreDuplicates: true,
  })
  if (!upsert.error) return

  const fallback = await supabase.from("trip_members").insert(payload)
  if (fallback.error) throw fallback.error
}
