import "server-only"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/utils/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { validShareToken, type PlaceShare } from "@/shared/place-share"
export async function shareAuth(request: Request) {
  const bearer = request.headers.get("authorization")
  const db = bearer?.startsWith("Bearer ") ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: bearer } }, auth: { persistSession: false } }) : await createClient()
  const { data: { user }, error } = await db.auth.getUser(bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined)
  return { db, user: error ? null : user }
}
export async function readPlaceShare(token: string): Promise<PlaceShare | null> {
  if (!validShareToken(token)) return null
  const db = getSupabaseAdmin()
  if (!db) return null
  const { data, error } = await db.from("place_share_links").select("token,sender,place").eq("token", token).is("revoked_at", null).maybeSingle()
  if (error || !data) return null
  return data as PlaceShare
}
