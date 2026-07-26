import type { SearchableOption } from "@/components/searchable-select"

/**
 * 숙소 검색용 프리셋 + 외부 Places API 연동 포인트.
 * 현재는 주요 도시 대표 호텔 목업을 사용하며,
 * `searchHotelsExternal`에서 Kakao/Google Places로 교체할 수 있습니다.
 */
export type HotelPreset = {
  id: string
  name: string
  address: string
  phone: string
  city: string
  country: string
}

export const HOTEL_PRESETS: HotelPreset[] = [
  // Paris
  {
    id: "paris-citadines-st-germain",
    name: "시타딘 생 제르맹 파리",
    address: "53 Ter Quai des Grands Augustins, 75006 Paris, France",
    phone: "+33 1 41 05 79 05",
    city: "파리",
    country: "프랑스",
  },
  {
    id: "paris-hotel-des-grands-boulevards",
    name: "호텔 데 그랑 불바르",
    address: "17 Boulevard Poissonnière, 75002 Paris, France",
    phone: "+33 1 85 73 33 33",
    city: "파리",
    country: "프랑스",
  },
  {
    id: "paris-le-bristol",
    name: "르 브리스톨 파리",
    address: "112 Rue du Faubourg Saint-Honoré, 75008 Paris, France",
    phone: "+33 1 53 43 43 00",
    city: "파리",
    country: "프랑스",
  },
  {
    id: "paris-citizenm-champs",
    name: "시티즌엠 파리 샹젤리제",
    address: "8 Rue de Berri, 75008 Paris, France",
    phone: "+33 1 86 95 08 08",
    city: "파리",
    country: "프랑스",
  },
  // Tokyo
  {
    id: "tokyo-park-hyatt",
    name: "파크 하얏트 도쿄",
    address: "3-7-1-2 Nishi-Shinjuku, Shinjuku City, Tokyo 163-1055, Japan",
    phone: "+81 3-5322-1234",
    city: "도쿄",
    country: "일본",
  },
  {
    id: "tokyo-hotel-gracery-shinjuku",
    name: "호텔 그레이스리 신주쿠",
    address: "1-19-1 Kabukicho, Shinjuku City, Tokyo 160-0021, Japan",
    phone: "+81 3-6833-2489",
    city: "도쿄",
    country: "일본",
  },
  {
    id: "tokyo-mimaru-asakusa",
    name: "미마루 도쿄 아사쿠사",
    address: "2-18-13 Higashi-Asakusa, Taito City, Tokyo 111-0025, Japan",
    phone: "+81 3-5806-2575",
    city: "도쿄",
    country: "일본",
  },
  {
    id: "tokyo-imperial",
    name: "임페리얼 호텔 도쿄",
    address: "1-1-1 Uchisaiwaicho, Chiyoda City, Tokyo 100-8558, Japan",
    phone: "+81 3-3504-1111",
    city: "도쿄",
    country: "일본",
  },
  // Osaka
  {
    id: "osaka-cross-hotel",
    name: "크로스 호텔 오사카",
    address: "2-5-15 Shinsaibashisuji, Chuo Ward, Osaka 542-0085, Japan",
    phone: "+81 6-6213-8281",
    city: "오사카",
    country: "일본",
  },
  {
    id: "osaka-swissotel-nankai",
    name: "스위스오텔 난카이 오사카",
    address: "5-1-60 Namba, Chuo Ward, Osaka 542-0076, Japan",
    phone: "+81 6-6646-1111",
    city: "오사카",
    country: "일본",
  },
  {
    id: "osaka-hotel-elcient",
    name: "호텔 엘시엔트 오사카",
    address: "1-5-25 Nishi-Shinsaibashi, Chuo Ward, Osaka 542-0086, Japan",
    phone: "+81 6-6251-2121",
    city: "오사카",
    country: "일본",
  },
  {
    id: "osaka-the-ritz-carlton",
    name: "리츠칼튼 오사카",
    address: "2-5-25 Umeda, Kita Ward, Osaka 530-0001, Japan",
    phone: "+81 6-6343-7000",
    city: "오사카",
    country: "일본",
  },
  // Seoul
  {
    id: "seoul-signiel",
    name: "시그니엘 서울",
    address: "서울 송파구 올림픽로 300 롯데월드타워",
    phone: "+82 2-3213-1000",
    city: "서울",
    country: "대한민국",
  },
  {
    id: "seoul-josun-palace",
    name: "조선 팰리스 서울 강남",
    address: "서울 강남구 테헤란로 231",
    phone: "+82 2-2222-7000",
    city: "서울",
    country: "대한민국",
  },
  {
    id: "seoul-glad-yeouido",
    name: "글래드 여의도",
    address: "서울 영등포구 의사당대로 16",
    phone: "+82 2-6222-5000",
    city: "서울",
    country: "대한민국",
  },
  {
    id: "seoul-four-seasons",
    name: "포시즌스 호텔 서울",
    address: "서울 종로구 새문안로 97",
    phone: "+82 2-6388-5000",
    city: "서울",
    country: "대한민국",
  },
  // Taipei
  {
    id: "taipei-w-hotel",
    name: "W 타이페이",
    address: "10 Zhongxiao East Road Section 5, Xinyi District, Taipei",
    phone: "+886 2-7703-8888",
    city: "타이베이",
    country: "대만",
  },
  // Bangkok
  {
    id: "bangkok-mandarin-oriental",
    name: "만다린 오리엔탈 방콕",
    address: "48 Oriental Avenue, Bang Rak, Bangkok 10500, Thailand",
    phone: "+66 2 659 9000",
    city: "방콕",
    country: "태국",
  },
  // Danang
  {
    id: "danang-intercontinental",
    name: "인터컨티넨탈 다낭 선 페닌슐라",
    address: "Bai Bac, Son Tra Peninsula, Da Nang 550000, Vietnam",
    phone: "+84 236 393 8888",
    city: "다낭",
    country: "베트남",
  },
]

export function hotelToSearchOption(hotel: HotelPreset): SearchableOption {
  return {
    value: hotel.name,
    label: hotel.name,
    description: `${hotel.city} · ${hotel.address}`,
  }
}

export const HOTEL_SEARCH_OPTIONS: SearchableOption[] = HOTEL_PRESETS.map(hotelToSearchOption)

export function findHotelPresetByName(name: string): HotelPreset | undefined {
  const key = String(name ?? "")
    .trim()
    .toLowerCase()
  if (!key) return undefined
  return HOTEL_PRESETS.find((hotel) => hotel.name.toLowerCase() === key)
}

/** Local mock search — swap body for Kakao Local / Google Places later. */
export async function searchHotelsExternal(query: string): Promise<HotelPreset[]> {
  const q = String(query ?? "")
    .trim()
    .toLowerCase()
  if (!q) return HOTEL_PRESETS

  // TODO: replace with Places API, e.g.
  // const res = await fetch(`/api/places/hotels?q=${encodeURIComponent(q)}`)
  // return (await res.json()) as HotelPreset[]

  return HOTEL_PRESETS.filter((hotel) =>
    [hotel.name, hotel.address, hotel.city, hotel.country, hotel.phone]
      .join(" ")
      .toLowerCase()
      .includes(q)
  )
}
