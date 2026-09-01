/**
 * 가게별 영업시간 — 목록에 「영업 중 / 쉬는 시간 / 오늘 휴무」를 붙이는 데 쓴다.
 *
 * ⚠️ **구글에 묻지 않는다.** `places` 캐시에서만 읽는다. 목록에서 곳마다 물으면
 *    1000회당 $17 다. 캐시는 상세를 열 때와 `/api/admin/fill-hours` 로 채운다.
 * ⚠️ 판단은 `shared/opening-hours.ts` 한 곳에서 — 앱과 같은 답이 나와야 한다.
 */

import { supabase } from "@/lib/supabase"
import type { Period } from "@/shared/opening-hours"

export type PlaceHours = {
  periods: Period[] | null
  utcOffsetMin: number | null
}

/**
 * 여러 가게의 영업시간을 한 번에 읽는다.
 * ⚠️ `in()` 에 수백 개를 넣으면 주소가 너무 길어 실패한다 — 80개씩 자른다.
 */
export async function fetchPlaceHours(googlePlaceIds: string[]): Promise<Record<string, PlaceHours>> {
  const ids = Array.from(new Set(googlePlaceIds.filter(Boolean)))
  if (ids.length === 0) return {}
  const out: Record<string, PlaceHours> = {}
  try {
    for (let i = 0; i < ids.length; i += 80) {
      const { data, error } = await supabase
        .from("places")
        .select("google_place_id, opening_periods, utc_offset_min")
        .in("google_place_id", ids.slice(i, i + 80))
      if (error) continue
      for (const r of (data ?? []) as {
        google_place_id: string
        opening_periods: Period[] | null
        utc_offset_min: number | null
      }[]) {
        out[r.google_place_id] = {
          periods: r.opening_periods ?? null,
          utcOffsetMin: r.utc_offset_min ?? null,
        }
      }
    }
  } catch {
    /* 딱지가 안 보일 뿐 목록은 그대로 돈다 */
  }
  return out
}
