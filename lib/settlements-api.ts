import { createClient } from "@/utils/supabase/client"
import {
  calcVariableMemberBalances,
  computeMinTransfers,
  formatExpenseSplitLabel,
} from "@/lib/settlement-math"

export type ExpenseCategory = "숙소" | "식사" | "교통" | "기타"

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ["숙소", "식사", "교통", "기타"]

export type SettlementMember = {
  userId: string
  nickname: string
  email: string
  avatarUrl?: string
  /** 여행 멤버가 아닌 정산 전용 게스트(settlement_guests). */
  isGuest?: boolean
}

export type ExpenseRecord = {
  id: string
  tripId: string
  title: string
  amount: number
  category: ExpenseCategory
  payerId: string
  payerNickname: string
  payerAvatarUrl?: string
  expenseDate: string
  createdAt: string
  receiptUrl?: string
  /** Users sharing this expense (from expense_participants). */
  participantIds: string[]
}

export type SettlementRecord = {
  id: string
  tripId: string
  fromUserId: string
  toUserId: string
  amount: number
  status: "pending" | "completed"
}

type ProfileJoin = {
  id?: string
  nickname?: string | null
  email?: string | null
  avatar_url?: string | null
}

function logError(scope: string, error: { message?: string; details?: string; hint?: string }) {
  console.error(`[${scope}]`, error.message, error.details, error.hint)
}

function initialsFromNickname(nickname: string) {
  const cleaned = String(nickname ?? "").replace(/\s+/g, "")
  if (!cleaned) return "?"
  return cleaned.slice(0, 2).toUpperCase()
}

export function formatWon(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원"
}

export function formatExpenseDateLabel(isoDate: string) {
  const value = String(isoDate ?? "").trim()
  if (!value) return "--.--"
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    const parts = value.split("-")
    if (parts.length >= 3) return `${parts[1]}.${parts[2]}`
    return value
  }
  const mm = `${date.getMonth() + 1}`.padStart(2, "0")
  const dd = `${date.getDate()}`.padStart(2, "0")
  return `${mm}.${dd}`
}

export { initialsFromNickname, formatExpenseSplitLabel }

export { calcPerPerson } from "@/lib/settlement-math"

function mapProfile(profile: ProfileJoin | ProfileJoin[] | null | undefined): {
  nickname: string
  email: string
  avatarUrl?: string
  id?: string
} {
  const row = Array.isArray(profile) ? profile[0] : profile
  const email = String(row?.email ?? "").trim()
  const nickname =
    String(row?.nickname ?? "").trim() || (email ? email.split("@")[0] : "") || "사용자"
  const avatarUrl = String(row?.avatar_url ?? "").trim() || undefined
  return { id: row?.id, nickname, email, avatarUrl }
}

