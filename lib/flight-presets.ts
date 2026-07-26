import { airlines as baseAirlines } from "@/lib/airlines"
import type { SearchableOption } from "@/components/searchable-select"

/** 검색형 항공사 프리셋 (한글명 = value) */
export const AIRLINE_PRESETS: SearchableOption[] = [
  ...baseAirlines
    .filter((airline) => airline.id !== "other")
    .map((airline) => ({
      value: airline.name,
      label: airline.name,
      description: `${airline.nameEn} · ${airline.code}`,
    })),
  { value: "에어부산", label: "에어부산", description: "Air Busan · BX" },
  { value: "에어서울", label: "에어서울", description: "Air Seoul · RS" },
  { value: "에어프레미아", label: "에어프레미아", description: "Air Premia · YP" },
  { value: "싱가포르항공", label: "싱가포르항공", description: "Singapore Airlines · SQ" },
  { value: "캐세이퍼시픽", label: "캐세이퍼시픽", description: "Cathay Pacific · CX" },
  { value: "델타항공", label: "델타항공", description: "Delta Air Lines · DL" },
  { value: "에미레이트항공", label: "에미레이트항공", description: "Emirates · EK" },
  { value: "일본항공", label: "일본항공", description: "Japan Airlines · JL" },
  { value: "전일본공수", label: "전일본공수", description: "ANA · NH" },
  { value: "베트남항공", label: "베트남항공", description: "Vietnam Airlines · VN" },
  { value: "타이항공", label: "타이항공", description: "Thai Airways · TG" },
  { value: "유나이티드항공", label: "유나이티드항공", description: "United Airlines · UA" },
  { value: "루프트한자", label: "루프트한자", description: "Lufthansa · LH" },
  { value: "에어프랑스", label: "에어프랑스", description: "Air France · AF" },
]

export type AirportPreset = {
  code: string
  nameKo: string
  nameEn: string
  city: string
}

/** 검색형 공항 프리셋 (코드 + 한글/영문 검색) */
export const AIRPORT_PRESETS: AirportPreset[] = [
  { code: "ICN", nameKo: "인천국제공항", nameEn: "Incheon International", city: "인천" },
  { code: "GMP", nameKo: "김포국제공항", nameEn: "Gimpo International", city: "김포" },
  { code: "PUS", nameKo: "김해국제공항", nameEn: "Gimhae International", city: "부산" },
  { code: "CJU", nameKo: "제주국제공항", nameEn: "Jeju International", city: "제주" },
  { code: "KIX", nameKo: "간사이국제공항", nameEn: "Kansai International", city: "오사카" },
  { code: "NRT", nameKo: "나리타국제공항", nameEn: "Narita International", city: "도쿄" },
  { code: "HND", nameKo: "하네다국제공항", nameEn: "Haneda Airport", city: "도쿄" },
  { code: "FUK", nameKo: "후쿠오카공항", nameEn: "Fukuoka Airport", city: "후쿠오카" },
  { code: "CTS", nameKo: "신치토세공항", nameEn: "New Chitose Airport", city: "삿포로" },
  { code: "OKA", nameKo: "나하공항", nameEn: "Naha Airport", city: "오키나와" },
  { code: "DAD", nameKo: "다낭국제공항", nameEn: "Da Nang International", city: "다낭" },
  { code: "SGN", nameKo: "탄손넛국제공항", nameEn: "Tan Son Nhat", city: "호치민" },
  { code: "HAN", nameKo: "노이바이국제공항", nameEn: "Noi Bai International", city: "하노이" },
  { code: "TPE", nameKo: "대만 타오위안국제공항", nameEn: "Taiwan Taoyuan", city: "타이베이" },
  { code: "BKK", nameKo: "방콕 수완나품국제공항", nameEn: "Suvarnabhumi", city: "방콕" },
  { code: "DMK", nameKo: "돈므앙국제공항", nameEn: "Don Mueang", city: "방콕" },
  { code: "SIN", nameKo: "창이국제공항", nameEn: "Changi Airport", city: "싱가포르" },
  { code: "HKG", nameKo: "홍콩국제공항", nameEn: "Hong Kong International", city: "홍콩" },
  { code: "LAX", nameKo: "로스앤젤레스국제공항", nameEn: "Los Angeles International", city: "로스앤젤레스" },
  { code: "JFK", nameKo: "존 F. 케네디국제공항", nameEn: "John F. Kennedy", city: "뉴욕" },
  { code: "SFO", nameKo: "샌프란시스코국제공항", nameEn: "San Francisco International", city: "샌프란시스코" },
  { code: "CDG", nameKo: "샤를 드골공항", nameEn: "Charles de Gaulle", city: "파리" },
  { code: "LHR", nameKo: "히드로공항", nameEn: "Heathrow Airport", city: "런던" },
  { code: "DXB", nameKo: "두바이국제공항", nameEn: "Dubai International", city: "두바이" },
  { code: "SYD", nameKo: "시드니킹스포드스미스공항", nameEn: "Sydney Airport", city: "시드니" },
]

export const AIRPORT_OPTIONS: SearchableOption[] = AIRPORT_PRESETS.map((airport) => ({
  value: airport.code,
  label: `${airport.code} · ${airport.nameKo}`,
  description: `${airport.city} · ${airport.nameEn}`,
}))
