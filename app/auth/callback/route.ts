import { NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"

/**
 * OAuth / email magic-link callback.
 * Exchanges `?code=` for a session (cookie) and redirects to the app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const nextParam = searchParams.get("next")
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/"

  const errorDescription =
    searchParams.get("error_description") || searchParams.get("error")

  if (errorDescription) {
    console.error("[auth/callback] provider error:", errorDescription)
    return NextResponse.redirect(`${origin}/?auth=error`)
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host")
      const isLocalEnv = process.env.NODE_ENV === "development"

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      }
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error("[auth/callback] exchangeCodeForSession:", error.message)
  }

  return NextResponse.redirect(`${origin}/?auth=error`)
}
