import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Supabase server client (@supabase/ssr).
 * Use in Server Components, Server Actions, and Route Handlers.
 * Creates a new client per call — do not share across requests.
 */
export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Check your .env.local file."
    )
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a Server Component where cookies cannot be set.
          // Safe to ignore when a middleware/proxy refreshes sessions.
        }
      },
    },
  })
}
