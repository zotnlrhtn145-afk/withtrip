/**
 * 한글로 쳐도, 영어로 쳐도 걸리게 — **검색어 쪽을 늘린다.**
 *
 * ## 왜 이 방향인가 (비용)
 *
 * 저장된 652곳 중 **해외 265곳은 주소에 한글 지역명이 하나도 없다.**
 * 주소가 `일본 〒604-8083 Kyoto, Nakagyo Ward` 라서 "교토" 로 치면 안 걸렸다.
 *
 * 이걸 푸는 방법이 두 가지다.
 *
 *   ① 저장된 652곳을 전부 한글로도 번역해서 넣는다  → 652번 변환 + 계속 늘어남
 *   ② **검색어 하나**를 "교토 → Kyoto" 로 늘려서 둘 다 찾는다  → 1번
 *
 * ②가 압도적으로 싸다. 데이터를 안 건드리고, 장소가 5만 개가 돼도 비용이 그대로다.
 * 새 장소가 들어올 때마다 변환할 필요도 없다.
 *
 * ⚠️ **표시는 바꾸지 않는다.** 화면에는 저장된 그대로 나온다 — 사용자가 원한 건
 *    "한글로 검색하면 나오는 것" 이지 "주소를 한글로 보여 주는 것" 이 아니다.
 *
 * ⚠️ 사전에 없는 말은 **그대로 둔다.** 없는 대응을 지어내면 엉뚱한 게 걸린다.
 *
 * ⚠️ 이 파일은 `~/withtrip/shared/` 가 원본이다.
 *    앱 쪽 `src/lib/shared/` 는 복사본이므로 직접 고치지 말 것.
 *
 * ## 실측으로 확인한 구멍 세 가지 (2026-09)
 *
 *   ① **나라는 한국어로만 저장된다.** `country` 가 "일본"·"미국"·"독일" 이라
 *      `japan` 으로 치면 123건 중 2건만 나왔다. → 나라 표는 `country-flags`·
 *      `travel-destinations` 에서 **자동으로 만든다**(손으로 또 적지 않는다).
 *   ② **글자 위의 점.** 구글이 `Đà Nẵng`·`Hồ Chí Minh`·`Île-de-France` 로 준다.
 *      `da nang` 으로 치면 0건이었다. → 양쪽 다 점을 떼고 비교한다.
 *   ③ **띄어쓰기.** `hochiminh`·`newyork` 이 0건이었다. → 붙여 쓴 꼴로도 본다.
 */

import { FLAGS } from "./country-flags"
import { REGION_KO } from "./region-names"
import { travelCountries } from "./travel-destinations"

/**
 * 글자 위의 점을 뗀다. `Đà Nẵng` → `da nang`, `Île-de-France` → `ile-de-france`.
 *
 * ⚠️ `NFD` 로는 **`Đ`(획이 그어진 D)가 안 풀린다.** 결합 문자가 아니라 그 자체로
 *    다른 글자이기 때문이다. 베트남 지명 대부분이 여기 걸려서 따로 적어 둔다.
 */
const STROKED: Record<string, string> = {
  đ: "d", ð: "d", ø: "o", ł: "l", ß: "ss", æ: "ae", œ: "oe", þ: "th", ı: "i", ħ: "h",
}

export function foldText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    /*
      ⚠️ **다시 합쳐야 한다.** `NFD` 는 한글 음절도 자모로 쪼갠다("괌" → ㄱㅘㅁ).
         그대로 두면 글자 수를 세는 곳이 전부 어긋난다(한 글자가 셋으로 잡힌다).
    */
    .normalize("NFC")
    .replace(/[đðøłßæœþıħ]/g, (c) => STROKED[c] ?? c)
}

/**
 * 띄어쓰기·붙임표를 없앤 꼴. `ho chi minh` → `hochiminh`.
 *
 * ⚠️ `\p{L}` 같은 유니코드 속성은 **헤르메스(앱 엔진)에서 못 믿는다.** 우리가 쓰는
 *    글자 범위(라틴·한글·가나·한자)를 직접 적는다.
 */
const KEEP = /[^0-9a-z぀-ヿ一-鿿가-힣]+/g

