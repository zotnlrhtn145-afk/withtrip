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
    cities: ["서울", "부산", "제주", "강릉", "경주", "여수", "전주", "인천"],
  },
  {
    code: "JP",
    nameKo: "일본",
    nameEn: "Japan",
    cities: ["도쿄", "오사카", "교토", "후쿠오카", "삿포로", "나고야", "오키나와", "오사카 & 교토"],
  },
  {
    code: "VN",
    nameKo: "베트남",
    nameEn: "Vietnam",
    cities: ["다낭", "호치민", "하노이", "나트랑", "푸꾸옥", "호이안"],
  },
  {
    code: "TH",
    nameKo: "태국",
    nameEn: "Thailand",
    cities: ["방콕", "치앙마이", "푸켓", "파타야", "크라비"],
  },
  {
    code: "TW",
    nameKo: "대만",
    nameEn: "Taiwan",
    cities: ["타이베이", "가오슝", "타이중", "지우펀", "화련"],
  },
  {
    code: "US",
    nameKo: "미국",
    nameEn: "United States",
    cities: ["뉴욕", "로스앤젤레스", "샌프란시스코", "라스베이거스", "하와이", "시애틀"],
  },
  {
    code: "FR",
    nameKo: "프랑스",
    nameEn: "France",
    cities: ["파리", "니스", "리옹", "마르세유", "보르도"],
  },
  {
    code: "IT",
    nameKo: "이탈리아",
    nameEn: "Italy",
    cities: ["로마", "밀라노", "피렌체", "베니스", "나폴리"],
  },
  {
    code: "ES",
    nameKo: "스페인",
    nameEn: "Spain",
    cities: ["바르셀로나", "마드리드", "세비야", "발렌시아"],
  },
  {
    code: "GB",
    nameKo: "영국",
    nameEn: "United Kingdom",
    cities: ["런던", "에든버러", "맨체스터", "리버풀"],
  },
  {
    code: "AU",
    nameKo: "호주",
    nameEn: "Australia",
    cities: ["시드니", "멜버른", "브리즈번", "골드코스트"],
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
    cities: ["마닐라", "세부", "보라카이", "팔라완"],
  },
  {
    code: "ID",
    nameKo: "인도네시아",
    nameEn: "Indonesia",
    cities: ["발리", "자카르타", "요그야카르타"],
  },
  {
    code: "CH",
    nameKo: "스위스",
    nameEn: "Switzerland",
    cities: ["취리히", "인터라켄", "제네바", "루체른"],
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
