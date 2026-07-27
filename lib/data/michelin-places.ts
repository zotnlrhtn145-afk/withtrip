export type MichelinPlaceKind = "restaurant" | "bar"

export type MichelinPriceRange = "¥" | "¥¥" | "¥¥¥" | "¥¥¥¥"

/** Curated Michelin / lounge metadata for wishlist autofill. */
export type MichelinPlace = {
  id: string
  kind: MichelinPlaceKind
  placeName: string
  localName: string
  subCategory: string
  guideBadge: string
  priceRange: MichelinPriceRange
  address: string
  phoneNumber: string
  rating: number
  image: string
  imageAlt: string
}

export const MICHELIN_PLACES: MichelinPlace[] = [
  {
    id: "la-cime",
    kind: "restaurant",
    placeName: "La Cime",
    localName: "ラシーム",
    subCategory: "모던 프렌치 · 코스",
    guideBadge: "Michelin 3 Stars",
    priceRange: "¥¥¥¥",
    address: "Osaka, Chuo Ward, 3-2-15 Bakuromachi",
    phoneNumber: "+81 6-6222-2010",
    rating: 4.9,
    image: "/images/place-sushi.png",
    imageAlt: "흰 접시에 정교하게 담긴 모던 프렌치 코스",
  },
  {
    id: "kigawa",
    kind: "restaurant",
    placeName: "Kigawa",
    localName: "浪速割烹 喜川",
    subCategory: "갓포 · 계절 정식",
    guideBadge: "Michelin 1 Star",
    priceRange: "¥¥¥",
    address: "Osaka, Chuo Ward, Dotonbori 1-7-7",
    phoneNumber: "+81 6-6211-3030",
    rating: 4.6,
    image: "/images/place-sushi.png",
    imageAlt: "목재 카운터 위의 일본 갓포 요리",
  },
  {
    id: "hajime",
    kind: "restaurant",
    placeName: "Hajime",
    localName: "ハジメ",
    subCategory: "이노베이티브 프렌치 · 코스",
    guideBadge: "Michelin 3 Stars",
    priceRange: "¥¥¥¥",
    address: "Osaka, Nishi Ward, Edobori 1-9-11",
    phoneNumber: "+81 6-6447-6688",
    rating: 4.8,
    image: "/images/place-sushi.png",
    imageAlt: "히노키 카운터 위의 스시 한 접시",
  },
  {
    id: "koryu",
    kind: "restaurant",
    placeName: "Koryu",
    localName: "弧柳",
    subCategory: "가이세키 · 일본 정식",
    guideBadge: "Michelin 2 Stars",
    priceRange: "¥¥¥¥",
    address: "Osaka, Chuo Ward, Higashi-Shinsaibashi 1-1-14",
    phoneNumber: "+81 6-6244-6801",
    rating: 4.7,
    image: "/images/place-sushi.png",
    imageAlt: "따뜻한 조명의 가이세키 코스",
  },
  {
    id: "fujiya-2015",
    kind: "restaurant",
    placeName: "Fujiya 1935",
    localName: "フジヤ一九三五",
    subCategory: "모던 재패니즈 · 코스",
    guideBadge: "Michelin 2 Stars",
    priceRange: "¥¥¥¥",
    address: "Osaka, Chuo Ward, Yariyamachi 2-4-14",
    phoneNumber: "+81 6-6941-2483",
    rating: 4.7,
    image: "/images/place-sushi.png",
    imageAlt: "모던 재패니즈 코스 디시",
  },
  {
    id: "bar-rockfish",
    kind: "bar",
    placeName: "Bar Rockfish",
    localName: "バー ロックフィッシュ",
    subCategory: "하이볼 · 재패니즈 위스키",
    guideBadge: "Asia's 50 Best Bars #34",
    priceRange: "¥¥",
    address: "Osaka, Chuo Ward, Higashi-Shinsaibashi 1-1-20",
    phoneNumber: "+81 6-6241-1358",
    rating: 4.7,
    image: "/images/place-bar.png",
    imageAlt: "하이볼이 놓인 바 카운터",
  },
  {
    id: "bee-kyoto",
    kind: "bar",
    placeName: "Bee Kyoto",
    localName: "ビー 京都",
    subCategory: "시그니처 칵테일 · 강변 뷰",
    guideBadge: "World's 50 Best Bars #41",
    priceRange: "¥¥¥",
    address: "Kyoto, Nakagyo Ward, Kiyamachi-dori 359",
    phoneNumber: "+81 75-212-5556",
    rating: 4.5,
    image: "/images/place-bar.png",
    imageAlt: "카모가와가 보이는 교토 바",
  },
  {
    id: "bar-nayuta",
    kind: "bar",
    placeName: "Bar Nayuta",
    localName: "バー ナユタ",
    subCategory: "시그니처 칵테일 · 재패니즈 위스키",
    guideBadge: "World's 50 Best Bars #12",
    priceRange: "¥¥¥",
    address: "Osaka, Kita Ward, Sonezaki 2-3-18",
    phoneNumber: "+81 6-6360-4310",
    rating: 4.6,
    image: "/images/place-bar.png",
    imageAlt: "앰버 조명의 칵테일 바",
  },
  {
    id: "bar-sazanka",
    kind: "bar",
    placeName: "The Bar Sazanka",
    localName: "ザ・バー サザンカ",
    subCategory: "클래식 칵테일 · 하이볼",
    guideBadge: "Asia's 50 Best Bars #27",
    priceRange: "¥¥¥",
    address: "Kobe, Chuo Ward, Kitanagasadori 5-15",
    phoneNumber: "+81 78-333-2200",
    rating: 4.5,
    image: "/images/place-bar.png",
    imageAlt: "루프탑 바의 클래식 칵테일",
  },
  {
    id: "sg-club",
    kind: "bar",
    placeName: "SG Club",
    localName: "エスジークラブ",
    subCategory: "스피릿 바 · 칵테일",
    guideBadge: "Asia's 50 Best Bars #8",
    priceRange: "¥¥¥",
    address: "Tokyo, Shibuya, Jingumae 1-7-10",
    phoneNumber: "+81 3-6434-0989",
    rating: 4.8,
    image: "/images/place-bar.png",
    imageAlt: "도쿄 스피릿 바의 칵테일",
  },
]

