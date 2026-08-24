/**
 * 한글로 쳐도 걸리게 — **검색어 쪽을 늘린다.**
 *
 * ## 왜 이 방향인가 (비용)
 *
 * 저장된 502곳 중 **해외 193곳은 주소에 한글 지역명이 하나도 없다.**
 * 주소가 `일본 〒604-8083 Kyoto, Nakagyo Ward` 라서 "교토" 로 치면 안 걸렸다.
 *
 * 이걸 푸는 방법이 두 가지다.
 *
 *   ① 저장된 502곳을 전부 한글로도 번역해서 넣는다  → 502번 변환 + 계속 늘어남
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
 */

/**
 * 한글 ↔ 원문. 왼쪽이 한글, 오른쪽은 그 말이 데이터에 나타나는 형태들이다.
 *
 * 담는 기준: **우리 데이터에 실제로 있는 나라**(한국 295 · 일본 92 · 베트남 54 ·
 * 태국 11 · 호주 9 · 싱가포르 6 · 홍콩 6) 위주로 도시·구, 그리고 업종어.
 * 여기 없는 건 다음에 신고가 들어올 때 한 줄씩 늘리면 된다 — 공짜다.
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
  // 교토·오사카 안쪽
  나카교: ["nakagyo", "中京"],
  기온: ["gion", "祇園"],
  아라시야마: ["arashiyama", "嵐山"],
  난바: ["namba", "難波"],
  우메다: ["umeda", "梅田"],
  도톤보리: ["dotonbori", "道頓堀"],

  // ── 베트남 ──
  베트남: ["vietnam", "viet nam", "việt nam"],
  호치민: ["ho chi minh", "hồ chí minh", "saigon", "sài gòn"],
  하노이: ["hanoi", "hà nội"],
  다낭: ["da nang", "đà nẵng"],
  호이안: ["hoi an", "hội an"],
  나트랑: ["nha trang"],
  푸꾸옥: ["phu quoc", "phú quốc"],

  // ── 태국 ──
  태국: ["thailand", "thái lan"],
  방콕: ["bangkok", "krung thep"],
  치앙마이: ["chiang mai"],
  푸켓: ["phuket"],

  // ── 그 밖 ──
  싱가포르: ["singapore"],
  홍콩: ["hong kong", "hongkong", "香港"],
  대만: ["taiwan", "台灣", "台湾"],
  타이베이: ["taipei", "台北"],
  시드니: ["sydney"],
  멜버른: ["melbourne"],
  뉴욕: ["new york"],
  로스앤젤레스: ["los angeles"],
  파리: ["paris"],
  베를린: ["berlin"],
  브뤼셀: ["bruxelles", "brussels"],

  // ── 한국(로마자로 저장된 경우 대비) ──
  서울: ["seoul"],
  부산: ["busan", "pusan"],
  제주: ["jeju"],
  포항: ["pohang"],
  경주: ["gyeongju"],
  대구: ["daegu"],
  인천: ["incheon"],
  해운대: ["haeundae"],

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
  바: ["bar"],
  레스토랑: ["restaurant"],
}

/** 한글 → 원문들 */
const TO_FOREIGN = new Map<string, string[]>()
/** 원문 → 한글 */
const TO_KOREAN = new Map<string, string>()
for (const [ko, others] of Object.entries(ALIAS)) {
  TO_FOREIGN.set(ko, others)
  for (const o of others) TO_KOREAN.set(o.toLowerCase(), ko)
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
export function expandQuery(query: string): string[] {
  const q = String(query ?? "").trim().toLowerCase()
  if (!q) return []
  const out = new Set<string>([q])

  for (const [ko, others] of TO_FOREIGN) {
    const k = ko.toLowerCase()
    if (q.includes(k)) for (const o of others) out.add(o.toLowerCase())
  }
  for (const [foreign, ko] of TO_KOREAN) {
    if (q.includes(foreign)) out.add(ko.toLowerCase())
  }
  return [...out]
}

/**
 * 늘린 검색어 중 **하나라도** 걸리면 통과.
 *
 * ⚠️ "모두 걸려야 한다" 로 하면 안 된다. `["교토","kyoto"]` 를 둘 다 요구하면
 *    아무것도 안 나온다 — 한 장소에 두 표기가 같이 있을 리가 없다.
 */
export function matchesQuery(terms: string[], fields: (string | null | undefined)[]): boolean {
  if (terms.length === 0) return true
  const hay = fields
    .map((f) => String(f ?? "").toLowerCase())
    .join(" ")
  return terms.some((t) => hay.includes(t))
}
