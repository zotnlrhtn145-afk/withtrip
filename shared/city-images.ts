/**
 * All-weather cinematic trip cover mapper.
 * Fallback hierarchy:
 *  1) Curated popular-city library (instant, verified)
 *  2) Dynamic world mapping via EN keywords → stable cinematic Unsplash IDs
 *  3) Plane-window sunset safety net (never a broken grey box)
 */

const QUALITY = "auto=format&fit=crop&w=1600&q=85"
const U = (id: string) => `https://images.unsplash.com/${id}?${QUALITY}`

/** Stage 3 — airplane window sunset */
export const FALLBACK_TRIP_COVER = U("photo-1436491865332-7a61a109cc05")

/** Ensure every Unsplash URL carries cinematic quality params. */
export function withUnsplashQuality(url: string): string {
  const raw = String(url ?? "").trim()
  if (!raw) return FALLBACK_TRIP_COVER
  try {
    const parsed = new URL(raw)
    if (!parsed.hostname.includes("unsplash.com")) return raw
    parsed.searchParams.set("auto", "format")
    parsed.searchParams.set("fit", "crop")
    parsed.searchParams.set("w", "1600")
    parsed.searchParams.set("q", "85")
    return parsed.toString()
  } catch {
    return FALLBACK_TRIP_COVER
  }
}

// ─── Korean / alias → English keyword maps ───────────────────────────────────

const CITY_KO_TO_EN: Record<string, string> = {
  // Korea
  서울: "seoul",
  부산: "busan",
  제주: "jeju",
  제주도: "jeju",
  강릉: "gangneung",
  경주: "gyeongju",
  여수: "yeosu",
  전주: "jeonju",
  인천: "incheon",
  // Japan
  도쿄: "tokyo",
  동경: "tokyo",
  오사카: "osaka",
  교토: "kyoto",
  후쿠오카: "fukuoka",
  삿포로: "sapporo",
  나고야: "nagoya",
  오키나와: "okinawa",
  // Vietnam / SE Asia
  다낭: "da nang",
  호치민: "ho chi minh",
  하노이: "hanoi",
  나트랑: "nha trang",
  푸꾸옥: "phu quoc",
  호이안: "hoi an",
  방콕: "bangkok",
  치앙마이: "chiang mai",
  체앙마이: "chiang mai", // common typo
  푸켓: "phuket",
  파타야: "pattaya",
  크라비: "krabi",
  발리: "bali",
  자카르타: "jakarta",
  싱가포르: "singapore",
  신가포르: "singapore", // common typo
  마닐라: "manila",
  세부: "cebu",
  보라카이: "boracay",
  팔라완: "palawan",
  // Taiwan
  타이베이: "taipei",
  가오슝: "kaohsiung",
  타이중: "taichung",
  지우펀: "jiufen",
  화련: "hualien",
  // Europe
  파리: "paris",
  니스: "nice",
  리옹: "lyon",
  런던: "london",
  로마: "rome",
  밀라노: "milan",
  피렌체: "florence",
  베니스: "venice",
  나폴리: "naples",
  바르셀로나: "barcelona",
  마드리드: "madrid",
  세비야: "seville",
  취리히: "zurich",
  인터라켄: "interlaken",
  제네바: "geneva",
  루체른: "lucerne",
  암스테르담: "amsterdam",
  베를린: "berlin",
  프라하: "prague",
  부다페스트: "budapest",
  비엔나: "vienna",
  빈: "vienna",
  아테네: "athens",
  리스본: "lisbon",
  이스탄불: "istanbul",
  // Americas / Oceania
  뉴욕: "new york",
  로스앤젤레스: "los angeles",
  샌프란시스코: "san francisco",
  라스베이거스: "las vegas",
  하와이: "hawaii",
  시애틀: "seattle",
  시드니: "sydney",
  멜버른: "melbourne",
  브리즈번: "brisbane",
  // LatAm / special
  우유니: "uyuni",
  쿠스코: "cusco",
  마추픽추: "machu picchu",
  리우데자네이루: "rio de janeiro",
  부에노스아이레스: "buenos aires",
  칸쿤: "cancun",
  // Middle East / Africa / others
  두바이: "dubai",
  카이로: "cairo",
  케이프타운: "cape town",
  마라케시: "marrakech",
  카트만두: "kathmandu",
  몰디브: "maldives",
  산토리니: "santorini",
}