export async function fetchSettlementMembers(tripId: string): Promise<SettlementMember[]> {
  const id = String(tripId ?? "").trim()
  if (!id) return []

  const supabase = createClient()

  // Prefer profiles FK embed; never select email/name from trip_members (columns don't exist).
  let memberRows: Array<{
    id?: string
    user_id?: string
    trip_id?: string
    profiles?: ProfileJoin | ProfileJoin[] | null
  }> = []

  const embedded = await supabase
    .from("trip_members")
    .select(
      `
      id,
      user_id,
      trip_id,
      profiles:user_id (
        id,
        email,
        nickname,
        avatar_url
      )
    `
    )
    .eq("trip_id", id)

  if (embedded.error) {
    logError("fetchSettlementMembers.embed", embedded.error)
    const fallback = await supabase
      .from("trip_members")
      .select("id, user_id, trip_id")
      .eq("trip_id", id)
    if (fallback.error) {
      logError("fetchSettlementMembers.members", fallback.error)
      throw fallback.error
    }

    const plain = (fallback.data as Array<{ id?: string; user_id?: string; trip_id?: string }> | null) ?? []
    const userIds = [
      ...new Set(plain.map((row) => String(row.user_id ?? "").trim()).filter(Boolean)),
    ]
    const profileMap = new Map<string, ProfileJoin>()
    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, nickname, avatar_url")
        .in("id", userIds)
      if (profileError) {
        logError("fetchSettlementMembers.profiles", profileError)
        throw profileError
      }
      for (const profile of (profiles as ProfileJoin[] | null) ?? []) {
        profileMap.set(String(profile.id ?? "").trim(), profile)
      }
    }
    memberRows = plain.map((row) => ({
      ...row,
      profiles: profileMap.get(String(row.user_id ?? "").trim()) ?? null,
    }))
  } else {
    memberRows = (embedded.data as typeof memberRows | null) ?? []
  }

  const result: SettlementMember[] = []
  const seen = new Set<string>()

  for (const row of memberRows) {
    const userId = String(row.user_id ?? "").trim()
    if (!userId || seen.has(userId)) continue
    seen.add(userId)

    const profileRaw = row.profiles
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw
    const mapped = mapProfile(profile)
    const email = mapped.email
    const nickname =
      mapped.nickname !== "사용자"
        ? mapped.nickname
        : email
          ? email.split("@")[0]
          : "이름 없음"

    result.push({
      userId,
      email,
      nickname: String(profile?.nickname ?? "").trim() || nickname,
      avatarUrl: mapped.avatarUrl,
    })
  }

  // Trip owner may not have a trip_members row (never invited themselves) —
  // without this, a solo trip has zero settlement members and the payer picker is empty.
  const { data: tripRow, error: tripError } = await supabase
    .from("trips")
    .select("user_id")
    .eq("id", id)
    .maybeSingle()

  if (tripError) {
    logError("fetchSettlementMembers.trip", tripError)
  } else {
    const ownerId = String((tripRow as { user_id?: string | null } | null)?.user_id ?? "").trim()
    if (ownerId && !seen.has(ownerId)) {
      const { data: ownerProfile, error: ownerError } = await supabase
        .from("profiles")
        .select("id, email, nickname, avatar_url")
        .eq("id", ownerId)
        .maybeSingle()

      if (ownerError) {
        logError("fetchSettlementMembers.ownerProfile", ownerError)
      }

      const mapped = mapProfile(ownerProfile as ProfileJoin | null)
      const email = mapped.email
      const nickname =
        mapped.nickname !== "사용자"
          ? mapped.nickname
          : email
            ? email.split("@")[0]
            : "여행 호스트"

      result.unshift({
        userId: ownerId,
        email,
        nickname,
        avatarUrl: mapped.avatarUrl,
      })
    }
  }

  // 정산 전용 게스트 (앱 계정 없는 이름-only 참가자) — 멤버 뒤에 붙인다.
  const { data: guestRows, error: guestError } = await supabase
    .from("settlement_guests")
    .select("id, name")
    .eq("trip_id", id)
    .order("created_at", { ascending: true })
  if (guestError) {
    logError("fetchSettlementMembers.guests", guestError)
  } else {
    for (const g of (guestRows as Array<{ id: string; name: string }> | null) ?? []) {
      result.push({ userId: String(g.id), email: "", nickname: (g.name || "게스트").trim(), isGuest: true })
    }
  }

  return result
}

export async function fetchTripExpenses(tripId: string): Promise<ExpenseRecord[]> {
  const id = String(tripId ?? "").trim()
  if (!id) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from("expenses")
    .select("*, payer:profiles!expenses_payer_id_fkey(*)")
    .eq("trip_id", id)
    .order("created_at", { ascending: false })

  if (error) {
    logError("fetchTripExpenses", error)
    throw error
  }

  const rows = (data as Array<Record<string, unknown>> | null) ?? []
  const expenseIds = rows.map((row) => String(row.id ?? "").trim()).filter(Boolean)

  const participantsByExpense = new Map<string, string[]>()
  if (expenseIds.length > 0) {
    const { data: participantRows, error: participantError } = await supabase
      .from("expense_participants")
      .select("expense_id, user_id, guest_id")
      .in("expense_id", expenseIds)

    if (participantError) {
      // Table may not exist yet — fall back to empty (caller can treat as all-members).
      logError("fetchTripExpenses.participants", participantError)
    } else {
      for (const row of (participantRows as Array<{
        expense_id?: string
        user_id?: string | null
        guest_id?: string | null
      }> | null) ?? []) {
        const expenseId = String(row.expense_id ?? "").trim()
        const pid = String(row.user_id ?? row.guest_id ?? "").trim()
        if (!expenseId || !pid) continue
        const list = participantsByExpense.get(expenseId) ?? []
        list.push(pid)
        participantsByExpense.set(expenseId, list)
      }
    }
  }

  return rows.map((row) => {
    const payer = mapProfile(row.payer as ProfileJoin | ProfileJoin[] | null)
    const category = String(row.category ?? "기타") as ExpenseCategory
    const expenseId = String(row.id)
    const participantIds = participantsByExpense.get(expenseId) ?? []
    return {
      id: expenseId,
      tripId: String(row.trip_id),
      title: String(row.title ?? "").trim() || "지출",
      amount: Number(row.amount) || 0,
      category: EXPENSE_CATEGORIES.includes(category) ? category : "기타",
      payerId: String(row.payer_id ?? ""),
      payerNickname: payer.nickname,
      payerAvatarUrl: payer.avatarUrl,
      expenseDate: String(row.expense_date ?? "").slice(0, 10),
      createdAt: String(row.created_at ?? ""),
      receiptUrl: String(row.receipt_url ?? "").trim() || undefined,
      participantIds,
    }
  })
}

