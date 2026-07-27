import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null = null

/**
 * Browser Supabase client (@supabase/ssr).
 * Shares the auth cookie session set by the server OAuth callback.
 * Singleton — safe to call repeatedly from Client Components.
 */
export function createClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error(
      "[utils/supabase/client] createClient() is browser-only. Use @/utils/supabase/server on the server."
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Check your .env.local file."
    )
  }

  if (!client) {
    client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }

  return client
}
