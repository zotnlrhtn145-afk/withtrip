import { profileToUserSummary, type UserSummary } from "@/lib/friends-api"
import { createClient } from "@/utils/supabase/client"

/** DB(saved_places snake_case) 스냅샷 — 추천으로 보낼 장소 */
export type RecPlace = {
  place_name: string | null
  category?: string | null
  sub_category?: string | null
  local_name?: string | null
  address?: string | null
  phone_number?: string | null
  memo?: string | null
  image_url?: string | null
  rating?: number | null
  review_count?: number | null
  price_range?: string | null
  lat?: number | null
  lng?: number | null
}

export type IncomingRec = {
  id: string
  sender: UserSummary
  placeName: string
  category: string | null
  subCategory: string | null
  address: string | null
  imageUrl: string | null
  rating: number | null
  reviewCount: number | null
  lat: number | null
  lng: number | null
  createdAt: string
  status: string
}

function logErr(scope: string, error: { message?: string }) {
  console.error(`[${scope}]`, error?.message)
}

export async function fetchAcceptedFriends(): Promise<UserSummary[]> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = auth.user?.id
  if (!me) return []
  const { data, error } = await supabase
    .from("friendships")
    .select(
      "user_id, friend_id, status, user_profile:profiles!friendships_user_id_fkey(id, email, nickname, avatar_url), friend_profile:profiles!friendships_friend_id_fkey(id, email, nickname, avatar_url)"
    )
    .or(`user_id.eq.${me},friend_id.eq.${me}`)
    .eq("status", "accepted")
  if (error) {
    logErr("fetchAcceptedFriends", error)
    return []
  }
  const out: UserSummary[] = []
  const seen = new Set<string>()
  for (const r of (data as Record<string, unknown>[]) ?? []) {
    const other = r.user_id === me ? r.friend_profile : r.user_profile
    const s = profileToUserSummary(other as Record<string, unknown> | null)
    if (s && !seen.has(s.userId)) {
      seen.add(s.userId)
      out.push(s)
    }
  }
  return out
}

export async function sendRecommendation(args: {
  recipientId: string
  place: RecPlace
  sourcePlaceId?: string | null
}): Promise<boolean> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = auth.user?.id
  if (!me || me === args.recipientId) return false
  const p = args.place
  const { data: rec, error } = await supabase
    .from("place_recommendations")
    .insert({
      sender_id: me,
      recipient_id: args.recipientId,
      source_place_id: args.sourcePlaceId ?? null,
      place_name: p.place_name ?? "",
      category: p.category ?? null,
      sub_category: p.sub_category ?? null,
      local_name: p.local_name ?? null,
      address: p.address ?? null,
      phone_number: p.phone_number ?? null,
      memo: p.memo ?? null,
      image_url: p.image_url ?? null,
      rating: p.rating ?? null,
      review_count: p.review_count ?? null,
      price_range: p.price_range ?? null,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
    })
    .select("id")
    .single()
  if (error) {
    logErr("sendRecommendation", error)
    return false
  }
  await supabase.rpc("create_notification_safe", {
    p_user_id: args.recipientId,
    p_actor_id: me,
    p_type: "place_recommendation",
    p_message: `추천 맛집: ${p.place_name ?? "장소"}`,
    p_reference_id: (rec as { id: string }).id,
  })
  return true
}

export async function fetchIncomingRecommendations(): Promise<IncomingRec[]> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = auth.user?.id
  if (!me) return []
  const { data, error } = await supabase
    .from("place_recommendations")
    .select(
      "id, sender_id, place_name, category, sub_category, address, image_url, rating, review_count, lat, lng, created_at, status, sender:profiles!place_recommendations_sender_id_fkey(id, nickname, email, avatar_url)"
    )
    .eq("recipient_id", me)
    .in("status", ["pending", "saved"])
    .order("created_at", { ascending: false })
  if (error) {
    logErr("fetchIncomingRecommendations", error)
    return []
  }
  const out: IncomingRec[] = []
  for (const r of (data as Record<string, unknown>[]) ?? []) {
    const sender = profileToUserSummary(r.sender as Record<string, unknown> | null) ?? {
      userId: String(r.sender_id),
      nickname: "사용자",
      email: "",
    }
    out.push({
      id: String(r.id),
      sender,
      placeName: (r.place_name as string) || "장소",
      category: (r.category as string) ?? null,
      subCategory: (r.sub_category as string) ?? null,
      address: (r.address as string) ?? null,
      imageUrl: (r.image_url as string) ?? null,
      rating: (r.rating as number) ?? null,
      reviewCount: (r.review_count as number) ?? null,
      lat: (r.lat as number) ?? null,
      lng: (r.lng as number) ?? null,
      createdAt: String(r.created_at),
      status: String(r.status ?? "pending"),
    })
  }
  return out
}

export async function saveRecommendation(rec: IncomingRec): Promise<boolean> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = auth.user?.id
  if (!me) return false
  const { data: saved, error } = await supabase
    .from("saved_places")
    .insert({
      trip_id: null,
      user_id: me,
      place_name: rec.placeName,
      category: rec.category,
      sub_category: rec.subCategory,
      address: rec.address,
      image_url: rec.imageUrl,
      rating: rec.rating,
      review_count: rec.reviewCount ?? 0,
      lat: rec.lat,
      lng: rec.lng,
      recommended_by: rec.sender.userId, // 추천인 흔적
    })
    .select("id")
    .single()
  if (error) {
    logErr("saveRecommendation", error)
    return false
  }
  await supabase
    .from("place_recommendations")
    .update({ status: "saved", saved_place_id: (saved as { id: string }).id })
    .eq("id", rec.id)
  return true
}

export async function dismissRecommendation(recId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from("place_recommendations")
    .update({ status: "dismissed" })
    .eq("id", recId)
  if (error) {
    logErr("dismissRecommendation", error)
    return false
  }
  return true
}