/** Upload a receipt image to the public `receipts` Storage bucket and return its public URL. */
export async function uploadReceiptImage(file: File, tripId: string): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw authError ?? new Error("로그인이 필요합니다.")
  }

  const ext =
    (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"
  const path = `${tripId}/${user.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage.from("receipts").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  })

  if (uploadError) {
    logError("uploadReceiptImage", uploadError)
    throw uploadError
  }

  const { data } = supabase.storage.from("receipts").getPublicUrl(path)
  const publicUrl = String(data.publicUrl ?? "").trim()
  if (!publicUrl) throw new Error("영수증 Public URL을 만들지 못했어요.")
  return publicUrl
}

export async function fetchTripSettlements(tripId: string): Promise<SettlementRecord[]> {
  const id = String(tripId ?? "").trim()
  if (!id) return []

  const supabase = createClient()
  const { data, error } = await supabase.from("settlements").select("*").eq("trip_id", id)

  if (error) {
    logError("fetchTripSettlements", error)
    throw error
  }

  return ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    id: String(row.id),
    tripId: String(row.trip_id),
    fromUserId: String(row.from_user_id),
    toUserId: String(row.to_user_id),
    amount: Number(row.amount) || 0,
    status: row.status === "completed" ? "completed" : "pending",
  }))
}

export async function insertExpense(input: {
  tripId: string
  title: string
  amount: number
  category: ExpenseCategory
  payerId: string
  expenseDate: string
  receiptUrl?: string | null
  participantIds?: string[]
  /** participantIds 중 정산 전용 게스트(settlement_guests) 의 id 목록 → guest_id 로 저장. */
  guestIds?: string[]
}) {
  const supabase = createClient()
  const payload = {
    trip_id: input.tripId,
    title: input.title.trim(),
    amount: Math.round(input.amount),
    category: input.category,
    payer_id: input.payerId,
    expense_date: input.expenseDate,
    receipt_url: String(input.receiptUrl ?? "").trim() || null,
  }

  const { data, error } = await supabase.from("expenses").insert(payload).select("id").single()
  if (error) {
    logError("insertExpense", error)
    throw error
  }

  const expenseId = String((data as { id?: string } | null)?.id ?? "").trim()
  if (!expenseId) throw new Error("지출 ID를 받지 못했어요.")

  let participantIds = [
    ...new Set((input.participantIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean)),
  ]
  // Default: payer alone if nothing selected (should be prevented by UI).
  if (participantIds.length === 0 && input.payerId) {
    participantIds = [input.payerId]
  }

  if (participantIds.length > 0) {
    const guestSet = new Set((input.guestIds ?? []).map((id) => String(id ?? "").trim()))
    const rows = participantIds.map((id) =>
      guestSet.has(id)
        ? { expense_id: expenseId, guest_id: id }
        : { expense_id: expenseId, user_id: id }
    )
    const { error: participantError } = await supabase.from("expense_participants").insert(rows)
    if (participantError) {
      logError("insertExpense.participants", participantError)
      throw participantError
    }
  }

  return expenseId
}

/** 정산 전용 게스트(앱 계정 없는 이름-only 참가자) 추가. */
export async function addSettlementGuest(tripId: string, name: string) {
  const supabase = createClient()
  const { error } = await supabase.from("settlement_guests").insert({ trip_id: tripId, name: name.trim() })
  if (error) {
    logError("addSettlementGuest", error)
    throw error
  }
}

/** 정산 전용 게스트 삭제. */
export async function deleteSettlementGuest(guestId: string) {
  const supabase = createClient()
  const { error } = await supabase.from("settlement_guests").delete().eq("id", guestId)
  if (error) {
    logError("deleteSettlementGuest", error)
    throw error
  }
}

export async function toggleSettlementStatus(
  settlementId: string,
  nextStatus: "pending" | "completed"
) {
  const supabase = createClient()
  const { error } = await supabase
    .from("settlements")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", settlementId)

  if (error) {
    logError("toggleSettlementStatus", error)
    throw error
  }
}

/**
 * Recompute optimal transfers from expenses/members and sync into `settlements`,
 * preserving existing status for matching from→to pairs.
 */
export async function syncSettlementsForTrip(
  tripId: string,
  memberIds: string[],
  expenses: ExpenseRecord[],
  existing: SettlementRecord[]
): Promise<SettlementRecord[]> {
  const id = String(tripId ?? "").trim()
  if (!id || memberIds.length === 0) return []

  const balances = calcVariableMemberBalances(
    memberIds,
    expenses.map((expense) => ({
      amount: expense.amount,
      payerId: expense.payerId,
      participantIds:
        expense.participantIds.length > 0 ? expense.participantIds : [...memberIds],
    }))
  )
  const computed = computeMinTransfers(balances)

  const existingByPair = new Map<string, SettlementRecord>(
    existing.map((row) => [`${row.fromUserId}:${row.toUserId}`, row])
  )

  const supabase = createClient()
  const nextRows: SettlementRecord[] = []

  // Upsert computed transfers
  for (const transfer of computed) {
    const key = `${transfer.fromUserId}:${transfer.toUserId}`
    const prev = existingByPair.get(key)
    const status = prev?.status === "completed" ? "completed" : "pending"
    const payload = {
      trip_id: id,
      from_user_id: transfer.fromUserId,
      to_user_id: transfer.toUserId,
      amount: transfer.amount,
      status,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("settlements")
      .upsert(payload, { onConflict: "trip_id,from_user_id,to_user_id" })
      .select("*")
      .maybeSingle()

    if (error) {
      logError("syncSettlementsForTrip.upsert", error)
      // Fallback insert/update path
      if (prev?.id) {
        const updated = await supabase
          .from("settlements")
          .update({ amount: transfer.amount, status, updated_at: payload.updated_at })
          .eq("id", prev.id)
          .select("*")
          .maybeSingle()
        if (updated.error) throw updated.error
        const row = updated.data as Record<string, unknown>
        nextRows.push({
          id: String(row.id),
          tripId: id,
          fromUserId: transfer.fromUserId,
          toUserId: transfer.toUserId,
          amount: transfer.amount,
          status,
        })
      } else {
        const inserted = await supabase.from("settlements").insert(payload).select("*").maybeSingle()
        if (inserted.error) throw inserted.error
        const row = inserted.data as Record<string, unknown>
        nextRows.push({
          id: String(row.id),
          tripId: id,
          fromUserId: transfer.fromUserId,
          toUserId: transfer.toUserId,
          amount: transfer.amount,
          status,
        })
      }
      continue
    }

    const row = data as Record<string, unknown> | null
    nextRows.push({
      id: String(row?.id ?? prev?.id ?? `${key}`),
      tripId: id,
      fromUserId: transfer.fromUserId,
      toUserId: transfer.toUserId,
      amount: transfer.amount,
      status,
    })
    existingByPair.delete(key)
  }

  // Delete obsolete settlement pairs
  const obsoleteIds = [...existingByPair.values()].map((row) => row.id).filter(Boolean)
  if (obsoleteIds.length > 0) {
    const { error } = await supabase.from("settlements").delete().in("id", obsoleteIds)
    if (error) logError("syncSettlementsForTrip.delete", error)
  }

  return nextRows
}