function compact(value: string | null | undefined): string {
  return foldText(value).replace(KEEP, "")
}

/** 한글·가나·한자가 하나라도 있으면 「띄어쓰기가 없는 말」로 본다 */
const CJK = /[぀-ヿ一-鿿가-힣]/

/**
 * 한 낱말로 들어 있나. `kyoto station` 안의 `kyoto` 는 통과,
 * `house` 안의 `us` 는 **통과하지 못한다**.
 *
 * ⚠️ 그냥 `includes` 로 두면 `us`(미국) 가 `house`·`museum` 에 걸리고,
 *    `bar` 가 `barcelona` 에 걸린다. 로마자는 낱말 경계를 본다.
 */
/** 낱말이 **이 글자로 시작하나.** "la" 는 "Lavender" 를 잡고 "Villa" 는 놓친다 */
function startsWord(hay: string, needle: string): boolean {
  if (!needle) return false
  let at = hay.indexOf(needle)
  while (at !== -1) {
    if (at === 0 || !/[0-9a-z]/.test(hay[at - 1])) return true
    at = hay.indexOf(needle, at + 1)
  }
  return false
}

function hasWord(hay: string, needle: string): boolean {
  if (!needle) return false
  let at = hay.indexOf(needle)
  while (at !== -1) {
    const before = at === 0 ? "" : hay[at - 1]
    const after = hay[at + needle.length] ?? ""
    const edge = (c: string) => c === "" || !/[0-9a-z]/.test(c)
    if (edge(before) && edge(after)) return true
    at = hay.indexOf(needle, at + 1)
  }
  return false
}

/**
 * 같은 곳을 가리키는 말끼리 한 묶음. 하나가 걸리면 나머지도 같이 찾는다.
 *
 * 손으로 적는 건 **도시·구·업종어뿐**이다. 나라와 시·도는 이미 다른 파일에
 * 있으므로 거기서 만든다 — 두 군데에 적으면 조용히 어긋난다.
 */
