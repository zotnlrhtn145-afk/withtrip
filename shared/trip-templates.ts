/**
 * 공개 여행 템플릿 — 웹·앱이 똑같이 쓰는 분류와 규칙.
 *
 * ## 왜 테마를 12개로 못박나
 *
 * 자유 태그를 열면 "맛집"·"먹방"·"맛집투어" 가 다 따로 놀아서 묶음 페이지가
 * 안 만들어진다. 검색어("도쿄 맛집투어")가 곧 페이지 주소가 돼야 하므로
 * 어휘를 고정한다. 최대 3개 선택 — 발행 API 가 이 목록과 대조해서 거른다.
 *
 * ⚠️ 이 파일은 `~/withtrip/shared/` 가 원본이다.
 *    앱 쪽 `src/lib/shared/` 는 복사본이므로 직접 고치지 말 것.
 */

export type TripTheme = {
  key: string
  label: string
  emoji: string
}

export const TRIP_THEMES: readonly TripTheme[] = [
  // 먹는 여행
  { key: "food", label: "맛집투어", emoji: "🍜" },
  { key: "cafe", label: "카페투어", emoji: "☕" },
  { key: "michelin", label: "미쉐린", emoji: "⭐" },
  // 누구와
  { key: "kids", label: "가족·아이랑", emoji: "👨‍👩‍👧" },
  { key: "couple", label: "커플", emoji: "💑" },
  { key: "friends", label: "친구", emoji: "🎒" },
  { key: "parents", label: "부모님", emoji: "🧓" },
  { key: "solo", label: "혼자", emoji: "🚶" },
  // 스타일
  { key: "shopping", label: "쇼핑", emoji: "🛍️" },
  { key: "nature", label: "자연·힐링", emoji: "🌿" },
  { key: "activity", label: "액티비티", emoji: "🏄" },
  { key: "culture", label: "문화·전시", emoji: "🏛️" },
] as const

export const MAX_THEMES = 3

const THEME_BY_KEY = new Map(TRIP_THEMES.map((t) => [t.key, t]))

export function themeOf(key: string): TripTheme | undefined {
  return THEME_BY_KEY.get(key)
}

/** 발행 API 가 쓴다 — 목록에 없는 값·3개 초과를 거른다 */
export function sanitizeThemes(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  for (const v of input) {
    const k = String(v ?? "").trim()
    if (THEME_BY_KEY.has(k)) seen.add(k)
    if (seen.size >= MAX_THEMES) break
  }
  return [...seen]
}

/**
 * 기간 라벨 — 날짜에서 계산한다. DB 에 저장하지 않는다.
 * (저장하면 날짜를 고칠 때 어긋난다)
 */
export function durationLabel(startDate?: string | null, endDate?: string | null): string {
  if (!startDate || !endDate) return ""
  const s = new Date(startDate + "T00:00:00Z").getTime()
  const e = new Date(endDate + "T00:00:00Z").getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return ""
  const nights = Math.round((e - s) / 86_400_000)
  if (nights <= 0) return "당일"
  if (nights >= 7) return "일주일+"
  return `${nights}박${nights + 1}일`
}

/**
 * 공개 주소(slug) — 검색어가 주소에 그대로 들어가게 만든다.
 *
 *   도쿄 3박4일 미쉐린 → "도쿄-3박4일-미쉐린-a1b2c3d4"
 *
 * ⚠️ 뒤에 id 앞 8자를 꼭 붙인다 — 같은 이름의 템플릿이 얼마든지 나온다.
 * ⚠️ 한글은 그대로 둔다. 주소창·검색 결과에 한글이 보여야 사람이 읽는다
 *    (브라우저가 알아서 퍼센트 인코딩한다).
 */
export function makeTemplateSlug(input: {
  city?: string | null
  startDate?: string | null
  endDate?: string | null
  themes?: string[] | null
  id: string
}): string {
  const parts: string[] = []
  const city = String(input.city ?? "").trim()
  if (city) parts.push(city)
  const dur = durationLabel(input.startDate, input.endDate)
  if (dur) parts.push(dur)
  const first = (input.themes ?? []).map((k) => themeOf(k)?.label).find(Boolean)
  if (first) parts.push(first)
  parts.push(input.id.replace(/-/g, "").slice(0, 8))
  return parts
    .join("-")
    .replace(/[\s·/]+/g, "-")
    .replace(/[^0-9A-Za-z가-힣-]/g, "")
    .replace(/-+/g, "-")
}

/** slug 끝의 id 조각 — 조회는 이걸로 한다 (이름 부분은 바뀔 수 있다) */
export function slugIdPart(slug: string): string {
  const m = String(slug ?? "").match(/([0-9a-f]{8})$/i)
  return m ? m[1].toLowerCase() : ""
}
