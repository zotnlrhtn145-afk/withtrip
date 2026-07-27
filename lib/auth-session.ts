import { createClient } from "@/utils/supabase/client"

/**
 * Resolve the current user id for DB writes.
 * 1) Explicit override (non-empty)
 * 2) Supabase Auth session (`auth.getUser`)
 * Returns null when unavailable — callers must treat null as optional.
 */
export async function getCurrentUserId(explicitUserId?: string | null): Promise<string | null> {
  const override = String(explicitUserId ?? "").trim()
  if (override && override !== "undefined" && override !== "null") {
    return override
  }

  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      console.warn("[getCurrentUserId] auth.getUser:", error.message)
    }
    const authId = data.user?.id
    if (authId) return authId
  } catch (err) {
    console.warn("[getCurrentUserId] unexpected:", err)
  }

  return null
}
