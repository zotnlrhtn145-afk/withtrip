/**
 * 지역명 한국어 표기.
 *
 * ⚠️ 구글 역지오코딩은 `language=ko` 를 줘도 **해외 행정구역은 영어로** 돌려준다.
 *    (실측: 오사카 → "Osaka", 호치민 → "Hồ Chí Minh", 방콕 → "Krung Thep Maha Nakhon")
 *    그대로 두면 사용자가 "오사카"를 검색해도 안 나온다 — 검색은 한국어로 들어온다.
 *
 * 그래서 저장할 때 이 표로 한 번 바꿔 준다. 여기 없는 이름은 원문을 그대로 쓴다
 * (틀린 한국어를 지어내는 것보다 낫다).
 *
 * 한국 시·도는 "…특별시/광역시/도" 를 떼서 짧게 보여준다 — 필터 칩에 들어가야 해서.
 */
export const REGION_KO: Record<string, string> = {
  // 일본
  Tokyo: "도쿄",
  Osaka: "오사카",
  Kyoto: "교토",
  Fukuoka: "후쿠오카",
  Kanagawa: "가나가와",
  Yamanashi: "야마나시",
  Hokkaido: "홋카이도",
  Okinawa: "오키나와",
  Aichi: "아이치",
  Hyogo: "효고",
  Nara: "나라",
  Chiba: "지바",
  Saitama: "사이타마",
  // 동남아·중화권
  "Hồ Chí Minh": "호치민",
  "Ho Chi Minh City": "호치민",
  "Hà Nội": "하노이",
  "Đà Nẵng": "다낭",
  "Krung Thep Maha Nakhon": "방콕",
  Bangkok: "방콕",
  "Chiang Mai": "치앙마이",
  Phuket: "푸켓",
  Singapore: "싱가포르",
  "Hong Kong Island": "홍콩섬",
  Kowloon: "구룡",
  "New Territories": "신계",
  Taipei: "타이베이",
  // 미주·유럽·오세아니아
  "New York": "뉴욕",
  Oregon: "오리건",
  California: "캘리포니아",
  Washington: "워싱턴",
  Hawaii: "하와이",
  "New South Wales": "뉴사우스웨일스",
  Victoria: "빅토리아",
  Queensland: "퀸즐랜드",
  Berlin: "베를린",
  Bruxelles: "브뤼셀",
  Brussels: "브뤼셀",
  "Île-de-France": "일드프랑스",
  Bayern: "바이에른",
  Catalunya: "카탈루냐",
  Lazio: "라치오",
  Lombardia: "롬바르디아",
}

/** 한국 시·도는 뒤에 붙는 행정 단위를 떼서 짧게 (필터 칩에 들어간다) */
const KR_SUFFIX = /(특별자치시|특별자치도|특별시|광역시|자치도|자치시|도|시)$/

/**
 * 화면에 보여줄 지역 이름.
 * 해외는 위 표로, 한국은 접미사를 떼서. 모르면 원문 그대로.
 */
export function regionLabel(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim()
  if (!s) return ""
  if (REGION_KO[s]) return REGION_KO[s]
  // 한글이면 접미사만 정리 ("부산광역시" → "부산", "제주특별자치도" → "제주")
  if (/[가-힣]/.test(s)) {
    const short = s.replace(KR_SUFFIX, "")
    return short.length >= 2 ? short : s
  }
  return s
}
