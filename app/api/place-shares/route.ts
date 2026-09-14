import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { shareAuth } from "@/lib/place-share-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { type SharePlace, placeShareUrl } from "@/shared/place-share"
export const runtime = "nodejs"
const clean = (x: unknown, max: number) => typeof x === "string" ? x.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : ""
const number = (x: unknown, min: number, max: number) => typeof x === "number" && Number.isFinite(x) && x >= min && x <= max ? x : null
function safePhoto(input: unknown, origin: string) {
  try {
    const u = new URL(String(input || ""), origin)
    if (u.hostname === "maps.googleapis.com") {
      const ref = u.searchParams.get("photo_reference")
      return ref ? `${origin}/api/places/photo?ref=${encodeURIComponent(ref)}&w=800` : null
    }
    if (u.protocol !== "https:" || u.username || u.password || /(?:key|token|signature)=/i.test(u.search)) return null
    const storageHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
    if (u.origin === origin && u.pathname === "/api/places/photo") return u.toString()
    if (u.hostname === storageHost && u.pathname.startsWith("/storage/v1/object/public/")) return u.toString()
    if (["images.unsplash.com", "images.pexels.com"].includes(u.hostname)) return u.toString()
  } catch { /* malformed or private image */ }
  return null
}
export async function POST(request: Request) {
  const { db, user } = await shareAuth(request)
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  const limited = await checkRateLimit(request, "cheap", "place-share")
  if (limited) return limited
  if (Number(request.headers.get("content-length")) > 16000) return new NextResponse(null, { status: 413 })
  let body
  try { const raw = await request.text(); if (raw.length > 16000) return new NextResponse(null, { status: 413 }); body = JSON.parse(raw) } catch { return new NextResponse(null, { status: 400 }) }
  let p = body?.place as SharePlace | undefined
  // Read under the sender's RLS, never admin lookup by a client-supplied saved ID.
  if (body?.sourceId) {
    const { data, error } = await db.from("saved_places").select("place_name,address,lat,lng,image_url,category,sub_category,rating,review_count").eq("id", body.sourceId).maybeSingle()
    if (error || !data) return NextResponse.json({ error: "공유할 장소를 확인하지 못했어요." }, { status: 404 })
    p = { name: data.place_name, address: data.address, lat: data.lat, lng: data.lng, imageUrl: data.image_url, category: data.sub_category || data.category, rating: data.rating, reviewCount: data.review_count }
  }
  if (!p || !clean(p.name, 160)) return NextResponse.json({ error: "장소 이름이 필요합니다." }, { status: 400 })
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.withtrip.co.kr").replace(/\/$/, "")
  const place: SharePlace = { name: clean(p.name, 160), address: clean(p.address, 250), category: clean(p.category, 80), lat: number(p.lat, -90, 90), lng: number(p.lng, -180, 180), rating: number(p.rating, 0, 5), reviewCount: number(p.reviewCount, 0, 100000000), imageUrl: safePhoto(p.imageUrl, origin) }
  // No private memo in public previews. Display verified category/address/rating instead.
  const { data: profile } = await db.from("profiles").select("nickname").eq("id", user.id).maybeSingle()
  const share = { token: randomBytes(24).toString("hex"), sender: clean(profile?.nickname, 30) || "위드트립 여행자", place }
  const admin = getSupabaseAdmin()
  if (!admin) return new NextResponse(null, { status: 503 })
  const { error } = await admin.from("place_share_links").insert({ ...share, user_id: user.id })
  if (error) return NextResponse.json({ error: "공유 링크를 준비하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 503 })
  return NextResponse.json({ ...share, url: placeShareUrl(origin, share.token), bridgeUrl: `${origin}/share/place/${share.token}` }, { headers: { "Cache-Control": "no-store" } })
}
