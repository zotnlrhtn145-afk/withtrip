import { createClient } from "@/utils/supabase/client"

export type ShareLocation = {
  name: string
  lat?: number | null
  lng?: number | null
  address?: string | null
}

export type ShareTrip = { id: string; title: string }

function payloadOf(loc: ShareLocation) {
  return {
    name: loc.name,
    lat: loc.lat ?? null,
    lng: loc.lng ?? null,
    address: loc.address ?? null,
  }
}

/** 참여 중인 여행 목록 (위치 공유 대상) */
export async function fetchMyTrips(): Promise<ShareTrip[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("trips")
    .select("id, title")
    .order("start_date", { ascending: false })
  if (error) {
    console.error("[fetchMyTrips]", error.message)
    return []
  }
  return ((data as { id: string; title: string | null }[]) ?? []).map((t) => ({
    id: t.id,
    title: t.title || "제목 없는 여행",
  }))
}

export async function shareLocationToFriend(friendId: string, loc: ShareLocation): Promise<boolean> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = auth.user?.id
  if (!me) return false
  const { error } = await supabase.rpc("notify_location_friend", {
    p_user_id: friendId,
    p_actor_id: me,
    p_message: `📍 위치 공유: ${loc.name}`,
    p_payload: payloadOf(loc),
  })
  if (error) {
    console.error("[shareLocationToFriend]", error.message)
    return false
  }
  return true
}

export async function shareLocationToTrip(tripId: string, loc: ShareLocation): Promise<boolean> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = auth.user?.id
  if (!me) return false
  const { error } = await supabase.rpc("notify_location_trip", {
    p_trip_id: tripId,
    p_actor_id: me,
    p_message: `📍 위치 공유: ${loc.name}`,
    p_payload: payloadOf(loc),
  })
  if (error) {
    console.error("[shareLocationToTrip]", error.message)
    return false
  }
  return true
}
