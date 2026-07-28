import { NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"

/**
 * Accept invite by `trips.invite_code`, insert user into `trip_members`,
 * then redirect to the trip detail page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin
  const code = String(url.searchParams.get("code") ?? "").trim()

  if (!code) {
    return NextResponse.redirect(`${origin}/?invite=invalid`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/?view=login`)
  }

  const tripLookup = await supabase
    .from("trips")
    .select("id")
    .eq("invite_code", code)
    .maybeSingle()

  if (tripLookup.error || !tripLookup.data?.id) {
    console.error("[join] trip lookup failed:", tripLookup.error?.message ?? "not found")
    return NextResponse.redirect(`${origin}/?invite=invalid`)
  }

  const tripId = String(tripLookup.data.id)

  const upsert = await supabase
    .from("trip_members")
    .upsert(
      {
        trip_id: tripId,
        user_id: user.id,
        status: "accepted",
      },
      {
        onConflict: "trip_id,user_id",
      }
    )

  if (upsert.error) {
    console.error("[join] insert member failed:", upsert.error.message)
    // Continue to detail page even when already exists / partial schema mismatch.
  }

  return NextResponse.redirect(`${origin}/trips/${tripId}`)
}
