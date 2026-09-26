import { createHash } from "node:crypto"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { preferredPhotoRefs } from "@/shared/place-photo-policy"

/** A paid lookup failure must not hide already archived photos. No Google calls. */
export async function readStoredPlaceDetail(placeId: string) {
  if (!placeId) return null
  const db = getSupabaseAdmin()
  if (!db) return null
  const { data: p, error } = await db.from("places")
    .select("google_place_id,name,address,phone,rating,rating_count,price_level,google_types,lat,lng,photo_references,cover_photo_reference")
    .eq("google_place_id", placeId).maybeSingle()
  if (error || !p) return null
  const refs = preferredPhotoRefs(p.photo_references ?? [], p.cover_photo_reference).slice(0, 30)
  const hashes = refs.map(ref => createHash("sha256").update(ref).digest("hex"))
  const photos: string[] = []
  if (hashes.length) {
    const { data: stored, error: photoError } = await db.from("place_photos")
      .select("photo_ref_hash,storage_path,width").in("photo_ref_hash", hashes).order("width", { ascending: false })
    if (photoError) return null
    const paths = new Map<string,string>()
    for (const row of stored ?? []) if (row.storage_path && !paths.has(row.photo_ref_hash)) paths.set(row.photo_ref_hash,row.storage_path)
    for (const hash of hashes) {
      const path = paths.get(hash)
      if (!path) continue
      const { data } = db.storage.from("place-photos").getPublicUrl(path)
      if (data.publicUrl && !photos.includes(data.publicUrl)) photos.push(data.publicUrl)
      if (photos.length === 4) break
    }
  }
  return { placeId:p.google_place_id,name:p.name,address:p.address ?? "",phone:p.phone ?? "",
    rating:p.rating,reviewCount:p.rating_count,priceLevel:p.price_level,types:p.google_types ?? [],
    summary:"",openNow:null,hours:[],periods:[],utcOffsetMin:null,lat:p.lat,lng:p.lng,photos,source:"stored" }
}
