/**
 * 시차가 있는 교통편의 시각을 다루는 계산들.
 *
 * ## 저장 규칙 (이걸 먼저 알아야 나머지가 읽힌다)
 *
 * 교통편의 시각은 **각 공항의 현지 시각**으로 저장한다 — 항공권에 적힌 그대로다.
 *   출발 시각 = 출발 공항 현지 시각
 *   도착 시각 = 도착 공항 현지 시각
 *
 * ⚠️ **UTC 로 바꿔 저장하지 않는다.** 항공권 숫자와 화면 숫자가 달라지는 순간
 *    사람이 앱을 안 믿는다. 게다가 이미 들어 있는 값들은 어느 시간대인지
 *    모르니 변환할 방법도 없다.
 *
 * ## 그래서 생긴 문제
 *
 * 벽시계 숫자를 그냥 빼면 소요시간이 틀린다. 실제로 틀려 있었다:
 *
 *   ICN 09:05 → SGN 12:35   앱이 적은 소요시간 "3시간 30분"
 *   SGN 13:55 → ICN 21:25   앱이 적은 소요시간 "7시간 30분"
 *
 * 같은 노선인데 갈 때와 올 때가 4시간 다르다(실제는 양쪽 다 약 5시간 30분).
 * 미국 노선이면 이 오차가 16시간이 되어, **출발보다 이른 시각에 도착**하는
 * 것처럼 보인다. 그건 진짜 그렇긴 한데, 소요시간까지 틀리면 설명이 안 된다.
 *
 * ⚠️ 시간대는 **IANA 이름**으로 받는다(`Asia/Seoul`). `+09:00` 같은 고정
 *    오프셋으로 두면 서머타임을 못 따라간다 — LAX 는 여름 UTC-7, 겨울 UTC-8 이다.
 */

/** `2026-08-01`, `14:20` 처럼 저장돼 있는 한 쪽 끝 */
export type LocalStamp = {
  /** YYYY-MM-DD. 없으면 계산을 포기한다 — 날짜 없이는 시차를 못 푼다 */
  date: string | null
  /** HH:mm */
  time: string | null
  /** IANA 시간대. 모르면 null */
  tz: string | null
}

/** `9:5` 도 `09:05` 로 본다 — 손으로 넣은 값이 섞여 있다 */
function parseTime(time: string | null): { h: number; m: number } | null {
  const t = (time ?? "").trim()
  const m = /^(\d{1,2}):(\d{1,2})/.exec(t)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null
  return { h, m: min }
}

function parseDate(date: string | null): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((date ?? "").trim())
  if (!m) return null
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) }
}

/**
 * 그 시간대가 그 순간에 UTC 와 몇 분 차이인지.
 *
 * ⚠️ 서머타임 때문에 **날짜마다 다르다.** 그래서 "그 시간대의 오프셋"을 미리
 *    표로 갖고 있을 수 없고, 매번 그 날짜로 물어야 한다.
 *
 * 방법: 그 순간을 UTC 인 척 만든 뒤, 해당 시간대로 형식을 바꿔 읽고, 얼마나
 * 밀렸는지 되짚는다. `Intl` 이 서머타임 규칙을 알고 있으므로 우리가 알 필요가 없다.
 */
function offsetMinutes(tz: string, utcMs: number): number | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    const part: Record<string, string> = {}
    for (const p of fmt.formatToParts(new Date(utcMs))) part[p.type] = p.value
    // hour 가 "24" 로 나오는 환경이 있다 — 자정을 24시로 적는 쪽
    const hour = part.hour === "24" ? 0 : Number(part.hour)
    const asUtc = Date.UTC(
      Number(part.year),
      Number(part.month) - 1,
      Number(part.day),
      hour,
      Number(part.minute),
      Number(part.second)
    )
    return Math.round((asUtc - utcMs) / 60000)
  } catch {
    // 없는 시간대 이름이면 Intl 이 던진다 — 모르는 것으로 본다
    return null
  }
}

/**
 * "그 곳 현지 시각" 을 진짜 순간(UTC ms)으로 바꾼다.
 *
 * ⚠️ 오프셋을 구하려면 순간이 필요한데, 순간을 구하려면 오프셋이 필요하다.
 *    그래서 **두 번 돌린다** — 처음엔 대충 찍고, 그 오프셋으로 다시 잡는다.
 *    서머타임이 바뀌는 그 한 시간을 정확히 넘기기 위한 것이다.
 */
export function toInstant(stamp: LocalStamp): number | null {
  const d = parseDate(stamp.date)
  const t = parseTime(stamp.time)
  if (!d || !t || !stamp.tz) return null
  const naive = Date.UTC(d.y, d.mo - 1, d.d, t.h, t.m)
  const first = offsetMinutes(stamp.tz, naive)
  if (first == null) return null
  const once = naive - first * 60000
  const second = offsetMinutes(stamp.tz, once)
  if (second == null) return null
  return naive - second * 60000
}

/**
 * 실제로 걸리는 시간(분).
 *
 * ⚠️ 어느 한쪽이라도 날짜·시각·시간대가 없으면 **null 을 준다.**
 *    모르면 모른다고 해야 한다 — 틀린 숫자를 보여 주느니 안 보여 주는 게 낫다.
 *    (지금 저장된 호치민 편은 도착 날짜가 비어 있어서 여기에 걸린다)
 */
export function travelMinutes(from: LocalStamp, to: LocalStamp): number | null {
  const a = toInstant(from)
  const z = toInstant(to)
  if (a == null || z == null) return null
  const min = Math.round((z - a) / 60000)
  // 음수거나 하루를 훌쩍 넘으면 입력이 잘못된 것이다 — 지어내지 않는다
  if (min <= 0 || min > 60 * 30) return null
  return min
}

/** `11시간 30분` */
export function formatDuration(minutes: number | null): string {
  if (minutes == null || minutes <= 0) return ""
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}분`
  if (m <= 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

/**
 * 도착이 출발보다 며칠 뒤인가(현지 달력 기준).
 *
 * 미국 갈 때는 **같은 날 더 이른 시각**에 도착하고(0), 올 때는 **다음 날**에
 * 도착한다(+1). 화면에 `+1일` 을 붙일지 정하는 데 쓴다.
 */
export function dayShift(from: LocalStamp, to: LocalStamp): number | null {
  const a = parseDate(from.date)
  const z = parseDate(to.date)
  if (!a || !z) return null
  const days = Math.round(
    (Date.UTC(z.y, z.mo - 1, z.d) - Date.UTC(a.y, a.mo - 1, a.d)) / 86400000
  )
  return Number.isFinite(days) ? days : null
}

/**
 * 두 곳의 시간대가 실제로 다른가.
 *
 * ⚠️ 이름이 다른 것만으로 판단하지 않는다 — `Asia/Seoul` 과 `Asia/Tokyo` 는
 *    이름은 다르지만 시차가 없다. 시차가 0이면 `현지` 배지를 붙이지 않는다.
 *    국내선 화면이 배지로 덮이면 정작 미국 갈 때 눈에 안 들어온다.
 */
export function hasTimeGap(from: LocalStamp, to: LocalStamp): boolean {
  if (!from.tz || !to.tz) return false
  if (from.tz === to.tz) return false
  const at = toInstant(from) ?? Date.now()
  const a = offsetMinutes(from.tz, at)
  const z = offsetMinutes(to.tz, at)
  if (a == null || z == null) return false
  return a !== z
}
