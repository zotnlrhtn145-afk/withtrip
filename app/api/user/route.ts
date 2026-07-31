import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

import { createClient } from "@/utils/supabase/server"

export const runtime = "nodejs"

function userExtra(user: User): { joinedAt: string | null; provider: string | null } {
  return {
    joinedAt: user.created_at ?? null,
    provider: user.app_metadata?.provider ?? null,
  }
}

type ProfilePayoutRow = {
  id: string
  email?: string | null
  nickname?: string | null
  avatar_url?: string | null
  bank_name?: string | null
  account_number?: string | null
  account_holder?: string | null
  crypto_network?: string | null
  crypto_address?: string | null
  deletion_requested_at?: string | null
}

function toUserPayload(
  row: ProfilePayoutRow,
  extra: { joinedAt: string | null; provider: string | null }
) {
  return {
    id: row.id,
    email: row.email ?? null,
    nickname: row.nickname ?? null,
    avatarUrl: row.avatar_url ?? null,
    bankName: String(row.bank_name ?? "").trim(),
    accountNumber: String(row.account_number ?? "").trim(),
    accountHolder: String(row.account_holder ?? "").trim(),
    cryptoNetwork: String(row.crypto_network ?? "").trim(),
    cryptoAddress: String(row.crypto_address ?? "").trim(),
    deletionRequestedAt: row.deletion_requested_at ?? null,
    joinedAt: extra.joinedAt,
    provider: extra.provider,
  }
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return { supabase, user: null as null, error: "UNAUTHORIZED" as const }
  }
  return { supabase, user, error: null }
}

/** GET /api/user — current user payout + profile fields */
export async function GET() {
  try {
    const { supabase, user, error } = await requireUser()
    if (!user || error) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 })
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, email, nickname, avatar_url, bank_name, account_number, account_holder, crypto_network, crypto_address, deletion_requested_at"
      )
      .eq("id", user.id)
      .maybeSingle()

    const extra = userExtra(user)

    if (profileError) {
      console.error("[GET /api/user]", profileError.message)
      // Column missing / table missing — return empty payout shell
      if (
        /column|schema cache|does not exist/i.test(profileError.message)
      ) {
        return NextResponse.json({
          user: {
            id: user.id,
            email: user.email ?? null,
            nickname: null,
            avatarUrl: null,
            bankName: "",
            accountNumber: "",
            accountHolder: "",
            cryptoNetwork: "",
            cryptoAddress: "",
            deletionRequestedAt: null,
            ...extra,
          },
          warning: "PROFILE_PAYOUT_COLUMNS_MISSING",
        })
      }
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email ?? null,
          nickname: null,
          avatarUrl: null,
          bankName: "",
          accountNumber: "",
          accountHolder: "",
          cryptoNetwork: "",
          cryptoAddress: "",
          deletionRequestedAt: null,
          ...extra,
        },
      })
    }

    return NextResponse.json({ user: toUserPayload(data as ProfilePayoutRow, extra) })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load user"
    console.error("[GET /api/user]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PUT /api/user — update profile / payout receiving account fields.
 * Partial update: only keys present in the request body are written, so
 * saving the nickname alone never wipes an already-saved payout account
 * (and vice versa).
 */
export async function PUT(request: Request) {
  try {
    const { supabase, user, error } = await requireUser()
    if (!user || error) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 })
    }

    const body = (await request.json()) as {
      nickname?: string
      bankName?: string
      accountNumber?: string
      accountHolder?: string
      cryptoNetwork?: string
      cryptoAddress?: string
    }

    const payload: Record<string, string | null> = {
      id: user.id,
      email: user.email ?? null,
    }
    if ("nickname" in body) payload.nickname = String(body.nickname ?? "").trim() || null
    if ("bankName" in body) payload.bank_name = String(body.bankName ?? "").trim() || null
    if ("accountNumber" in body)
      payload.account_number = String(body.accountNumber ?? "").trim() || null
    if ("accountHolder" in body)
      payload.account_holder = String(body.accountHolder ?? "").trim() || null
    if ("cryptoNetwork" in body)
      payload.crypto_network = String(body.cryptoNetwork ?? "").trim() || null
    if ("cryptoAddress" in body)
      payload.crypto_address = String(body.cryptoAddress ?? "").trim() || null

    const { data, error: upsertError } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select(
        "id, email, nickname, avatar_url, bank_name, account_number, account_holder, crypto_network, crypto_address, deletion_requested_at"
      )
      .single()

    if (upsertError) {
      console.error("[PUT /api/user]", upsertError.message)
      if (/column|schema cache|does not exist/i.test(upsertError.message)) {
        return NextResponse.json(
          {
            error:
              "profiles 컬럼이 없습니다. supabase/payout-and-settle.sql, supabase/profiles-sync.sql을 실행해 주세요.",
          },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ user: toUserPayload(data as ProfilePayoutRow, userExtra(user)) })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update user"
    console.error("[PUT /api/user]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