const COUNTRY_KO_TO_EN: Record<string, string> = {
  한국: "south korea",
  대한민국: "south korea",
  일본: "japan",
  베트남: "vietnam",
  태국: "thailand",
  대만: "taiwan",
  미국: "united states",
  프랑스: "france",
  이탈리아: "italy",
  스페인: "spain",
  영국: "united kingdom",
  호주: "australia",
  싱가포르: "singapore",
  신가포르: "singapore",
  필리핀: "philippines",
  인도네시아: "indonesia",
  스위스: "switzerland",
  중국: "china",
  홍콩: "hong kong",
  마카오: "macau",
  독일: "germany",
  네덜란드: "netherlands",
  체코: "czech republic",
  헝가리: "hungary",
  오스트리아: "austria",
  그리스: "greece",
  포르투갈: "portugal",
  터키: "turkey",
  튀르키예: "turkey",
  볼리비아: "bolivia",
  페루: "peru",
  브라질: "brazil",
  아르헨티나: "argentina",
  멕시코: "mexico",
  아랍에미리트: "united arab emirates",
  아랍에미리트연합: "united arab emirates",
  이집트: "egypt",
  남아공: "south africa",
  남아프리카공화국: "south africa",
  모로코: "morocco",
  네팔: "nepal",
  몰디브: "maldives",
  인도: "india",
  캐나다: "canada",
  뉴질랜드: "new zealand",
}

/** Common misspellings / aliases → canonical English city. */
const CITY_ALIASES: Record<string, string> = {
  // 고베 — 목적지 목록에 추가하면서 같이 넣었다(영문 키가 있어야 저장 경로가 깔끔하다)
  고베: "kobe",
  체앙마이: "chiang mai",
  "chiangmai": "chiang mai",
  신가포르: "singapore",
  "da-nang": "da nang",
  danang: "da nang",
  "ho chi minh city": "ho chi minh",
  saigon: "ho chi minh",
  nyc: "new york",
  "newyork": "new york",
  la: "los angeles",
  sf: "san francisco",
  "uyuni salt flat": "uyuni",
  "saliar de uyuni": "uyuni",
}

// ─── Stage 1: curated cinematic library ──────────────────────────────────────

