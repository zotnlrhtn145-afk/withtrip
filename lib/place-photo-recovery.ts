import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { buildPlacePhotoProxyUrl } from "@/lib/place-cover-image"

// Only server-recorded associations may identify a place. Never infer by name.
export async function recoverPlacePhoto(ref: string, width: number, apiKey: string,
  load: (ref: string) => Promise<Response>): Promise<Response | null> {
  const db = getSupabaseAdmin()
  if (!db) return null
  const { data: matches, error } = await db.from("places")
    .select("google_place_id,photo_references,cover_photo_reference")
    .contains("photo_references", [ref]).limit(2)
  if (error) return null
  const encoded = encodeURIComponent(ref)
  // Escape LIKE wildcards, including '_' in Google's references.
  const literal = encoded.replace(/[\\%_]/g, "\\$&")
  const { data: saved, error: savedError } = await db.from("saved_places")
    .select("id,google_place_id,image_url")
    .like("image_url", `%ref=${literal}&%`).limit(1000)
  if (savedError) return null
  const ids = new Set([...(matches ?? []).map(p => p.google_place_id),
    ...(saved ?? []).map(p => p.google_place_id)].filter(Boolean))
  if (ids.size !== 1) return null
  const gid = [...ids][0] as string
  const cached = matches?.find(p => p.google_place_id === gid)
  const candidates = [...new Set<string>([cached?.cover_photo_reference,
    ...(cached?.photo_references ?? [])].filter((r): r is string => !!r && r !== ref))]
  let freshRefs: string[] | null = null
  let chosen = ""
  let response: Response | null = null
  // Reuse another already known photo before buying a details refresh.
  for (const candidate of candidates.slice(0, 1)) {
    const r = await load(candidate)
    if (r.status < 400) { response = r; chosen = candidate; break }
  }
  if (!response) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json")
    url.searchParams.set("place_id", gid)
    url.searchParams.set("fields", "place_id,photos")
    url.searchParams.set("key", apiKey)
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const data = await r.json() as { status?: string; result?: { place_id?: string; photos?: { photo_reference?: string }[] } }
    if (data.status !== "OK" || data.result?.place_id !== gid) return null
    freshRefs = (data.result.photos ?? []).map(p => p.photo_reference ?? "").filter(Boolean).slice(0, 6)
    for (const candidate of freshRefs.slice(0, 2)) {
      if (candidate === ref) continue
      const r = await load(candidate)
      if (r.status < 400) { response = r; chosen = candidate; break }
    }
  }
  if (!response || !chosen) return null
  // Keep the failed reference as an identity alias for in-flight/older clients.
  // Put it last; never use it as the new cover.
  const refs = [...new Set([chosen, ...(freshRefs ?? candidates), ref])]
  const { error: cacheError } = await db.from("places").update({
    photo_references: refs, cover_photo_reference: chosen,
  }).eq("google_place_id", gid)
  if (cacheError) console.warn("[photo-recovery] cache update failed")
  const image = buildPlacePhotoProxyUrl(chosen, 1200, "https://www.withtrip.co.kr")
  for (const row of saved ?? []) {
    if (row.google_place_id !== gid || !row.image_url) continue
    // Compare-and-set protects a user's photo changed during the request.
    const { error: updateError } = await db.from("saved_places").update({ image_url: image })
      .eq("id", row.id).eq("google_place_id", gid).eq("image_url", row.image_url)
    if (updateError) console.warn("[photo-recovery] saved image update failed")
  }
  return response
}
