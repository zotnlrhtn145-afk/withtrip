import {
  EMPTY_PAYOUT_ACCOUNT,
  loadPayoutAccount,
  savePayoutAccount,
  type PayoutAccount,
} from "@/lib/payout-account"
import { createClient as createBrowserClient } from "@/utils/supabase/client"

export type { PayoutAccount }

type UserApiPayload = {
  user?: {
    id?: string
    email?: string | null
    nickname?: string | null
    avatarUrl?: string | null
    bankName?: string | null
    accountNumber?: string | null
    accountHolder?: string | null
    cryptoNetwork?: string | null
    cryptoAddress?: string | null
    deletionRequestedAt?: string | null
    joinedAt?: string | null
    provider?: string | null
  }
  error?: string
  warning?: string
}

export type UserProfile = {
  id: string
  email: string
  nickname: string
  avatarUrl: string | null
  joinedAt: string | null
  /** OAuth provider ("kakao" | "google") or "email" for password sign-up. */
  provider: string | null
  deletionRequestedAt: string | null
}

function profileFromUserPayload(user: NonNullable<UserApiPayload["user"]>): UserProfile {
  return {
    id: String(user.id ?? "").trim(),
    email: String(user.email ?? "").trim(),
    nickname: String(user.nickname ?? "").trim(),
    avatarUrl: String(user.avatarUrl ?? "").trim() || null,
    joinedAt: user.joinedAt ?? null,
    provider: user.provider ?? null,
    deletionRequestedAt: user.deletionRequestedAt ?? null,
  }
}

/** Fetch the signed-in user's profile (nickname/avatar/join date/provider). */
export async function fetchUserProfile(): Promise<{
  profile: UserProfile | null
  error?: string
}> {
  try {
    const response = await fetch("/api/user", { method: "GET", cache: "no-store" })
    const payload = (await response.json()) as UserApiPayload
    if (!response.ok || !payload.user) {
      return { profile: null, error: payload.error }
    }
    return { profile: profileFromUserPayload(payload.user) }
  } catch {
    return { profile: null, error: "네트워크 오류 — 프로필을 불러오지 못했어요." }
  }
}

/** Persist a nickname change. Never touches payout fields (partial update). */
export async function saveUserNickname(nickname: string): Promise<{
  ok: boolean
  profile: UserProfile | null
  error?: string
}> {
  try {
    const response = await fetch("/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    })
    const payload = (await response.json()) as UserApiPayload
    if (!response.ok || !payload.user) {
      return { ok: false, profile: null, error: payload.error || "닉네임 저장에 실패했어요." }
    }
    return { ok: true, profile: profileFromUserPayload(payload.user) }
  } catch {
    return { ok: false, profile: null, error: "네트워크 오류 — 닉네임을 저장하지 못했어요." }
  }
}

/** Record a 회원 탈퇴 (account deletion) request for manual operator review. */
export async function requestAccountDeletion(): Promise<{
  ok: boolean
  deletionRequestedAt: string | null
  error?: string
}> {
  try {
    const response = await fetch("/api/user/delete-request", { method: "POST" })
    const payload = (await response.json()) as {
      ok?: boolean
      deletionRequestedAt?: string | null
      error?: string
    }
    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        deletionRequestedAt: null,
        error: payload.error || "탈퇴 요청에 실패했어요.",
      }
    }
    return { ok: true, deletionRequestedAt: payload.deletionRequestedAt ?? null }
  } catch {
    return {
      ok: false,
      deletionRequestedAt: null,
      error: "네트워크 오류 — 탈퇴 요청을 보내지 못했어요.",
    }
  }
}

function payoutFromUserPayload(user: NonNullable<UserApiPayload["user"]>): PayoutAccount {
  return {
    bank: {
      bankName: String(user.bankName ?? "").trim(),
      accountNumber: String(user.accountNumber ?? "").trim(),
      accountHolder: String(user.accountHolder ?? "").trim(),
    },
    crypto: {
      network: String(user.cryptoNetwork ?? "").trim(),
      walletAddress: String(user.cryptoAddress ?? "").trim(),
    },
  }
}

export async function fetchUserPayoutAccount(): Promise<{
  account: PayoutAccount
  source: "api" | "local"
  error?: string
}> {
  try {
    const response = await fetch("/api/user", { method: "GET", cache: "no-store" })
    const payload = (await response.json()) as UserApiPayload
    if (!response.ok || !payload.user) {
      return {
        account: loadPayoutAccount(),
        source: "local",
        error: payload.error,
      }
    }
    const account = payoutFromUserPayload(payload.user)
    savePayoutAccount(account)
    return { account, source: "api" }
  } catch {
    return {
      account: loadPayoutAccount(),
      source: "local",
      error: "네트워크 오류 — 로컬 계좌 정보를 사용해요.",
    }
  }
}