export const CITY_IMAGES: Record<string, string> = {
  jeju: U("photo-1507525428034-b723cf961d3e"),
  제주: U("photo-1507525428034-b723cf961d3e"),
  seoul: U("photo-1538485399081-7191377e8241"),
  서울: U("photo-1538485399081-7191377e8241"),
  busan: U("photo-1534258936925-c58bed479fcb"),
  부산: U("photo-1534258936925-c58bed479fcb"),
  tokyo: U("photo-1540959733332-eab4deabeeaf"),
  도쿄: U("photo-1540959733332-eab4deabeeaf"),
  osaka: U("photo-1590559899731-a382839e5549"),
  오사카: U("photo-1590559899731-a382839e5549"),
  kyoto: U("photo-1493976040374-85c8e12f0c0e"),
  교토: U("photo-1493976040374-85c8e12f0c0e"),
  taipei: U("photo-1470004914212-05527e49370b"),
  타이베이: U("photo-1470004914212-05527e49370b"),
  "da nang": U("photo-1559592413-7cec4d0cae2b"),
  danang: U("photo-1559592413-7cec4d0cae2b"),
  다낭: U("photo-1559592413-7cec4d0cae2b"),
  paris: U("photo-1502602898657-3e91760cbb34"),
  파리: U("photo-1502602898657-3e91760cbb34"),
  "new york": U("photo-1496442226666-8d4d0e62e6e9"),
  nyc: U("photo-1496442226666-8d4d0e62e6e9"),
  뉴욕: U("photo-1496442226666-8d4d0e62e6e9"),
  london: U("photo-1513635269975-59663e0ac1ad"),
  런던: U("photo-1513635269975-59663e0ac1ad"),
  rome: U("photo-1552832230-c0197dd311b5"),
  로마: U("photo-1552832230-c0197dd311b5"),
  barcelona: U("photo-1583422409516-2895a77efded"),
  바르셀로나: U("photo-1583422409516-2895a77efded"),
  bali: U("photo-1537996194471-e657df975ab4"),
  발리: U("photo-1537996194471-e657df975ab4"),
  singapore: U("photo-1525625293386-3f8f99389edd"),
  싱가포르: U("photo-1525625293386-3f8f99389edd"),
  bangkok: U("photo-1563492065599-3520f775eeed"),
  방콕: U("photo-1563492065599-3520f775eeed"),
  sydney: U("photo-1506973035872-a4ec16b8e8d9"),
  시드니: U("photo-1506973035872-a4ec16b8e8d9"),
  hanoi: U("photo-1528127269322-539801943592"),
  하노이: U("photo-1528127269322-539801943592"),
  "chiang mai": U("photo-1528183429752-a97d0bf99b5a"),
  치앙마이: U("photo-1528183429752-a97d0bf99b5a"),
  phuket: U("photo-1589394815804-964ed0be2eb5"),
  푸켓: U("photo-1589394815804-964ed0be2eb5"),
  florence: U("photo-1523906834658-6e24ef2386f9"),
  피렌체: U("photo-1523906834658-6e24ef2386f9"),
  venice: U("photo-1523906834658-6e24ef2386f9"),
  베니스: U("photo-1523906834658-6e24ef2386f9"),
  fukuoka: U("photo-1545569341-9eb8b30979d9"),
  후쿠오카: U("photo-1545569341-9eb8b30979d9"),
  okinawa: U("photo-1542051841857-5f90071e7989"),
  오키나와: U("photo-1542051841857-5f90071e7989"),
}

/**
 * Explicit, real landmark names for AI cover generation. Image models
 * hallucinate wildly when asked to infer "the most iconic spot" themselves —
 * naming the exact landmark keeps the result geographically accurate.
 * Only cities we're confident about are listed; unknown cities skip AI
 * generation entirely rather than risk a wrong or bizarre image.
 */
