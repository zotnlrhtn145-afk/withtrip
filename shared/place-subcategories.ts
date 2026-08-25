/** 장소 종류. 웹의 trip-itinerary.ts, 앱의 places.ts 와 같은 값이어야 한다. */
/**
 * 장소 종류(대분류).
 *
 * ⚠️ **여기는 열어 두지 않는다.** 탭과 필터가 이 위에 서 있어서, 늘어나면
 *    화면이 통째로 흔들린다. 애매한 것은 중분류에서 받는다.
 * ⚠️ `shopping`·`experience` 는 나중에 붙였다. 넷뿐일 때는 옷가게·칼 쇼룸·
 *    쇼핑거리·공연이 전부 「레스토랑」에 들어와 있었다 — 담을 칸이 없어서다.
 */
export type WishlistKind = "restaurant" | "bar" | "stay" | "attraction" | "shopping" | "experience"

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

export const SHOPPING_SUBCATEGORIES = [
  "백화점·몰",
  "편집숍·패션",
  "기념품·특산품",
  "생활·잡화",
  "서점",
  "기타",
] as const

export const EXPERIENCE_SUBCATEGORIES = [
  "공연·전시",
  "클래스·체험",
  "스파·웰니스",
  "액티비티",
  "기타",
] as const

export const SUBCATEGORIES_BY_KIND: Record<WishlistKind, readonly string[]> = {
  restaurant: RESTAURANT_SUBCATEGORIES,
  bar: BAR_SUBCATEGORIES,
  stay: STAY_SUBCATEGORIES,
  attraction: ATTRACTION_SUBCATEGORIES,
  shopping: SHOPPING_SUBCATEGORIES,
  experience: EXPERIENCE_SUBCATEGORIES,
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
    /^(tourist_attraction|museum|art_gallery|park|national_park|state_park|hiking_area|beach|zoo|aquarium|amusement_park|theme_park|water_park|observation_deck|landmark|historical_place|historical_landmark|monument|cultural_landmark|place_of_worship|church|hindu_temple|mosque|synagogue|buddhist_temple|shinto_shrine|shrine|castle|palace|garden|botanical_garden|planetarium|观光|market|flea_market|plaza|square|viewpoint|scenic_spot|ski_resort|cable_car|stadium|concert_hall|opera_house|performing_arts_theater|movie_theater|cultural_center|library|sculpture|wildlife_park|wildlife_refuge)$/,
  ],
  ["bar", /^(bar|pub|wine_bar|night_club|bar_and_grill|cocktail_lounge|lounge|izakaya|beer_hall|brewery|distillery)$/],
  /*
    ⚠️ 맨 `store` 는 넣지 않는다. 구글은 카페에도 `store` 를 붙여서,
       `["cafe","store"]` 인 곳이 통째로 쇼핑으로 갔다(실측: chạm bản café).
       옷가게·서점처럼 **구체적인 것만** 본다.
  */
  [
    "shopping",
    /^(shopping_mall|department_store|clothing_store|shoe_store|jewelry_store|book_store|gift_shop|home_goods_store|furniture_store|electronics_store|convenience_store|supermarket|grocery_store|discount_store|outlet_(mall|store))$/,
  ],
  [
    "experience",
    /^(spa|massage|beauty_salon|amusement_center|bowling_alley|golf_course|gym|fitness_center|sports_complex|art_studio|cooking_school|school|event_venue|banquet_hall|casino)$/,
  ],
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
  shopping: "쇼핑",
  experience: "체험",
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

/**
 * 이름만 보고 분류한다 — **구글도 AI 도 안 부르는 가장 싼 길.**
 *
 * ⚠️ 규칙을 넓히는 게 제일 싸다. 낱말 하나를 더 넣는 건 공짜이고 영원히
 *    쓰이지만, AI 를 부르는 건 **매번** 돈이다. 실측으로 이름 규칙만으로
 *    502곳 중 153곳이 걸렸는데, 한·일 음식 낱말이 거의 없어서 그랬다.
 *
 * ⚠️ 범용어(「레스토랑」·「restaurant」·「다이닝」)는 절대 쓰지 않는다.
 *    모든 가게에 다 붙어서 아무 뜻이 없다.
 *
 * ⚠️ 위에서부터 먼저 걸리는 것을 쓴다. 그래서 **좁은 것을 위에** 둔다 —
 *    「닭갈비」가 「갈비」보다 먼저 와야 고기·구이가 아니라 닭요리로 간다.
 */
