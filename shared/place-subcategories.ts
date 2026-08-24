/** 장소 종류. 웹의 trip-itinerary.ts, 앱의 places.ts 와 같은 값이어야 한다. */
export type WishlistKind = "restaurant" | "bar" | "stay" | "attraction"

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

export const ATTRACTION_SUBCATEGORIES = [
  "랜드마크",
  "박물관·미술관",
  "공원·자연",
  "사원·종교시설",
  "전망대",
  "쇼핑·거리",
  "기타",
] as const

export const SUBCATEGORIES_BY_KIND: Record<WishlistKind, readonly string[]> = {
  restaurant: RESTAURANT_SUBCATEGORIES,
  bar: BAR_SUBCATEGORIES,
  stay: STAY_SUBCATEGORIES,
  attraction: ATTRACTION_SUBCATEGORIES,
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

/**
 * 관광지 세부 분류 — 구글 types 로 먼저 본다.
 * ⚠️ 이름만 보면 "○○공원 카페" 같은 데서 헛짚는다. types 가 있으면 그게 낫다.
 */
const ATTRACTION_TYPE_RULES: { subCategory: string; types: string[] }[] = [
  { subCategory: "박물관·미술관", types: ["museum", "art_gallery", "planetarium"] },
  {
    subCategory: "공원·자연",
    types: ["park", "national_park", "state_park", "garden", "botanical_garden", "beach", "hiking_area", "wildlife_park", "wildlife_refuge", "zoo", "aquarium"],
  },
  {
    subCategory: "사원·종교시설",
    types: ["place_of_worship", "church", "hindu_temple", "mosque", "synagogue", "buddhist_temple", "shinto_shrine", "shrine"],
  },
  { subCategory: "전망대", types: ["observation_deck", "viewpoint", "scenic_spot", "cable_car"] },
  { subCategory: "쇼핑·거리", types: ["shopping_mall", "department_store", "market", "flea_market", "plaza", "square"] },
  { subCategory: "랜드마크", types: ["landmark", "historical_landmark", "historical_place", "monument", "cultural_landmark", "castle", "palace"] },
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
  } else if (input.kind === "restaurant") {
    const byType = matchByTypes(input.types, RESTAURANT_TYPE_RULES)
    if (byType) return byType
  } else if (input.kind === "attraction") {
    const byType = matchByTypes(input.types, ATTRACTION_TYPE_RULES)
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

  if (input.kind === "attraction") {
    if (/박물관|museum|미술관|gallery/.test(hay)) return "박물관·미술관"
    if (/공원|park|정원|garden|자연|산\b|해변|beach/.test(hay)) return "공원·자연"
    if (/사원|temple|신사|shrine|성당|cathedral|교회|church|절\b/.test(hay)) return "사원·종교시설"
    if (/전망대|타워|tower|observatory|스카이/.test(hay)) return "전망대"
    if (/시장|market|거리|street|쇼핑|shopping/.test(hay)) return "쇼핑·거리"
    if (/랜드마크|landmark|성\b|castle|궁\b|palace/.test(hay)) return "랜드마크"
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

/**
 * 구글 `types` 로 대분류(kind)를 정한다.
 *
 * ## 왜 다시 썼나 (신고: "카테고리가 제대로 안 나눠져")
 *
 * 예전 규칙은 세 줄이었다:
 *
 *     if (/lodging|hotel|.../) return "stay"
 *     if (/bar|night_club|lounge/) return "bar"
 *     return "restaurant"          // ← 나머지 전부
 *
 * 두 가지가 크게 잘못돼 있었다.
 *
 * ⚠️ **관광지가 아예 없다.** 박물관·공원·절·전망대가 전부 "레스토랑" 이 됐다.
 *    저장된 502건 중 429건(85%)이 레스토랑이고 관광지는 11건(2%)뿐이었다.
 *    "관광지만 보고 싶은데 안 찾아진다" 는 신고 그대로다.
 *
 * ⚠️ **`/bar/` 가 `barbecue_restaurant` 에 걸린다.** 고기집이 바로 분류됐다.
 *    `barber_shop`(이발소)도 마찬가지다. 부분 문자열로 찾으면 안 되고
 *    **낱말 단위**로 봐야 한다.
 *
 * ## 순서가 중요하다
 *
 * 호텔 안의 바, 미술관 안의 카페처럼 여러 개가 겹친다. **숙소 → 관광지 → 바 →
 * 식당** 순으로 본다. 구글은 `types` 를 중요한 것부터 주지 않으므로 우리가 정한다.
 */
const TYPE_KIND: [WishlistKind, RegExp][] = [
  ["stay", /^(lodging|hotel|resort_hotel|motel|guest_house|hostel|bed_and_breakfast|inn|japanese_inn|campground|rv_park|cottage|farmstay|extended_stay_hotel|budget_japanese_inn)$/],
  [
    "attraction",
    /^(tourist_attraction|museum|art_gallery|park|national_park|state_park|hiking_area|beach|zoo|aquarium|amusement_park|theme_park|water_park|observation_deck|landmark|historical_place|historical_landmark|monument|cultural_landmark|place_of_worship|church|hindu_temple|mosque|synagogue|buddhist_temple|shinto_shrine|shrine|castle|palace|garden|botanical_garden|planetarium|观光|shopping_mall|department_store|market|flea_market|plaza|square|viewpoint|scenic_spot|ski_resort|cable_car|stadium|concert_hall|opera_house|performing_arts_theater|movie_theater|cultural_center|library|sculpture|wildlife_park|wildlife_refuge)$/,
  ],
  ["bar", /^(bar|pub|wine_bar|night_club|bar_and_grill|cocktail_lounge|lounge|izakaya|beer_hall|brewery|distillery)$/],
]

export function kindFromGoogleTypes(types: string[] | undefined | null): WishlistKind {
  /*
    ⚠️ 통째로 이어 붙여 정규식을 돌리지 않는다. 그러면 `barbecue_restaurant` 안의
       "bar" 에 걸린다. 낱말 하나하나를 따로 본다.
  */
  const tokens = (types ?? []).map((t) => String(t ?? "").trim().toLowerCase()).filter(Boolean)
  if (tokens.length === 0) return "restaurant"
  for (const [kind, re] of TYPE_KIND) {
    if (tokens.some((t) => re.test(t))) return kind
  }
  return "restaurant"
}

/** 대분류의 한글 표기 — DB `saved_places.category` 에 이 값이 들어간다 */
export const KIND_LABEL: Record<WishlistKind, string> = {
  restaurant: "레스토랑",
  bar: "라운지 & 바",
  stay: "숙소",
  attraction: "관광지",
}

/**
 * 예전에 저장된 표기를 정리한다.
 * ⚠️ 「관광」과 「관광지」가 따로 저장돼 있어서 필터에서 서로 안 잡혔다.
 */
export function normalizeKindLabel(label: string | null | undefined): string {
  const s = String(label ?? "").trim()
  if (!s) return ""
  if (/^관광/.test(s)) return "관광지"
  if (/^(라운지|바$|바 |bar)/i.test(s)) return "라운지 & 바"
  if (/^(숙소|호텔|숙박)/.test(s)) return "숙소"
  if (/^카페$/.test(s)) return "레스토랑" // 카페는 중분류다 — 대분류로 쓰면 필터가 갈린다
  return s
}