export const ICONIC_LANDMARKS: Record<string, string> = {
  jeju: "Seongsan Ilchulbong (Sunrise Peak) volcanic tuff cone",
  seoul: "Gyeongbokgung Palace with Bukhansan mountains behind it",
  busan: "Haeundae Beach and the Gwangan Bridge skyline at night",
  gyeongju: "Bulguksa Temple's stone stairways and pagodas",
  jeonju: "the traditional hanok rooftops of Jeonju Hanok Village",
  tokyo: "Tokyo Tower rising above the Shibuya/Roppongi skyline",
  osaka: "Osaka Castle surrounded by its moat and stone walls",
  kyoto: "the endless vermillion torii gates of Fushimi Inari Shrine",
  fukuoka: "Fukuoka Tower on the Momochi seaside",
  sapporo: "the Sapporo TV Tower over Odori Park in snow",
  okinawa: "Shurijo Castle's red gate above the turquoise Okinawan coast",
  "da nang": "the Dragon Bridge over the Han River at night",
  "ho chi minh": "the Bitexco Financial Tower skyline of Ho Chi Minh City",
  hanoi: "Hoan Kiem Lake's red Huc Bridge and turtle tower",
  bangkok: "Wat Arun (Temple of Dawn) on the Chao Phraya River",
  "chiang mai": "the golden chedi of Wat Phra That Doi Suthep",
  phuket: "the limestone karsts of Phi Phi Islands",
  bali: "the sea temple of Tanah Lot at sunset",
  singapore: "the Marina Bay Sands skyline with Gardens by the Bay's Supertrees",
  taipei: "Taipei 101 skyscraper piercing the clouds",
  paris: "the Eiffel Tower over the Seine river",
  nice: "the turquoise Baie des Anges coastline of Nice",
  london: "Big Ben and the Houses of Parliament beside Tower Bridge",
  rome: "the ancient Colosseum",
  florence: "the Duomo's dome over Florence's terracotta rooftops",
  venice: "gondolas gliding through a Venetian canal at sunset",
  barcelona: "Gaudi's Sagrada Familia basilica",
  madrid: "the Royal Palace of Madrid",
  zurich: "the Swiss Alps reflected in Lake Zurich",
  interlaken: "the snow-capped Jungfrau peak above a turquoise alpine lake",
  amsterdam: "canal houses lining an Amsterdam canal at dusk",
  berlin: "the Brandenburg Gate",
  prague: "Charles Bridge over the Vltava River with Prague Castle behind it",
  budapest: "the Hungarian Parliament Building on the Danube at night",
  vienna: "Schönbrunn Palace's grand facade and gardens",
  athens: "the Parthenon atop the Acropolis at golden hour",
  lisbon: "the yellow tram climbing Lisbon's tiled hillside streets",
  istanbul: "the Hagia Sophia and Blue Mosque skyline over the Bosphorus",
  santorini: "Santorini's white-and-blue clifftop villages over the caldera",
  "new york": "the Statue of Liberty with the Manhattan skyline",
  "los angeles": "the Hollywood Sign on a hillside at sunset",
  "san francisco": "the Golden Gate Bridge in fog",
  "las vegas": "the neon-lit Las Vegas Strip at night",
  seattle: "the Space Needle over the Seattle skyline",
  sydney: "the Sydney Opera House beside the Harbour Bridge",
  melbourne: "Melbourne's laneway street art and city skyline",
  uyuni: "the mirror-like reflections of the Salar de Uyuni salt flats",
  cusco: "the Inca stone terraces of Machu Picchu",
  "rio de janeiro": "the Christ the Redeemer statue over Rio's coastline",
  "buenos aires": "the colorful houses of Caminito in La Boca",
  cancun: "the turquoise Caribbean beaches of Cancun",
  dubai: "the Burj Khalifa towering over the Dubai skyline",
  cairo: "the Pyramids of Giza and the Sphinx",
  "cape town": "Table Mountain overlooking Cape Town's coastline",
  marrakech: "the maze of stalls and minarets in Marrakech's medina",
  kathmandu: "the prayer flags and stupa of Boudhanath",
  maldives: "overwater bungalows on a turquoise Maldivian lagoon",
}

export const COUNTRY_IMAGES: Record<string, string> = {
  "south korea": CITY_IMAGES.seoul,
  korea: CITY_IMAGES.seoul,
  한국: CITY_IMAGES.seoul,
  japan: CITY_IMAGES.tokyo,
  일본: CITY_IMAGES.tokyo,
  vietnam: CITY_IMAGES["da nang"],
  베트남: CITY_IMAGES["다낭"],
  thailand: CITY_IMAGES.bangkok,
  태국: CITY_IMAGES.bangkok,
  taiwan: CITY_IMAGES.taipei,
  대만: CITY_IMAGES.taipei,
  france: CITY_IMAGES.paris,
  프랑스: CITY_IMAGES.paris,
  "united kingdom": CITY_IMAGES.london,
  uk: CITY_IMAGES.london,
  영국: CITY_IMAGES.london,
  italy: CITY_IMAGES.rome,
  이탈리아: CITY_IMAGES.rome,
  spain: CITY_IMAGES.barcelona,
  스페인: CITY_IMAGES.barcelona,
  "united states": CITY_IMAGES["new york"],
  usa: CITY_IMAGES["new york"],
  미국: CITY_IMAGES["new york"],
  indonesia: CITY_IMAGES.bali,
  인도네시아: CITY_IMAGES.bali,
  singapore: CITY_IMAGES.singapore,
  싱가포르: CITY_IMAGES.singapore,
  australia: CITY_IMAGES.sydney,
  호주: CITY_IMAGES.sydney,
}

/**
 * Verified cinematic Unsplash IDs for Stage 2 (world coverage).
 * source.unsplash.com is discontinued — we map EN keywords to real CDN photo IDs
 * so unknown cities never render a grey broken box.
 */
