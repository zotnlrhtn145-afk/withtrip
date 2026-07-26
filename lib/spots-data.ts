export type NearbySpot = {
  id: string
  name: string
  nameLocal: string
  category: string
  address: string
  lat: number
  lng: number
  rating: number
  image: string
  imageAlt: string
}

/** Fallback “my location” pin (Osaka Umeda). Prefer live GPS via `useGeolocation`. */
export const currentLocation = {
  lat: 34.702485,
  lng: 135.495951,
  label: "현재 위치",
}

/** Registered places with real WGS84 coordinates (Osaka / Kobe area). */
export const nearbySpots: NearbySpot[] = [
  {
    id: "s1",
    name: "Hajime",
    nameLocal: "ハジメ",
    category: "미슐랭 · 프렌치",
    address: "1-9-11 Edobori, Nishi-ku, Osaka",
    lat: 34.69142,
    lng: 135.49028,
    rating: 4.8,
    image: "/images/place-sushi.png",
    imageAlt: "정갈한 스시 한 접시",
  },
  {
    id: "s2",
    name: "Bar Nayuta",
    nameLocal: "バー ナユタ",
    category: "칵테일 바",
    address: "2-3-18 Sonezaki, Kita-ku, Osaka",
    lat: 34.70052,
    lng: 135.50048,
    rating: 4.6,
    image: "/images/place-bar.png",
    imageAlt: "앰버 조명의 칵테일 바",
  },
  {
    id: "s3",
    name: "Koryu",
    nameLocal: "弧柳",
    category: "가이세키",
    address: "1-1-14 Higashi-Shinsaibashi, Chuo-ku, Osaka",
    lat: 34.67198,
    lng: 135.50152,
    rating: 4.7,
    image: "/images/place-sushi.png",
    imageAlt: "가이세키 코스 요리",
  },
  {
    id: "s4",
    name: "The Bar Sazanka",
    nameLocal: "ザ・バー サザンカ",
    category: "루프탑 바",
    address: "5-15 Kitanagasadori, Chuo-ku, Kobe",
    lat: 34.68948,
    lng: 135.19205,
    rating: 4.5,
    image: "/images/place-bar.png",
    imageAlt: "루프탑 바 인테리어",
  },
  {
    id: "s5",
    name: "도톤보리",
    nameLocal: "道頓堀",
    category: "관광 · 먹거리",
    address: "Dotonbori, Chuo-ku, Osaka",
    lat: 34.66869,
    lng: 135.50129,
    rating: 4.4,
    image: "/images/osaka-kyoto-hero.png",
    imageAlt: "도톤보리 거리 야경",
  },
]