const ALIAS: Record<string, string[]> = {
  // ── 일본 도시·지역 ──
  도쿄: ["tokyo", "東京"],
  오사카: ["osaka", "大阪"],
  교토: ["kyoto", "京都"],
  후쿠오카: ["fukuoka", "福岡"],
  삿포로: ["sapporo", "札幌"],
  나고야: ["nagoya", "名古屋"],
  요코하마: ["yokohama", "横浜"],
  고베: ["kobe", "神戸"],
  나라: ["nara", "奈良"],
  오키나와: ["okinawa", "沖縄"],
  가나가와: ["kanagawa", "神奈川"],
  홋카이도: ["hokkaido", "北海道"],
  치바: ["chiba", "千葉"],
  하코네: ["hakone", "箱根"],
  가마쿠라: ["kamakura", "鎌倉"],
  // 도쿄 안쪽
  시부야: ["shibuya", "渋谷"],
  신주쿠: ["shinjuku", "新宿"],
  긴자: ["ginza", "銀座"],
  아사쿠사: ["asakusa", "浅草"],
  우에노: ["ueno", "上野"],
  하라주쿠: ["harajuku", "原宿"],
  롯폰기: ["roppongi", "六本木"],
  아키하바라: ["akihabara", "秋葉原"],
  이케부쿠로: ["ikebukuro", "池袋"],
  나카메구로: ["nakameguro", "中目黒"],
  다이토: ["taito", "台東"],
  스미다: ["sumida", "墨田"],
  미나토: ["minato", "港"],
  세타가야: ["setagaya", "世田谷"],
  메구로: ["meguro", "目黒"],
  지요다: ["chiyoda", "千代田"],
  주오: ["chuo", "中央"],
  // 교토·오사카 안쪽
  나카교: ["nakagyo", "中京"],
  기온: ["gion", "祇園"],
  아라시야마: ["arashiyama", "嵐山"],
  히가시야마: ["higashiyama", "東山"],
  난바: ["namba", "難波"],
  우메다: ["umeda", "梅田"],
  도톤보리: ["dotonbori", "道頓堀"],
  신사이바시: ["shinsaibashi", "心斎橋"],

  // ── 베트남 ──
  호치민: ["ho chi minh", "hồ chí minh", "saigon", "sài gòn", "사이공"],
  하노이: ["hanoi", "hà nội"],
  다낭: ["da nang", "đà nẵng"],
  호이안: ["hoi an", "hội an"],
  나트랑: ["nha trang"],
  푸꾸옥: ["phu quoc", "phú quốc"],
  달랏: ["da lat", "đà lạt"],
  붕따우: ["vung tau", "vũng tàu"],

  // ── 태국 ──
  방콕: ["bangkok", "krung thep", "krung thep maha nakhon"],
  치앙마이: ["chiang mai"],
  푸켓: ["phuket"],
  파타야: ["pattaya"],
  끄라비: ["krabi", "크라비"],

  // ── 중화권 ──
  타이베이: ["taipei", "台北"],
  가오슝: ["kaohsiung", "高雄"],
  지우펀: ["jiufen", "九份"],
  상하이: ["shanghai", "上海"],
  베이징: ["beijing", "peking", "北京"],
  구룡: ["kowloon", "九龍"],
  센트럴: ["central", "中環"],
  침사추이: ["tsim sha tsui", "尖沙咀"],
  마카오: ["macau", "macao", "澳門"],

  // ── 그 밖 도시 ──
  시드니: ["sydney"],
  멜버른: ["melbourne"],
  브리즈번: ["brisbane"],
  /*
    ⚠️ 줄인 말은 **딱 그것만 쳤을 때** 통한다 — `inQuery` 가 두 글자 로마자를
       그렇게 다룬다. 안 그러면 "la" 가 "La Vie" 에, "ny" 가 "many" 에 걸린다.
  */
  뉴욕: ["new york", "ny", "엔와이", "뉴욕주", "뉴욕시"],
  로스앤젤레스: ["los angeles", "la", "엘에이", "엘아이", "로스엔젤레스", "로스앤젤리스"],
  샌프란시스코: ["san francisco", "sf", "샌프란", "에스에프"],
  라스베이거스: ["las vegas", "vegas", "라스베가스", "베가스"],
  시애틀: ["seattle"],
  하와이: ["hawaii", "honolulu"],
  호놀룰루: ["honolulu"],
  워싱턴: ["washington", "dc", "워싱턴디시"],
  캘리포니아: ["california", "ca", "캘리"],
  오리건: ["oregon", "오리곤"],
  플로리다: ["florida"],
  텍사스: ["texas"],
  네바다: ["nevada"],
  파리: ["paris"],
  런던: ["london"],
  로마: ["rome", "roma"],
  밀라노: ["milan", "milano"],
  피렌체: ["florence", "firenze"],
  베네치아: ["venice", "venezia", "베니스"],
  바르셀로나: ["barcelona"],
  마드리드: ["madrid"],
  베를린: ["berlin"],
  뮌헨: ["munich", "münchen"],
  프랑크푸르트: ["frankfurt"],
  브뤼셀: ["bruxelles", "brussels", "brussel"],
  암스테르담: ["amsterdam"],
  프라하: ["prague", "praha"],
  빈: ["vienna", "wien"],
  취리히: ["zurich", "zürich"],
  인터라켄: ["interlaken"],
  이스탄불: ["istanbul"],
  두바이: ["dubai"],
  세부: ["cebu"],
  보라카이: ["boracay"],
  발리: ["bali"],
  쿠알라룸푸르: ["kuala lumpur"],
  괌: ["guam"],
  사이판: ["saipan"],
  밴쿠버: ["vancouver"],
  토론토: ["toronto"],
  오클랜드: ["auckland"],

  // ── 한국(로마자로 저장된 경우 대비) ──
  서울: ["seoul"],
  부산: ["busan", "pusan"],
  제주: ["jeju", "cheju"],
  포항: ["pohang"],
  경주: ["gyeongju"],
  대구: ["daegu"],
  인천: ["incheon"],
  강릉: ["gangneung"],
  속초: ["sokcho"],
  전주: ["jeonju"],
  여수: ["yeosu"],
  통영: ["tongyeong"],
  해운대: ["haeundae"],
  광안리: ["gwangalli"],
  서귀포: ["seogwipo"],

  // ── 업종·음식 ──
  카페: ["cafe", "coffee", "커피", "喫茶"],
  베이커리: ["bakery", "빵집"],
  라멘: ["ramen", "ラーメン"],
  우동: ["udon", "うどん"],
  소바: ["soba", "そば"],
  스시: ["sushi", "寿司", "초밥"],
  이자카야: ["izakaya", "居酒屋"],
  야키토리: ["yakitori", "焼き鳥", "꼬치"],
  야키니쿠: ["yakiniku", "焼肉", "고기"],
  돈카츠: ["tonkatsu", "とんかつ", "돈까스"],
  호텔: ["hotel"],
  리조트: ["resort"],
  레스토랑: ["restaurant"],
}

