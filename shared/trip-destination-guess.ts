/**
 * 여행의 목적지(나라·도시) 추정 — 발행 모달의 기본값과 기존 데이터 분류에 쓴다.
 *
 * ## 왜 필요한가
 *
 * trips.location 이 자유 텍스트다 — "부산 · 한국", "도쿄", "오사카 · 일본" 처럼
 * 형식이 제각각이라 기계가 못 읽는다. 템플릿 분류(country_code·city)는
 * 구조화된 값이 필요해서, 이 추정기로 미리 채워 두고 사람이 고치게 한다.
 *
 * ⚠️ **못 맞추면 비워 둔다.** 틀린 분류를 지어내는 것보다 "모름"이 낫다 —
 *    발행 모달에서 사람이 고르면 된다.
 *
 * ⚠️ 이 파일은 `~/withtrip/shared/` 가 원본이다.
 *    앱 쪽 `src/lib/shared/` 는 복사본이므로 직접 고치지 말 것.
 */

import { FLAGS } from "./country-flags"
import { travelCountries } from "./travel-destinations"

export type DestinationGuess = {
  countryCode: string | null
  city: string | null
}

/** 도시 이름 → 나라 코드 (travel-destinations 기준) */
const CITY_TO_COUNTRY = new Map<string, string>()
for (const c of travelCountries) {
  for (const city of c.cities) {
    // "오사카 & 교토" 같은 묶음 항목은 개별 도시로도 등록한다
    for (const part of city.split(/\s*[&·]\s*/)) {
      if (part && !CITY_TO_COUNTRY.has(part)) CITY_TO_COUNTRY.set(part, c.code)
    }
  }
}

/** 나라 이름(양쪽 표기 다) → 코드 */
const COUNTRY_NAME_TO_CODE = new Map<string, string>()
for (const c of travelCountries) {
  COUNTRY_NAME_TO_CODE.set(c.nameKo, c.code)
  COUNTRY_NAME_TO_CODE.set(c.nameEn.toLowerCase(), c.code)
}
for (const [code, f] of Object.entries(FLAGS)) {
  if (!COUNTRY_NAME_TO_CODE.has(f.name)) COUNTRY_NAME_TO_CODE.set(f.name, code)
}
// 자주 쓰는 딴 표기
for (const [name, code] of [
  ["한국", "KR"],
  ["대한민국", "KR"],
  ["korea", "KR"],
  ["japan", "JP"],
  ["오스트레일리아", "AU"],
] as const) {
  if (!COUNTRY_NAME_TO_CODE.has(name)) COUNTRY_NAME_TO_CODE.set(name, code)
}

/**
 * location("부산 · 한국") + 제목("도쿄 가자 🇯🇵")에서 추정한다.
 *
 * 순서:
 *   ① location 을 「·」·「,」·「/」로 쪼개 도시·나라 이름을 찾는다
 *   ② 나라만 찾았고 도시 조각이 남으면 그 조각을 도시로 쓴다
 *      ("용인 · 한국" — 용인이 목록에 없어도 한국은 확실하다)
 *   ③ 그래도 없으면 제목에서 도시 이름을 찾는다
 */
export function guessDestination(location?: string | null, title?: string | null): DestinationGuess {
  const loc = String(location ?? "").trim()
  let countryCode: string | null = null
  let city: string | null = null
  let leftover: string | null = null

  if (loc) {
    const parts = loc
      .split(/\s*[·,/|]\s*/)
      .map((p) => p.trim())
      .filter(Boolean)
    for (const p of parts) {
      const asCountry = COUNTRY_NAME_TO_CODE.get(p) ?? COUNTRY_NAME_TO_CODE.get(p.toLowerCase())
      if (asCountry) {
        countryCode = countryCode ?? asCountry
        continue
      }
      const asCity = CITY_TO_COUNTRY.get(p)
      if (asCity) {
        city = city ?? p
        countryCode = countryCode ?? asCity
        continue
      }
      leftover = leftover ?? p
    }
    // ② 나라는 아는데 도시 조각만 목록에 없는 경우 — 조각을 그대로 도시로
    if (!city && countryCode && leftover) city = leftover
  }

  // ③ 제목에서 도시 찾기 (긴 이름 먼저 — "오사카"가 "오사카 & 교토"보다 먼저 걸리게 정렬)
  if (!city && title) {
    const t = String(title)
    for (const [name, code] of [...CITY_TO_COUNTRY.entries()].sort((a, b) => b[0].length - a[0].length)) {
      if (name.length >= 2 && t.includes(name)) {
        city = name
        countryCode = countryCode ?? code
        break
      }
    }
  }

  return { countryCode, city }
}