const NAME_RULES: { kind: WishlistKind; sub: string; detail?: string; re: RegExp }[] = [
  // ── 숙소 ──
  { kind: "stay", sub: "료칸", re: /료칸|ryokan|旅館/i },
  { kind: "stay", sub: "리조트", re: /리조트|resort/i },
  { kind: "stay", sub: "게스트하우스", re: /게스트하우스|guest ?house|hostel|호스텔/i },
  { kind: "stay", sub: "펜션", re: /펜션|pension|풀빌라|민박/i },
  { kind: "stay", sub: "호텔", re: /호텔|hotel|레지던스|residence/i },

  // ── 라운지 & 바 ──
  { kind: "bar", sub: "이자카야", detail: "이자카야", re: /이자카야|izakaya|居酒屋/i },
  { kind: "bar", sub: "와인 바", detail: "와인바", re: /와인|wine/i },
  { kind: "bar", sub: "루프탑 라운지", detail: "루프탑", re: /루프탑|rooftop/i },
  { kind: "bar", sub: "펍", detail: "펍", re: /\bpub\b|펍$|맥주|beer|브루|brew|탭하우스/i },
  { kind: "bar", sub: "칵테일 바", detail: "클럽", re: /클럽|\bclub\b/i },
  { kind: "bar", sub: "칵테일 바", re: /칵테일|cocktail|하이볼|\bbar\b|바$|라운지|lounge|위스키|whisky/i },

  // ── 관광지 ──
  { kind: "attraction", sub: "박물관·미술관", re: /박물관|museum|미술관|gallery|갤러리/i },
  { kind: "attraction", sub: "사원·종교시설", re: /사원|temple|신사|shrine|성당|cathedral|교회|church|암자|사$|寺/i },
  { kind: "attraction", sub: "전망대", re: /전망대|타워|tower|observatory|스카이|skytree/i },
  { kind: "attraction", sub: "공원·자연", re: /공원|park|정원|garden|수목원|해수욕장|beach|폭포|falls|동굴|cave|계곡|오름|숲|산$/i },
  { kind: "attraction", sub: "랜드마크", re: /랜드마크|landmark|성$|castle|궁$|palace|유적|거리$|street$/i },

  // ── 쇼핑 ──
  { kind: "shopping", sub: "백화점·몰", re: /백화점|아울렛|outlet|쇼핑몰|\bmall\b|면세점|duty ?free/i },
  { kind: "shopping", sub: "서점", re: /서점|book ?store|책방|츠타야|tsutaya/i },
  { kind: "shopping", sub: "편집숍·패션", re: /편집숍|편집샵|셀렉트|boutique|apparel/i },
  { kind: "shopping", sub: "기념품·특산품", re: /기념품|souvenir|특산품|토산품/i },
  { kind: "shopping", sub: "생활·잡화", re: /잡화|생활용품|드럭|donki|돈키호테|무인양품|muji|로프트|loft/i },

  // ── 체험 ──
  { kind: "experience", sub: "스파·웰니스", re: /스파$|\bspa\b|온천|사우나|찜질방|마사지|massage|온센/i },
  { kind: "experience", sub: "공연·전시", re: /공연|콘서트|극장|theater|전시|exhibition|뮤지컬/i },
  { kind: "experience", sub: "클래스·체험", re: /클래스|공방|체험|원데이|워크샵|workshop|쿠킹/i },
  { kind: "experience", sub: "액티비티", re: /서핑|surf|다이빙|diving|카약|짚라인|승마|스키장|골프/i },

  // ── 레스토랑: 좁은 것부터 ──
  { kind: "restaurant", sub: "카페", detail: "로스터리", re: /로스터|roaster|커피\s?볶/i },
  { kind: "restaurant", sub: "디저트", detail: "베이커리", re: /베이커리|bakery|빵집|제과/i },
  { kind: "restaurant", sub: "디저트", re: /디저트|dessert|케이크|cake|빙수|아이스크림|gelato|젤라또/i },
  { kind: "restaurant", sub: "카페", re: /카페|cafe|café|커피|coffee|喫茶/i },

  { kind: "restaurant", sub: "국수·면요리", detail: "라멘", re: /라멘|ramen|ラーメン|라면/i },
  { kind: "restaurant", sub: "국수·면요리", detail: "우동", re: /우동|udon|うどん/i },
  { kind: "restaurant", sub: "국수·면요리", detail: "소바", re: /소바|soba|そば/i },
  { kind: "restaurant", sub: "국수·면요리", detail: "쌀국수", re: /쌀국수|\bpho\b|포\s?베트남/i },
  { kind: "restaurant", sub: "국수·면요리", detail: "우육면", re: /우육|牛肉麵|beef noodle/i },
  { kind: "restaurant", sub: "국수·면요리", detail: "칼국수", re: /칼국수|손칼국수/i },
  { kind: "restaurant", sub: "국수·면요리", detail: "냉면", re: /냉면|밀면/i },
  { kind: "restaurant", sub: "국수·면요리", re: /국수|면옥|noodle|짬뽕|막국수/i },

  { kind: "restaurant", sub: "한식", detail: "국밥·해장", re: /국밥|해장|순대|설렁탕|곰탕|추어탕|감자탕|해장국|콩나물국|뼈해장|소머리|돼지국/i },
  { kind: "restaurant", sub: "한식", detail: "죽", re: /전복죽|\b죽집|죽전문|본죽/i },
  { kind: "restaurant", sub: "한식", detail: "백반·가정식", re: /백반|가정식|기사식당|한상차림/i },
  { kind: "restaurant", sub: "한식", detail: "오리", re: /오리백숙|훈제오리|오리주물럭|오리구이/i },
  { kind: "restaurant", sub: "한식", detail: "족발·보쌈", re: /족발|보쌈/i },
  { kind: "restaurant", sub: "한식", detail: "곱창·막창", re: /곱창|막창|대창|양곱창/i },
  { kind: "restaurant", sub: "한식", detail: "닭요리", re: /닭갈비|찜닭|삼계탕|치킨|닭한마리|불닭/i },
  { kind: "restaurant", sub: "한식", detail: "분식", re: /분식|떡볶이|김밥|순대국?집?$/i },
  { kind: "restaurant", sub: "한식", detail: "한정식", re: /한정식|한상|반상/i },

  { kind: "restaurant", sub: "고기·구이", detail: "야키니쿠", re: /야키니쿠|yakiniku|焼肉/i },
  { kind: "restaurant", sub: "고기·구이", re: /삼겹|갈비|숯불|불고기|고깃|바비큐|\bbbq\b|스테이크|steak|정육|한우|우대|양갈비|뽈살|식육|돼지|생고기|목살|항정|막창집|축산/i },

  { kind: "restaurant", sub: "스시", detail: "오마카세", re: /오마카세|omakase/i },
  /*
    ⚠️ 「회」 를 넓게 잡으면 **물회·육회가 스시로 간다**(실측: 포항물회 → 스시).
       물회는 해산물, 육회는 고기다. 그래서 앞에 아무 글자나 붙은 「…회」 는
       스시로 보지 않는다 — `횟집` 처럼 분명한 것만 본다.
  */
  { kind: "restaurant", sub: "해산물", detail: "물회", re: /물회/i },
  { kind: "restaurant", sub: "고기·구이", detail: "육회", re: /육회/i },
  { kind: "restaurant", sub: "스시", re: /스시|sushi|寿司|초밥|사시미|횟집|생선회/i },

  { kind: "restaurant", sub: "일식", detail: "야키토리", re: /야키토리|yakitori|焼き鳥|꼬치구이/i },
  { kind: "restaurant", sub: "일식", detail: "돈카츠", re: /돈카츠|돈까스|とんかつ|규카츠|牛カツ|가츠/i },
  { kind: "restaurant", sub: "일식", detail: "덮밥", re: /텐동|천동|규동|가이센동|카이센동|덮밥|丼/i },
  { kind: "restaurant", sub: "일식", detail: "오코노미야키", re: /오코노미야키|타코야키|다코야키|お好み焼/i },
  { kind: "restaurant", sub: "일식", re: /일식|와쇼쿠|샤브샤브|스키야키|すき焼/i },

  { kind: "restaurant", sub: "해산물", re: /해산물|seafood|조개|굴$|대게|킹크랩|랍스터|lobster|전복|해녀|물회|과메기|회센터|수산|활어|아구|복어|장어|멍게|해물/i },
  { kind: "restaurant", sub: "중식", re: /중식|중화|마라|훠궈|딤섬|dim ?sum|양꼬치|짜장|반점$|반점\b|각$|루$|만두/i },
  { kind: "restaurant", sub: "이탈리안", re: /이탈리안|italian|파스타|pasta|피자|pizza|트라토리아/i },
  { kind: "restaurant", sub: "프렌치", re: /프렌치|french|비스트로|bistro|브라세리/i },
  { kind: "restaurant", sub: "브런치", re: /브런치|brunch|모닝|breakfast/i },
  { kind: "restaurant", sub: "양식", re: /버거|burger|스테이크하우스|멕시칸|타코|taco|양식/i },
]

export type NameGuess = {
  kind: WishlistKind
  subCategory: string
  detailCategory?: string
}

/** 이름(+메모)만으로 분류를 시도한다. 모르면 `null` — **지어내지 않는다.** */
export function guessFromName(text: string | null | undefined): NameGuess | null {
  const hay = String(text ?? "").toLowerCase()
  if (!hay.trim()) return null
  for (const r of NAME_RULES) {
    if (r.re.test(hay)) {
      return { kind: r.kind, subCategory: r.sub, detailCategory: r.detail }
    }
  }
  return null
}