const WORLD_CINEMATIC_POOL = [
  "photo-1506905925346-21bda4d32df4", // alpine mist
  "photo-1476514525535-07fb3b4ae5f1", // lake travel
  "photo-1469854523086-cc02fe5d8800", // road trip canyon
  "photo-1488085061387-422e29b40080", // airplane wing sky
  "photo-1507525428034-b723cf961d3e", // golden beach
  "photo-1519681393784-d120267933ba", // mountain night stars
  "photo-1470071459604-3b5ec3a7fe05", // foggy hills
  "photo-1441974231531-c6227db76b6e", // forest light
  "photo-1500530855697-b586d89ba3ee", // desert dunes
  "photo-1464822759023-fed622ff2c3b", // dramatic peak
  "photo-1439066615861-d1af74d74000", // lake blue hour
  "photo-1501785888041-af3ef285b470", // lake mountains
  "photo-1472214103451-9374bd1c798e", // green hills
  "photo-1514565131-fce0801e5785", // city night lights
  "photo-1449824913935-59a10b8d2000", // city dusk
  "photo-1477959858617-67f85cf4f1df", // skyline blue hour
  "photo-1493976040374-85c8e12f0c0e", // traditional lantern street
  "photo-1545569341-9eb8b30979d9", // mystic shrine mist
  "photo-1523906834658-6e24ef2386f9", // european old town
  "photo-1552832230-c0197dd311b5", // colosseum
  "photo-1502602898657-3e91760cbb34", // eiffel blue hour
  "photo-1513635269975-59663e0ac1ad", // london
  "photo-1496442226666-8d4d0e62e6e9", // nyc
  "photo-1525625293386-3f8f99389edd", // singapore
  "photo-1537996194471-e657df975ab4", // bali temple
  "photo-1540959733332-eab4deabeeaf", // tokyo night
  "photo-1590559899731-a382839e5549", // osaka canal night
  "photo-1506973035872-a4ec16b8e8d9", // sydney
  "photo-1513407030348-c983a97b98d8", // night city glow
  "photo-1480796927426-f609979314bd", // japan alley night
  "photo-1503899036084-c55cdd92da26", // tokyo streets night
  "photo-1528164344705-47542687000d", // japan garden
  "photo-1542051841857-5f90071e7989", // okinawa coast
  "photo-1559592413-7cec4d0cae2b", // vietnam coast
  "photo-1563492065599-3520f775eeed", // bangkok temple
  "photo-1589394815804-964ed0be2eb5", // phuket coast
  "photo-1470004914212-05527e49370b", // taipei
  "photo-1538485399081-7191377e8241", // seoul sunset
  "photo-1469474968028-56623f02e42e", // nature sun rays
  "photo-1447752875215-b2761acb3c5d", // forest path
  "photo-1436491865332-7a61a109cc05", // plane window
] as const

/** Mood-biased pools for better Stage-2 matches (salt flats, beach, city…). */
const MOOD_POOLS: { test: RegExp; ids: string[] }[] = [
  {
    test: /uyuni|salt|desert|dune|sahara|bolivia|morocco|marrakech/,
    ids: [
      "photo-1500530855697-b586d89ba3ee",
      "photo-1469854523086-cc02fe5d8800",
      "photo-1506905925346-21bda4d32df4",
    ],
  },
  {
    test: /beach|island|maldives|hawaii|phuket|boracay|okinawa|bali|santorini|cancun/,
    ids: [
      "photo-1507525428034-b723cf961d3e",
      "photo-1542051841857-5f90071e7989",
      "photo-1589394815804-964ed0be2eb5",
      "photo-1537996194471-e657df975ab4",
    ],
  },
  {
    test: /mountain|alps|interlaken|nepal|himalaya|swiss|patagonia/,
    ids: [
      "photo-1464822759023-fed622ff2c3b",
      "photo-1519681393784-d120267933ba",
      "photo-1506905925346-21bda4d32df4",
      "photo-1470071459604-3b5ec3a7fe05",
    ],
  },
  {
    test: /city|capital|york|london|paris|tokyo|seoul|dubai|istanbul|berlin/,
    ids: [
      "photo-1477959858617-67f85cf4f1df",
      "photo-1449824913935-59a10b8d2000",
      "photo-1513407030348-c983a97b98d8",
      "photo-1514565131-fce0801e5785",
    ],
  },
]

