import { NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/trips/[id]/settle
 * Body: { isSettled?: boolean } — omit to toggle current value.
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: tripId } = await context.params
    const id = String(tripId ?? "").trim()
    if (!id) {
      return NextResponse.json({ error: "trip id is required." }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      isSettled?: boolean
    }

    const { data: trip, error: loadError } = await supabase
      .from("trips")
      .select("id, is_settled, settled_at, user_id")
      .eq("id", id)
      .maybeSingle()

    if (loadError) {
      console.error("[PATCH settle] load:", loadError.message)
      if (/column|schema cache|does not exist/i.test(loadError.message)) {
        return NextResponse.json(
          {
            error:
              "trips.is_settled 컬럼이 없습니다. supabase/payout-and-settle.sql을 실행해 주세요.",
          },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: loadError.message }, { status: 500 })
    }

    if (!trip) {
      return NextResponse.json({ error: "여행을 찾을 수 없어요." }, { status: 404 })
    }

    // Allow owner or trip member
    const isOwner = String(trip.user_id ?? "") === user.id
    if (!isOwner) {
      const { data: membership } = await supabase
        .from("trip_members")
        .select("user_id")
        .eq("trip_id", id)
        .eq("user_id", user.id)
        .maybeSingle()
      if (!membership) {
        return NextResponse.json(
          { error: "이 여행의 정산을 변경할 권한이 없어요." },
          { status: 403 }
        )
      }
    }

    const current = Boolean(trip.is_settled)
    const next =
      typeof body.isSettled === "boolean" ? body.isSettled : !current

    const { data: updated, error: updateError } = await supabase
      .from("trips")
      .update({
        is_settled: next,
        settled_at: next ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("id, is_settled, settled_at")
      .maybeSingle()

    if (updateError) {
      console.error("[PATCH settle] update:", updateError.message)
      if (/column|schema cache|does not exist/i.test(updateError.message)) {
        return NextResponse.json(
          {
            error:
              "trips.is_settled 컬럼이 없습니다. supabase/payout-and-settle.sql을 실행해 주세요.",
          },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json(
        { error: "정산 상태를 저장할 권한이 없거나 여행을 찾을 수 없어요." },
        { status: 403 }
      )
    }

    return NextResponse.json({
      tripId: updated.id,
      isSettled: Boolean(updated.is_settled),
      settledAt: updated.settled_at ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update settle status"
    console.error("[PATCH /api/trips/[id]/settle]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** GET /api/trips/[id]/settle — read settle status */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: tripId } = await context.params
    const id = String(tripId ?? "").trim()
    if (!id) {
      return NextResponse.json({ error: "trip id is required." }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("trips")
      .select("id, is_settled, settled_at")
      .eq("id", id)
      .maybeSingle()

    if (error) {
      if (/column|schema cache|does not exist/i.test(error.message)) {
        return NextResponse.json({
          tripId: id,
          isSettled: false,
          settledAt: null,
          warning: "SETTLE_COLUMNS_MISSING",
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "여행을 찾을 수 없어요." }, { status: 404 })
    }

    return NextResponse.json({
      tripId: data.id,
      isSettled: Boolean(data.is_settled),
      settledAt: data.settled_at ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load settle status"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