/**
 * 나라 이름 — 두 표에 흩어져 있는 걸 **코드로 묶는다.**
 *
 * `country-flags` 는 "대한민국"·"오스트레일리아", `travel-destinations` 는
 * "한국"·"호주" 로 적어 두었다. 둘 다 맞는 말이라 어느 쪽으로 쳐도 나와야 한다.
 * 코드가 같으면 한 묶음이므로 저절로 해결된다.
 */
const COUNTRY_EXTRA: Record<string, string[]> = {
  KR: ["korea", "south korea", "republic of korea", "코리아"],
  JP: ["japan", "nippon", "日本", "재팬"],
  US: ["usa", "us", "united states", "united states of america", "america", "아메리카", "유에스에이", "유에스"],
  GB: ["uk", "england", "britain", "great britain", "잉글랜드", "브리튼", "유케이"],
  CN: ["china", "prc", "中国", "차이나"],
  HK: ["hong kong", "hongkong", "香港", "홍콩섬"],
  TW: ["taiwan", "台灣", "台湾", "타이완"],
  VN: ["vietnam", "viet nam", "việt nam", "비엣남", "베트남"],
  TH: ["thailand", "thai", "타일랜드"],
  DE: ["germany", "deutschland", "도이칠란트", "저머니"],
  BE: ["belgium", "belgique", "belgië", "벨기움"],
  AU: ["australia", "오스트랄리아"],
  NL: ["netherlands", "holland", "홀란드", "네덜란트"],
  CH: ["switzerland", "schweiz", "suisse", "스윗잘랜드"],
  TR: ["turkiye", "turkey", "터키", "튀르키예"],
  CZ: ["czechia", "czech republic", "체코"],
  AE: ["uae", "united arab emirates", "에미리트"],
  MO: ["macau", "macao", "마카오"],
  SG: ["싱가폴"], // 사람들이 이렇게 더 많이 친다
  IT: ["이태리"],
  ES: ["에스파냐"],
  PH: ["필리핀", "필리핀즈"],
  ID: ["인도네시아"],
  MY: ["말레이시아", "말레이"],
  CA: ["캐나다"],
  NZ: ["뉴질랜드"],
  GR: ["그리스"],
  PT: ["포르투갈"],
  AT: ["오스트리아", "외스터라이히"],
  KH: ["캄보디아"],
  LA: ["라오스"],
  MV: ["몰디브"],
  GU: ["괌", "사이판"],
}

function buildGroups(): string[][] {
  const groups: string[][] = []

  // ① 나라 — 코드로 묶는다
  const byCode = new Map<string, Set<string>>()
  const put = (code: string, ...names: (string | undefined)[]) => {
    const set = byCode.get(code) ?? new Set<string>()
    for (const n of names) if (n) set.add(n)
    byCode.set(code, set)
  }
  for (const [code, flag] of Object.entries(FLAGS)) put(code, flag.name)
  for (const c of travelCountries) put(c.code, c.nameKo, c.nameEn)
  for (const [code, names] of Object.entries(COUNTRY_EXTRA)) put(code, ...names)
  for (const set of byCode.values()) if (set.size > 1) groups.push([...set])

  // ② 시·도 — 구글이 주는 원문과 우리가 보여 주는 한국어
  for (const [원문, 한국어] of Object.entries(REGION_KO)) {
    if (원문 !== 한국어) groups.push([원문, 한국어])
  }

  // ③ 손으로 적은 도시·구·업종어
  for (const [ko, others] of Object.entries(ALIAS)) groups.push([ko, ...others])

  return groups
}

