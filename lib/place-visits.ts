import { supabase } from "@/lib/supabase"

/**
 * 다녀온 곳 체크.
 *
 * ⚠️ **가게(google_place_id) 단위다.** saved_places 는 사람마다 행이 따로라
 *    거기 붙이면 같은 가게 기록이 흩어진다.
 *
 * ⚠️ 다녀온 기록은 **본인만 본다**(RLS). 어디에 갔는지는 위치 정보에 가깝다.
 *    리뷰는 공개지만, 리뷰를 안 쓴 방문까지 남에게 보일 이유는 없다.
 *
 * ⚠️ **리뷰 쓰기는 웹에 두지 않는다.** 체크는 한 번 탭이라 웹에서도 부담이 없지만,
 *    별점·글·사진은 다녀온 직후 폰으로 쓰는 것이고 사진 고르기·압축도 앱이 낫다.
 *    두 곳에 폼을 두면 조용히 어긋난다(웹은 읽기, 앱은 쓰기).
 */

export type PlaceMark = {
  /** 내가 다녀온 곳인가 */
  visited: boolean
  /** 내가 준 별점 (리뷰를 안 썼으면 null) */
  myRating: number | null
}

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

/** 내가 이 가게에 다녀왔는지 — 다녀왔다면 언제인지 */
export async function fetchMyVisit(
  googlePlaceId: string
): Promise<{ visited: boolean; visitedAt: string | null }> {
  const uid = await myId()
  if (!uid) return { visited: false, visitedAt: null }
  const { data } = await supabase
    .from("place_visits")
    .select("visited_at")
    .eq("google_place_id", googlePlaceId)
    .eq("user_id", uid)
    .maybeSingle()
  const row = data as { visited_at: string } | null
  return { visited: !!row, visitedAt: row?.visited_at ?? null }
}

/** 다녀옴 표시를 켜고 끈다. 켜면 방문 시각을 새로 찍는다. */
export async function setVisited(googlePlaceId: string, on: boolean): Promise<boolean> {
  const uid = await myId()
  if (!uid) return false

  if (!on) {
    const { error } = await supabase
      .from("place_visits")
      .delete()
      .eq("google_place_id", googlePlaceId)
      .eq("user_id", uid)
    return !error
  }
  const { error } = await supabase.from("place_visits").upsert(
    { google_place_id: googlePlaceId, user_id: uid, visited_at: new Date().toISOString() },
    { onConflict: "google_place_id,user_id" }
  )
  return !error
}

/** 내가 이 가게에 리뷰를 썼는지 — 썼다면 몇 점인지 (다녀옴 해제를 막는 데 쓴다) */
export async function fetchMyRating(googlePlaceId: string): Promise<number | null> {
  const uid = await myId()
  if (!uid) return null
  const { data } = await supabase
    .from("place_reviews")
    .select("rating")
    .eq("google_place_id", googlePlaceId)
    .eq("user_id", uid)
    .maybeSingle()
  return (data as { rating: number } | null)?.rating ?? null
}

/**
 * 여러 가게의 다녀옴·내 평점을 **한 번에** 가져온다.
 *
 * ⚠️ 카드마다 따로 부르면 목록 한 번에 수십 번 왕복한다.
 *    가게 열쇠를 모아 두 번만 부른다.
 */
export async function fetchPlaceMarks(googlePlaceIds: string[]): Promise<Record<string, PlaceMark>> {
  const ids = Array.from(new Set(googlePlaceIds.filter(Boolean)))
  if (ids.length === 0) return {}
  const uid = await myId()
  if (!uid) return {}

  const [visitRes, mineRes] = await Promise.all([
    supabase.from("place_visits").select("google_place_id").eq("user_id", uid).in("google_place_id", ids),
    supabase.from("place_reviews").select("google_place_id, rating").eq("user_id", uid).in("google_place_id", ids),
  ])

  const out: Record<string, PlaceMark> = {}
  const at = (gid: string) => (out[gid] ??= { visited: false, myRating: null })
  for (const v of (visitRes.data as { google_place_id: string }[]) ?? []) at(v.google_place_id).visited = true
  for (const r of (mineRes.data as { google_place_id: string; rating: number }[]) ?? [])
    at(r.google_place_id).myRating = r.rating
  return out
}
