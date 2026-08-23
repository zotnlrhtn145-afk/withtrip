import { supabase } from "@/lib/supabase"

/**
 * 공항 코드 → 시간대.
 *
 * ⚠️ 목록을 **코드에 박지 않는다.** 공항 이름은 이미 DB(`airport_names`)에
 *    있고, 거기에 새 공항이 추가되면 시간대도 같이 들어온다. 코드에 사본을
 *    두면 공항 하나 추가할 때마다 두 곳(웹·앱)을 고쳐야 하고, 한쪽만 고치면
 *    "이 공항만 소요시간이 안 나와요" 가 된다.
 *
 * 36줄짜리 표라서 한 번 받아 두고 계속 쓴다.
 */
let cache: Map<string, string> | null = null
let inflight: Promise<Map<string, string>> | null = null

export async function loadAirportTz(): Promise<Map<string, string>> {
  if (cache) return cache
  // 동시에 여러 곳에서 불러도 왕복은 한 번만
  if (!inflight) {
    inflight = (async () => {
      const { data } = await supabase.from("airport_names").select("code, tz").not("tz", "is", null)
      const map = new Map<string, string>()
      for (const r of (data as { code: string; tz: string }[] | null) ?? []) {
        map.set(String(r.code).toUpperCase(), r.tz)
      }
      // 한 건도 못 받았으면 캐시에 남기지 않는다 — 다음에 다시 시도해야 한다
      if (map.size > 0) cache = map
      inflight = null
      return map
    })()
  }
  return inflight
}

/**
 * `fromLabel` / `toLabel` 로 시간대를 찾는다.
 *
 * ⚠️ 이 칸에는 공항 코드(`ICN`)뿐 아니라 **자유 입력**도 들어온다
 *    (`수서역`, `포항`). 못 찾으면 null 이고, 그러면 시차가 없는 것으로 본다 —
 *    국내 이동이라 실제로 그렇다.
 */
export function tzOf(map: Map<string, string>, label: string | null | undefined): string | null {
  const code = String(label ?? "").trim().toUpperCase()
  if (code.length !== 3) return null
  return map.get(code) ?? null
}