/** [{말, 접힌 꼴, 붙인 꼴, 한중일인가}] 를 미리 만들어 둔다 — 글자 칠 때마다 다시 만들지 않는다 */
const GROUPS = buildGroups().map((names) =>
  names.map((raw) => ({
    fold: foldText(raw),
    tight: compact(raw),
    cjk: CJK.test(raw),
  })),
)

/** 이 말이 검색어 안에 들어 있나 */
function inQuery(q: string, qTight: string, m: { fold: string; tight: string; cjk: boolean }): boolean {
  /*
    짧은 말은 **딱 그것만 쳤을 때**만 인정한다.
    "la"(엘에이)가 "La Vie" 에, "빈"(비엔나)이 "빈티지" 에 걸리면 안 된다.
    줄인 말을 아예 안 넣는 것보다는 이쪽이 낫다 — 사람들은 "LA" 라고 친다.
  */
  const short = m.cjk ? m.fold.length < 2 : m.fold.length < 3
  if (short) return q === m.fold || (qTight.length > 0 && qTight === m.tight)

  if (m.cjk) return q.includes(m.fold)
  return hasWord(q, m.fold) || (m.tight.length >= 3 && hasWord(qTight, m.tight))
}

/**
 * 검색어를 늘린다. `"교토"` → `["교토", "kyoto", "京都"]`
 *
 * ⚠️ 부분 일치도 본다. "교토역" 으로 쳐도 "교토" 를 찾아 `kyoto` 를 얹는다 —
 *    사람들은 도시 이름만 딱 치지 않는다.
 *
 * ⚠️ 늘린 말은 **원래 검색어를 대체하지 않고 더한다.** 어느 쪽으로 저장돼 있든
 *    걸리게 하려는 것이지, 검색어를 바꾸려는 게 아니다.
 */
/**
 * ⚠️ **맨 앞이 사용자가 친 말이다.** `matchesQuery` 가 그걸로 느슨함을 가른다 —
 *    친 말은 글자 그대로 찾고(치는 중에도 걸려야 한다), 우리가 늘린 말은
 *    낱말째로 찾는다("america" 가 "Americano" 에 걸리면 안 된다).
 */
export function expandQuery(query: string): string[] {
  return expand(query, false)
}

/**
 * `wholeNameOnly` 는 **여러 낱말을 친 경우**에만 쓴다.
 *
 * ⚠️ "제주 카페" 를 그냥 늘리면 `제주`·`카페` 가 따로 걸려서 「제주 전부 + 카페 전부」
 *    207건이 나온다. 통째로 보는 쪽에서는 **여러 낱말짜리 이름**(ho chi minh,
 *    hong kong)만 인정하고, 한 낱말짜리는 낱말별 걸기에 맡긴다.
 */
function expand(query: string, wholeNameOnly: boolean): string[] {
  const q = foldText(query).trim()
  if (!q) return []
  const qTight = compact(query)
  const out = new Set<string>([q])

  for (const group of GROUPS) {
    const hit = group.find((m) => inQuery(q, qTight, m))
    if (!hit) continue
    if (wholeNameOnly && !hit.fold.includes(" ") && hit.fold !== q) continue
    for (const m of group) out.add(m.fold)
  }
  return [...out]
}

/**
 * 늘린 검색어 중 **하나라도** 걸리면 통과.
 *
 * ⚠️ "모두 걸려야 한다" 로 하면 안 된다. `["교토","kyoto"]` 를 둘 다 요구하면
 *    아무것도 안 나온다 — 한 장소에 두 표기가 같이 있을 리가 없다.
 *
 * ⚠️ 저장된 쪽도 **점을 떼고** 본다. `Đà Nẵng` 을 `da nang` 으로 찾을 수 있어야 한다.
 *
 * ⚠️ 늘린 말은 **낱말째로** 본다. 그냥 포함으로 두면 "미국" 이 늘어난 `america` 가
 *    카페 이름 "Americano" 에 걸린다(실측 3건). 사용자가 친 말만 글자 그대로 본다 —
 *    "toky" 까지 쳤을 때도 도쿄가 나와야 하기 때문이다.
 */
