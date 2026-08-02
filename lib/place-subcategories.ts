import type { WishlistKind } from "@/lib/trip-itinerary"

/** 레스토랑 세부 카테고리 — "저장한 장소" 탭의 음식 종류 분류 기준. */
export const RESTAURANT_SUBCATEGORIES = [
  "한식",
  "일식",
  "스시",
  "국수·면요리",
  "중식",
  "이탈리안",
  "프렌치",
  "양식",
  "고기·구이",
  "해산물",
  "브런치",
  "카페",
  "디저트",
  "기타",
] as const

export const BAR_SUBCATEGORIES = [
  "칵테일 바",
  "와인 바",
  "이자카야",
  "펍",
  "루프탑 라운지",
  "기타",
] as const

export const STAY_SUBCATEGORIES = [
  "호텔",
  "리조트",
  "료칸",
  "게스트하우스",
  "펜션",
  "기타",
] as const

export const SUBCATEGORIES_BY_KIND: Record<WishlistKind, readonly string[]> = {
  restaurant: RESTAURANT_SUBCATEGORIES,
  bar: BAR_SUBCATEGORIES,
  stay: STAY_SUBCATEGORIES,
}

/**
 * Google Places `types`는 legacy API 기준으로도 `sushi_restaurant`,
 * `ramen_restaurant`, `japanese_restaurant`처럼 꽤 구체적인 값을 준다.
 * 이게 있으면 이름 텍스트보다 훨씬 신뢰도가 높으므로 최우선으로 검사한다.
 */
const RESTAURANT_TYPE_RULES: { subCategory: string; types: string[] }[] = [
  { subCategory: "스시", types: ["sushi_restaurant"] },
  { subCategory: "국수·면요리", types: ["ramen_restaurant", "noodle_house"] },
  { subCategory: "한식", types: ["korean_restaurant"] },
  { subCategory: "일식", types: ["japanese_restaurant"] },
  { subCategory: "중식", types: ["chinese_restaurant"] },
  { subCategory: "이탈리안", types: ["italian_restaurant", "pizza_restaurant"] },
  { subCategory: "프렌치", types: ["french_restaurant"] },
  { subCategory: "해산물", types: ["seafood_restaurant"] },
  { subCategory: "고기·구이", types: ["steak_house", "barbecue_restaurant"] },
  { subCategory: "브런치", types: ["breakfast_restaurant", "brunch_restaurant"] },
  { subCategory: "디저트", types: ["bakery", "dessert_shop", "ice_cream_shop", "candy_store"] },
  { subCategory: "카페", types: ["cafe", "coffee_shop"] },
]

const BAR_TYPE_RULES: { subCategory: string; types: string[] }[] = [
  { subCategory: "와인 바", types: ["wine_bar"] },
  { subCategory: "펍", types: ["pub"] },
]

const STAY_TYPE_RULES: { subCategory: string; types: string[] }[] = [
  { subCategory: "리조트", types: ["resort_hotel"] },
  { subCategory: "게스트하우스", types: ["guest_house", "hostel"] },
]

function matchByTypes(
  types: string[] | null | undefined,
  rules: { subCategory: string; types: string[] }[]
): string | null {
  if (!types || types.length === 0) return null
  const set = new Set(types.map((t) => t.toLowerCase()))
  for (const rule of rules) {
    if (rule.types.some((t) => set.has(t))) return rule.subCategory
  }
  return null
}

/**
 * Google Places / 큐레이션 데이터의 이름·타입·설명 텍스트로부터 표준 세부
 * 카테고리(한식/일식/스시/국수… 등)를 추정한다. 검색 결과를 고를 때 자동으로
 * 채워지고, 사용자가 직접 다른 칩으로 바꿀 수도 있다.
 *
 * `types`(Google Places raw types)가 있으면 최우선으로 신뢰하고, 없거나
 * 매칭되지 않으면 이름/설명 텍스트 키워드로 한 번 더 추정한다. 마지막에는
 * "레스토랑"/"restaurant"처럼 모든 음식점에 다 붙는 범용 단어에 걸려
 * 엉뚱한 카테고리(예: 양식)로 오분류되지 않도록 명확한 신호가 없으면
 * "기타"로 남긴다.
 */
export function guessSubCategory(input: {
  kind: WishlistKind
  name?: string | null
  types?: string[] | null
  /** 업스트림에서 이미 붙여준 설명형 텍스트(예: "이노베이티브 프렌치 · 코스"). */
  hint?: string | null
}): string {
  if (input.kind === "stay") {
    const byType = matchByTypes(input.types, STAY_TYPE_RULES)
    if (byType) return byType
  } else if (input.kind === "bar") {
    const byType = matchByTypes(input.types, BAR_TYPE_RULES)
    if (byType) return byType
  } else {
    const byType = matchByTypes(input.types, RESTAURANT_TYPE_RULES)
    if (byType) return byType
  }

  const hay = `${input.name ?? ""} ${(input.types ?? []).join(" ")} ${input.hint ?? ""}`.toLowerCase()

  if (input.kind === "stay") {
    if (/료칸|ryokan/.test(hay)) return "료칸"
    if (/리조트|resort/.test(hay)) return "리조트"
    if (/게스트하우스|guest ?house|hostel|호스텔/.test(hay)) return "게스트하우스"
    if (/펜션|pension/.test(hay)) return "펜션"
    if (/호텔|hotel|lodging|숙소|숙박/.test(hay)) return "호텔"
    return "기타"
  }

  if (input.kind === "bar") {
    if (/이자카야|izakaya/.test(hay)) return "이자카야"
    if (/와인|wine/.test(hay)) return "와인 바"
    if (/루프탑|rooftop/.test(hay)) return "루프탑 라운지"
    if (/펍|\bpub\b|beer|맥주/.test(hay)) return "펍"
    if (/칵테일|cocktail|하이볼|바\b|bar\b|라운지|lounge/.test(hay)) return "칵테일 바"
    return "기타"
  }

  // restaurant — 구체적인 신호만 매칭하고, "레스토랑"/"restaurant"/"다이닝"처럼
  // 모든 곳에 다 붙는 범용어는 절대 매칭 조건으로 쓰지 않는다.
  if (/스시|sushi|오마카세|omakase/.test(hay)) return "스시"
  if (/라멘|ramen|우동|udon|소바|soba|국수|면요리|noodle/.test(hay)) return "국수·면요리"
  if (/야키니쿠|yakiniku|고기|구이|삼겹살|갈비|바비큐|\bbbq\b|스테이크|steak/.test(hay)) {
    return "고기·구이"
  }
  if (/해산물|seafood|조개|굴\b|생선회/.test(hay)) return "해산물"
  if (/일식|japanese|가이세키|kaiseki|이자카야/.test(hay)) return "일식"
  if (/한식|korean|정식|백반/.test(hay)) return "한식"
  if (/중식|chinese|딤섬|dim ?sum|마라/.test(hay)) return "중식"
  if (/이탈리안|italian|파스타|pasta|피자|pizza/.test(hay)) return "이탈리안"
  if (/프렌치|french|비스트로|bistro/.test(hay)) return "프렌치"
  if (/브런치|brunch/.test(hay)) return "브런치"
  if (/디저트|dessert|베이커리|bakery|빵집|patisserie|아이스크림|ice ?cream/.test(hay)) {
    return "디저트"
  }
  if (/카페|cafe|coffee/.test(hay)) return "카페"
  if (/양식|western|콘티넨탈|continental|스테이크하우스/.test(hay)) return "양식"
  return "기타"
}
