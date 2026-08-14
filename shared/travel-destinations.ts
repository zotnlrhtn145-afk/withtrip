export type TravelCountry = {
  code: string
  nameKo: string
  nameEn: string
  cities: string[]
}

/** Major travel destinations for searchable country / city selects. */
export const travelCountries: TravelCountry[] = [
  {
    code: "KR",
    nameKo: "한국",
    nameEn: "South Korea",
    cities: ["서울", "부산", "제주", "강릉", "경주", "여수", "전주", "인천", "속초", "통영"],
  },
  {
    code: "JP",
    nameKo: "일본",
    nameEn: "Japan",
    cities: ["도쿄", "오사카", "교토", "고베", "후쿠오카", "삿포로", "나고야", "오키나와", "오사카 & 교토", "요코하마", "나라", "하코네"],
  },
  {
    code: "VN",
    nameKo: "베트남",
    nameEn: "Vietnam",
    cities: ["다낭", "호치민", "하노이", "나트랑", "푸꾸옥", "호이안", "달랏"],
  },
  {
    code: "TH",
    nameKo: "태국",
    nameEn: "Thailand",
    cities: ["방콕", "치앙마이", "푸켓", "파타야", "크라비", "끄라비"],
  },
  {
    code: "TW",
    nameKo: "대만",
    nameEn: "Taiwan",
    cities: ["타이베이", "가오슝", "타이중", "지우펀", "화련", "타이난"],
  },
  {
    code: "US",
    nameKo: "미국",
    nameEn: "United States",
    cities: ["뉴욕", "로스앤젤레스", "샌프란시스코", "라스베이거스", "하와이", "시애틀", "보스턴", "시카고", "올랜도"],
  },
  {
    code: "FR",
    nameKo: "프랑스",
    nameEn: "France",
    cities: ["파리", "니스", "리옹", "마르세유", "보르도", "스트라스부르"],
  },
  {
    code: "IT",
    nameKo: "이탈리아",
    nameEn: "Italy",
    cities: ["로마", "밀라노", "피렌체", "베니스", "나폴리", "시칠리아", "친퀘테레"],
  },
  {
    code: "ES",
    nameKo: "스페인",
    nameEn: "Spain",
    cities: ["바르셀로나", "마드리드", "세비야", "발렌시아", "그라나다", "산세바스티안"],
  },
  {
    code: "GB",
    nameKo: "영국",
    nameEn: "United Kingdom",
    cities: ["런던", "에든버러", "맨체스터", "리버풀", "옥스퍼드", "바스"],
  },
  {
    code: "AU",
    nameKo: "호주",
    nameEn: "Australia",
    cities: ["시드니", "멜버른", "브리즈번", "골드코스트", "퍼스", "케언스"],
  },
  {
    code: "SG",
    nameKo: "싱가포르",
    nameEn: "Singapore",
    cities: ["싱가포르"],
  },
  {
    code: "PH",
    nameKo: "필리핀",
    nameEn: "Philippines",
    cities: ["마닐라", "세부", "보라카이", "팔라완", "보홀"],
  },
  {
    code: "ID",
    nameKo: "인도네시아",
    nameEn: "Indonesia",
    cities: ["발리", "자카르타", "요그야카르타", "롬복"],
  },
  {
    code: "CH",
    nameKo: "스위스",
    nameEn: "Switzerland",
    cities: ["취리히", "인터라켄", "제네바", "루체른", "체르마트", "그린델발트"],
  },
{
    code: "HK",
    nameKo: "홍콩",
    nameEn: "Hong Kong",
    cities: ["홍콩"],
  },
  {
    code: "MO",
    nameKo: "마카오",
    nameEn: "Macau",
    cities: ["마카오"],
  },
  {
    code: "CN",
    nameKo: "중국",
    nameEn: "China",
    cities: ["상하이", "베이징", "시안", "청두", "장자제", "칭다오", "구이린"],
  },
  {
    code: "MY",
    nameKo: "말레이시아",
    nameEn: "Malaysia",
    cities: ["쿠알라룸푸르", "코타키나발루", "페낭", "랑카위"],
  },
  {
    code: "KH",
    nameKo: "캄보디아",
    nameEn: "Cambodia",
    cities: ["시엠립", "프놈펜"],
  },
  {
    code: "LA",
    nameKo: "라오스",
    nameEn: "Laos",
    cities: ["루앙프라방", "비엔티안", "방비엥"],
  },
  {
    code: "TR",
    nameKo: "튀르키예",
    nameEn: "Türkiye",
    cities: ["이스탄불", "카파도키아", "안탈리아", "파묵칼레"],
  },
  {
    code: "CZ",
    nameKo: "체코",
    nameEn: "Czechia",
    cities: ["프라하", "체스키크룸로프"],
  },
  {
    code: "DE",
    nameKo: "독일",
    nameEn: "Germany",
    cities: ["베를린", "뮌헨", "프랑크푸르트", "쾰른", "하이델베르크"],
  },
  {
    code: "AT",
    nameKo: "오스트리아",
    nameEn: "Austria",
    cities: ["빈", "잘츠부르크", "할슈타트", "인스브루크"],
  },
  {
    code: "NL",
    nameKo: "네덜란드",
    nameEn: "Netherlands",
    cities: ["암스테르담", "잔담"],
  },
  {
    code: "GR",
    nameKo: "그리스",
    nameEn: "Greece",
    cities: ["아테네", "산토리니", "미코노스"],
  },
  {
    code: "PT",
    nameKo: "포르투갈",
    nameEn: "Portugal",
    cities: ["리스본", "포르투"],
  },
  {
    code: "CA",
    nameKo: "캐나다",
    nameEn: "Canada",
    cities: ["밴쿠버", "토론토", "몬트리올", "밴프"],
  },
  {
    code: "NZ",
    nameKo: "뉴질랜드",
    nameEn: "New Zealand",
    cities: ["오클랜드", "퀸스타운", "크라이스트처치"],
  },
  {
    code: "AE",
    nameKo: "아랍에미리트",
    nameEn: "United Arab Emirates",
    cities: ["두바이", "아부다비"],
  },
  {
    code: "GU",
    nameKo: "괌·사이판",
    nameEn: "Guam",
    cities: ["괌", "사이판"],
  },
  {
    code: "MV",
    nameKo: "몰디브",
    nameEn: "Maldives",
    cities: ["말레"],
  },
]

export function findCountryByName(value?: string | null): TravelCountry | undefined {
  const q = String(value ?? "")
    .trim()
    .toLowerCase()
  if (!q) return undefined
  return travelCountries.find((country) =>
    [country.nameKo, country.nameEn, country.code].some(
      (part) => String(part ?? "").toLowerCase() === q
    )
  )
}

export function filterCountries(query?: string | null): TravelCountry[] {
  const q = String(query ?? "")
    .trim()
    .toLowerCase()
  if (!q) return travelCountries
  return travelCountries.filter((country) =>
    [country.nameKo, country.nameEn, country.code].some((part) =>
      String(part ?? "")
        .toLowerCase()
        .includes(q)
    )
  )
}

export function filterCities(countryName?: string | null, query?: string | null): string[] {
  const country = findCountryByName(countryName)
  const cities = (country?.cities ?? []).filter((city): city is string => Boolean(city))
  const q = String(query ?? "")
    .trim()
    .toLowerCase()
  if (!q) return cities
  return cities.filter((city) => String(city).toLowerCase().includes(q))
}
