import type { SupabaseClient } from "@supabase/supabase-js"

/** 본인 기록의 기존 여행 접근 범위. 공개 여부만으로 개인 필드를 허용하지 않습니다. */
export function canReadPersonalRecord(viewerId: string | null | undefined, ownerId: string | null | undefined, membershipStatus?: string | null): boolean {
  return Boolean(viewerId) && (viewerId === ownerId || membershipStatus === "accepted")
}

/** RLS 아래 본인이 수락한 참여만 읽습니다. 초대 대기·거절·레거시 null은 포함하지 않습니다. */
export async function fetchAcceptedRecordTripIds(client: SupabaseClient, userId: string): Promise<string[]> {
  const ids = new Set<string>()
  const size = 500
  for (let offset = 0; ; offset += size) {
    const result = await client.from("trip_members").select("trip_id")
      .eq("user_id", userId).eq("status", "accepted").order("trip_id").range(offset, offset + size - 1)
    if (result.error) throw result.error
    const rows = result.data ?? []
    for (const row of rows) if (row.trip_id) ids.add(row.trip_id)
    if (rows.length < size) return [...ids]
  }
}