export function searchMichelinPlaces(
  query: string,
  kind?: MichelinPlaceKind | null,
  limit = 6
): MichelinPlace[] {
  const keyword = String(query ?? "").trim().toLowerCase()
  const pool = kind
    ? MICHELIN_PLACES.filter((place) => place.kind === kind)
    : MICHELIN_PLACES

  if (!keyword) return pool.slice(0, Math.min(3, limit))

  return pool
    .filter((place) => {
      const hay = [
        place.placeName,
        place.localName,
        place.subCategory,
        place.guideBadge,
        place.address,
      ]
        .join(" ")
        .toLowerCase()
      return hay.includes(keyword)
    })
    .slice(0, limit)
}

import { resolveCoverImageUrl } from "@/lib/place-cover-image"

export function michelinPlaceToSearchResult(place: MichelinPlace) {
  const imageUrl = resolveCoverImageUrl({
    imageUrl: place.image,
    kind: place.kind,
    subCategory: place.subCategory,
    category: place.kind === "bar" ? "라운지 & 바" : "레스토랑",
  })
  return {
    id: `michelin:${place.id}`,
    source: "michelin" as const,
    kind: place.kind,
    placeName: place.placeName,
    localName: place.localName,
    subCategory: place.subCategory,
    guideBadge: place.guideBadge,
    priceRange: place.priceRange,
    address: place.address,
    phoneNumber: place.phoneNumber,
    rating: place.rating,
    imageUrl,
    image: imageUrl,
    imageAlt: place.imageAlt,
  }
}