// ─── Normalization & KR → EN ─────────────────────────────────────────────────

export function normalizeSearchKeyword(text: string): string {
  return String(text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[·•|/\\,_]+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function lookupMap(haystack: string, map: Record<string, string>): string | null {
  const keys = Object.keys(map).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    const nk = normalizeSearchKeyword(key)
    if (!nk) continue
    if (haystack === nk || haystack.includes(nk)) return map[key] ?? null
  }
  return null
}

/** Strip noise and keep the core destination token. */
export function extractCoreCityName(raw?: string | null): string {
  let text = normalizeSearchKeyword(raw ?? "")
  if (!text) return ""

  text = text
    .replace(
      /\b(여행|관광|투어|자유여행|패키지|핫플|추천|trip|travel|tour|vacation|holiday)\b/gi,
      " "
    )
    .replace(/\b(시|군|구|도|특별시|광역시|특별자치도|특별자치시)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  // Prefer the first meaningful chunk (e.g. "파리 센강" → "파리")
  const first = text.split(" ").filter(Boolean)[0] ?? text
  return first.length >= 2 ? first : text
}

export type DestinationKeywords = {
  cityEn: string
  countryEn: string
  query: string
}

/** Parse Korean/English country + city into English search keywords. */
export function toEnglishKeywords(input: {
  city?: string | null
  country?: string | null
  location?: string | null
  title?: string | null
}): DestinationKeywords {
  const cityCore = extractCoreCityName(input.city)
  const countryCore = extractCoreCityName(input.country)
  const locationNorm = normalizeSearchKeyword(input.location ?? "")
  const titleNorm = normalizeSearchKeyword(input.title ?? "")

  const cityFromAlias =
    lookupMap(cityCore, CITY_ALIASES) ??
    lookupMap(locationNorm, CITY_ALIASES) ??
    lookupMap(titleNorm, CITY_ALIASES)

  const cityEn =
    cityFromAlias ??
    lookupMap(cityCore, CITY_KO_TO_EN) ??
    lookupMap(locationNorm, CITY_KO_TO_EN) ??
    lookupMap(titleNorm, CITY_KO_TO_EN) ??
    // already English / unknown romanization — keep cleaned token
    (cityCore && !/[\uac00-\ud7a3]/.test(cityCore) ? cityCore : "")

  const countryEn =
    lookupMap(countryCore, COUNTRY_KO_TO_EN) ??
    lookupMap(locationNorm, COUNTRY_KO_TO_EN) ??
    lookupMap(titleNorm, COUNTRY_KO_TO_EN) ??
    (countryCore && !/[\uac00-\ud7a3]/.test(countryCore) ? countryCore : "")

  const query = [cityEn, countryEn].filter(Boolean).join(" ").trim()
  return { cityEn, countryEn, query }
}

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function pickFromPool(seed: string, pool: readonly string[]): string {
  if (pool.length === 0) return FALLBACK_TRIP_COVER
  const id = pool[hashString(seed) % pool.length]
  return U(id)
}

/**
 * Stage 2 — dynamic world cover.
 * Builds a stable, high-quality Unsplash CDN URL from English keywords.
 * (Unsplash Source `source.unsplash.com` was discontinued; CDN photo IDs never 404.)
 */
export function buildDynamicCityCoverUrl(englishQuery: string): string {
  const q = normalizeSearchKeyword(englishQuery)
  if (!q) return FALLBACK_TRIP_COVER

  for (const mood of MOOD_POOLS) {
    if (mood.test.test(q)) {
      return pickFromPool(q, mood.ids)
    }
  }
  return pickFromPool(q, WORLD_CINEMATIC_POOL)
}

/**
 * Legacy-style Unsplash Source URL (documentation / optional clients).
 * Prefer {@link buildDynamicCityCoverUrl} for production — Source is deprecated.
 */
export function buildUnsplashSourceSearchUrl(englishCityName: string): string {
  const token = encodeURIComponent(
    `${normalizeSearchKeyword(englishCityName) || "travel"},landmark,travel,cinematic`
  )
  return `https://source.unsplash.com/featured/1600x900/?${token}`
}

function matchCurated(haystack: string, dict: Record<string, string>): string | null {
  const keys = Object.keys(dict).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    const nk = normalizeSearchKeyword(key)
    if (nk && haystack.includes(nk)) return dict[key] ?? null
  }
  return null
}

export type GetCityImageInput = {
  city?: string | null
  country?: string | null
  location?: string | null
  title?: string | null
}

/**
 * Resolve the best cinematic cover URL (sync, never throws, never empty).
 */
export function getCityImage(input: GetCityImageInput): string {
  const { cityEn, countryEn, query } = toEnglishKeywords(input)
  const cityHay = normalizeSearchKeyword(input.city ?? "")
  const countryHay = normalizeSearchKeyword(input.country ?? "")
  const locationHay = normalizeSearchKeyword(input.location ?? "")
  const titleHay = normalizeSearchKeyword(input.title ?? "")
  const fullHay = [cityHay, countryHay, locationHay, titleHay, cityEn, countryEn]
    .filter(Boolean)
    .join(" ")

  // ── Stage 1: curated popular cities ──
  if (cityHay) {
    const hit = matchCurated(cityHay, CITY_IMAGES)
    if (hit) return withUnsplashQuality(hit)
  }
  if (cityEn) {
    const hit = matchCurated(cityEn, CITY_IMAGES)
    if (hit) return withUnsplashQuality(hit)
  }
  const cityFromContext = matchCurated([locationHay, titleHay].join(" "), CITY_IMAGES)
  if (cityFromContext) return withUnsplashQuality(cityFromContext)

  // Country curated (only when no city hit)
  if (countryHay) {
    const hit = matchCurated(countryHay, COUNTRY_IMAGES) ?? matchCurated(countryHay, CITY_IMAGES)
    if (hit) return withUnsplashQuality(hit)
  }
  if (countryEn) {
    const hit = matchCurated(countryEn, COUNTRY_IMAGES)
    if (hit) return withUnsplashQuality(hit)
  }

  // ── Stage 2: dynamic world mapping ──
  if (query) {
    return withUnsplashQuality(buildDynamicCityCoverUrl(query))
  }
  if (fullHay) {
    return withUnsplashQuality(buildDynamicCityCoverUrl(fullHay))
  }

  // ── Stage 3: safety net ──
  return FALLBACK_TRIP_COVER
}

/**
 * Look up a named, real landmark for AI cover generation. Only returns a
 * result for cities in {@link ICONIC_LANDMARKS} — unknown destinations
 * return null so callers skip AI generation instead of risking a
 * geographically wrong or hallucinated image.
 */
export function getIconicLandmark(input: GetCityImageInput): {
  destination: string
  landmark: string
} | null {
  const { cityEn, countryEn } = toEnglishKeywords(input)
  const cityHay = normalizeSearchKeyword(input.city ?? "")
  const locationHay = normalizeSearchKeyword(input.location ?? "")
  const titleHay = normalizeSearchKeyword(input.title ?? "")

  const key =
    (cityEn && ICONIC_LANDMARKS[cityEn] ? cityEn : null) ??
    (cityHay ? Object.keys(ICONIC_LANDMARKS).find((k) => cityHay.includes(k)) : null) ??
    [locationHay, titleHay]
      .filter(Boolean)
      .map((hay) => Object.keys(ICONIC_LANDMARKS).find((k) => hay.includes(k)))
      .find(Boolean) ??
    null

  if (!key) return null
  const landmark = ICONIC_LANDMARKS[key]
  if (!landmark) return null

  return { destination: countryEn ? `${key}, ${countryEn}` : key, landmark }
}

/** @deprecated Alias — use getCityImage */
export const resolveTripCoverImage = getCityImage
