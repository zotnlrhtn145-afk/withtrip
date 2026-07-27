import { NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"

export const runtime = "nodejs"

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
}

function toUserPayload(row: ProfilePayoutRow) {
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
        "id, email, nickname, avatar_url, bank_name, account_number, account_holder, crypto_network, crypto_address"
      )
      .eq("id", user.id)
      .maybeSingle()

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
        },
      })
    }

    return NextResponse.json({ user: toUserPayload(data as ProfilePayoutRow) })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load user"
    console.error("[GET /api/user]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** PUT /api/user — update payout receiving account fields */
export async function PUT(request: Request) {
  try {
    const { supabase, user, error } = await requireUser()
    if (!user || error) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 })
    }

    const body = (await request.json()) as {
      bankName?: string
      accountNumber?: string
      accountHolder?: string
      cryptoNetwork?: string
      cryptoAddress?: string
    }

    const payload = {
      id: user.id,
      email: user.email ?? null,
      bank_name: String(body.bankName ?? "").trim() || null,
      account_number: String(body.accountNumber ?? "").trim() || null,
      account_holder: String(body.accountHolder ?? "").trim() || null,
      crypto_network: String(body.cryptoNetwork ?? "").trim() || null,
      crypto_address: String(body.cryptoAddress ?? "").trim() || null,
    }

    const { data, error: upsertError } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select(
        "id, email, nickname, avatar_url, bank_name, account_number, account_holder, crypto_network, crypto_address"
      )
      .single()

    if (upsertError) {
      console.error("[PUT /api/user]", upsertError.message)
      if (/column|schema cache|does not exist/i.test(upsertError.message)) {
        return NextResponse.json(
          {
            error:
              "profiles 수령 계좌 컬럼이 없습니다. supabase/payout-and-settle.sql을 실행해 주세요.",
          },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ user: toUserPayload(data as ProfilePayoutRow) })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update user"
    console.error("[PUT /api/user]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