export async function saveUserPayoutAccount(account: PayoutAccount): Promise<{
  ok: boolean
  account: PayoutAccount
  source: "api" | "local"
  error?: string
}> {
  try {
    const response = await fetch("/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankName: account.bank.bankName,
        accountNumber: account.bank.accountNumber,
        accountHolder: account.bank.accountHolder,
        cryptoNetwork: account.crypto.network,
        cryptoAddress: account.crypto.walletAddress,
      }),
    })
    const payload = (await response.json()) as UserApiPayload
    if (!response.ok || !payload.user) {
      savePayoutAccount(account)
      return {
        ok: true,
        account,
        source: "local",
        error: payload.error,
      }
    }
    const next = payoutFromUserPayload(payload.user)
    savePayoutAccount(next)
    return { ok: true, account: next, source: "api" }
  } catch {
    savePayoutAccount(account)
    return {
      ok: true,
      account,
      source: "local",
      error: "네트워크 오류 — 로컬에만 저장됐어요.",
    }
  }
}

export async function fetchTripSettleStatus(tripId: string): Promise<{
  isSettled: boolean
  settledAt: string | null
  source: "api" | "client" | "local"
}> {
  const id = String(tripId ?? "").trim()
  if (!id) return { isSettled: false, settledAt: null, source: "local" }

  try {
    const response = await fetch(`/api/trips/${encodeURIComponent(id)}/settle`, {
      method: "GET",
      cache: "no-store",
    })
    const payload = (await response.json()) as {
      isSettled?: boolean
      settledAt?: string | null
      warning?: string
    }
    if (response.ok && payload.warning !== "SETTLE_COLUMNS_MISSING") {
      return {
        isSettled: Boolean(payload.isSettled),
        settledAt: payload.settledAt ?? null,
        source: "api",
      }
    }
  } catch {
    // fall through
  }

  try {
    const client = createBrowserClient()
    const { data, error } = await client
      .from("trips")
      .select("is_settled, settled_at")
      .eq("id", id)
      .maybeSingle()
    if (!error && data) {
      return {
        isSettled: Boolean(data.is_settled),
        settledAt: (data.settled_at as string | null) ?? null,
        source: "client",
      }
    }
  } catch {
    // fall through
  }

  const { getTripSettledFlag } = await import("@/lib/trip-settled")
  return {
    isSettled: getTripSettledFlag(id),
    settledAt: null,
    source: "local",
  }
}

async function updateSettleOnClient(
  id: string,
  isSettled: boolean
): Promise<{ isSettled: boolean; settledAt: string | null }> {
  const client = createBrowserClient()
  const settledAt = isSettled ? new Date().toISOString() : null
  const { data, error } = await client
    .from("trips")
    .update({
      is_settled: isSettled,
      settled_at: settledAt,
    })
    .eq("id", id)
    .select("id, is_settled, settled_at")
    .maybeSingle()

  if (error) {
    if (/column|schema cache|does not exist/i.test(error.message)) {
      throw new Error(
        "trips.is_settled 컬럼이 없습니다. supabase/payout-and-settle.sql을 실행해 주세요."
      )
    }
    throw new Error(error.message || "정산 상태 저장에 실패했어요.")
  }
  if (!data) {
    throw new Error("정산 상태를 저장할 권한이 없거나 여행을 찾을 수 없어요.")
  }
  return {
    isSettled: Boolean(data.is_settled),
    settledAt: (data.settled_at as string | null) ?? null,
  }
}

/**
 * Persist settlement completion to DB.
 * Tries PATCH /api/trips/[id]/settle, then browser Supabase.
 * Never reports success for localStorage-only writes.
 */
export async function patchTripSettleStatus(
  tripId: string,
  isSettled?: boolean
): Promise<{
  ok: boolean
  isSettled: boolean
  settledAt: string | null
  source: "api" | "client"
  error?: string
}> {
  const id = String(tripId ?? "").trim()
  if (!id) {
    return {
      ok: false,
      isSettled: false,
      settledAt: null,
      source: "api",
      error: "trip id is required.",
    }
  }

  const { getTripSettledFlag, setTripSettledFlag } = await import(
    "@/lib/trip-settled"
  )
  const next =
    typeof isSettled === "boolean" ? isSettled : !getTripSettledFlag(id)

  try {
    const response = await fetch(`/api/trips/${encodeURIComponent(id)}/settle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSettled: next }),
      cache: "no-store",
    })
    const payload = (await response.json()) as {
      isSettled?: boolean
      settledAt?: string | null
      error?: string
    }
    if (response.ok) {
      const settled = Boolean(payload.isSettled)
      setTripSettledFlag(id, settled)
      return {
        ok: true,
        isSettled: settled,
        settledAt: payload.settledAt ?? null,
        source: "api",
      }
    }
    console.warn(
      "[patchTripSettleStatus] API failed:",
      response.status,
      payload.error
    )
  } catch (err) {
    console.warn("[patchTripSettleStatus] API network error:", err)
  }

  try {
    const result = await updateSettleOnClient(id, next)
    setTripSettledFlag(id, result.isSettled)
    return {
      ok: true,
      isSettled: result.isSettled,
      settledAt: result.settledAt,
      source: "client",
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "정산 상태 저장에 실패했어요."
    console.error("[patchTripSettleStatus] client update failed:", message)
    return {
      ok: false,
      isSettled: getTripSettledFlag(id),
      settledAt: null,
      source: "client",
      error: message,
    }
  }
}

export { EMPTY_PAYOUT_ACCOUNT }