export function matchesQuery(terms: string[], fields: (string | null | undefined)[]): boolean {
  if (terms.length === 0) return true
  return hitTerms(makeHay(fields), terms)
}

type Hay = { text: string; tight: string; jamo: string }

function makeHay(fields: (string | null | undefined)[]): Hay {
  const text = fields.map((f) => foldText(f)).join(" ")
  return { text, tight: text.replace(KEEP, ""), jamo: text.normalize("NFD") }
}

function hitTerms({ text: hay, tight, jamo }: Hay, terms: string[]): boolean {
  return terms.some((t, i) => {
    const packed = t.replace(KEEP, "")
    /*
      사용자가 친 말 — 치는 중에도 걸려야 하니 글자 그대로.
      ⚠️ 한글은 **자모로 쪼개서** 본다. 「부산」을 치는 도중의 「부사」가 걸려야 하고,
         「회」로 「횟집」이 나와야 한다(받침만 다르다). 완성된 글자로만 보면 둘 다 0건이다.
    */
    if (i === 0) {
      /*
        ⚠️ 로마자 한두 글자는 **낱말 첫머리**로만 본다. 그냥 포함으로 두면
           "LA" 가 "Villa"·"Gelato" 까지 물어 와 36건이 됐다.
      */
      if (t.length < 3 && !CJK.test(t)) return startsWord(hay, t)
      return (
        hay.includes(t) ||
        jamo.includes(t.normalize("NFD")) ||
        (packed.length >= 2 && tight.includes(packed))
      )
    }
    // 우리가 늘린 말 — 한글·한자는 붙여 쓰니 그대로, 로마자는 낱말째로
    if (CJK.test(t)) return hay.includes(t)
    /*
      ⚠️ 늘어난 줄임말로는 **찾지 않는다.** "엘에이" 를 늘리면 `la` 가 따라오는데,
         그걸로 찾으면 "La Vie" 가 걸린다. 같은 묶음의 `los angeles` 가 할 일이다.
    */
    if (t.length < 3) return false
    if (hasWord(hay, t)) return true
    /*
      두 낱말짜리는 **저장된 쪽이 붙여 쓴 경우**도 본다("NewYork Bakery").
      한 낱말짜리(`america`)는 이 길을 막는다 — 그게 "Americano" 를 물어 온다.
    */
    return t.includes(" ") && packed.length >= 6 && tight.includes(packed)
  })
}

/**
 * 여러 낱말을 친 검색어. `expandQuery` 한 번으로는 못 푼다.
 *
 * ⚠️ **낱말마다 따로 늘려서 「모두 걸려야 한다」로 두면 안 된다.**
 *    "ho chi minh" 이 `ho` + `chi` + `minh` 으로 쪼개져 아무것도 안 나온다.
 * ⚠️ **통째로만 보면 그것도 안 된다.**
 *    "제주 카페" 가 한 이름인 곳은 없으니 0건이 된다.
 *
 * 그래서 **둘 다** 본다 — 통째로 걸리거나(한 이름), 낱말이 모두 걸리거나(좁히기).
 * 실측: 예전엔 "제주 카페" 가 207건(제주 전부 + 카페 전부)이었다.
 */
export type SearchQuery = {
  /** 통째로 친 말을 늘린 것 */
  phrase: string[]
  /** 낱말별로 늘린 것 — 둘 이상일 때만 채운다 */
  words: string[][]
}

export function buildQuery(search: string): SearchQuery | null {
  const parts = foldText(search).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return { phrase: expand(search, false), words: [] }
  return { phrase: expand(search, true), words: parts.map((w) => expand(w, false)) }
}

export function matchesSearch(q: SearchQuery | null, fields: (string | null | undefined)[]): boolean {
  if (!q) return true
  const hay = makeHay(fields)
  if (hitTerms(hay, q.phrase)) return true
  return q.words.length > 1 && q.words.every((w) => hitTerms(hay, w))
}
