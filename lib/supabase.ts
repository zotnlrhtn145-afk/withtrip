import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient as createBrowserSupabase } from "@/utils/supabase/client"

/**
 * Shared browser Supabase client (cookie session via @supabase/ssr).
 * Lazily initialized so SSR / middleware never call createBrowserClient.
 */
let browserClient: SupabaseClient | null = null

function getBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error(
      "[lib/supabase] Browser client cannot be used during SSR. Call from client event handlers or effects only."
    )
  }
  if (!browserClient) {
    browserClient = createBrowserSupabase()
  }
  return browserClient
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getBrowserClient()
    const value = Reflect.get(client as object, prop, receiver)
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value
  },
}) as SupabaseClient

export type TripRow = {
  id: string
  title: string
  invite_code?: string | null
  location: string | null
  start_date: string | null
  end_date: string | null
  flight_info: string | null
  cover_image: string | null
  members: unknown
  user_id?: string | null
  created_at: string
  is_settled?: boolean | null
  settled_at?: string | null
}
