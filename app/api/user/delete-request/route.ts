import { NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"

export const runtime = "nodejs"

/**
 * POST /api/user/delete-request — record a 회원 탈퇴 request.
 * No service-role key is configured, so this never deletes the auth user or
 * data directly; it timestamps `profiles.deletion_requested_at` for an
 * operator to action manually.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 })
    }

    const requestedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        { id: user.id, email: user.email ?? null, deletion_requested_at: requestedAt },
        { onConflict: "id" }
      )
      .select("deletion_requested_at")
      .single()

    if (error) {
      console.error("[POST /api/user/delete-request]", error.message)
      if (/column|schema cache|does not exist/i.test(error.message)) {
        return NextResponse.json(
          {
            error:
              "profiles.deletion_requested_at 컬럼이 없습니다. supabase/profiles-sync.sql을 실행해 주세요.",
          },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      deletionRequestedAt: (data as { deletion_requested_at?: string | null } | null)
        ?.deletion_requested_at ?? requestedAt,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "탈퇴 요청 처리에 실패했어요."
    console.error("[POST /api/user/delete-request]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
