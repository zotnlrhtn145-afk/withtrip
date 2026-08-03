import {
  type Place,
  type ScheduleDay,
  type ScheduleItem,
  type Trip,
} from '@/lib/trip-data'

export const seedSchedule: Record<string, ScheduleDay[]> = {}

export type FlightEntry = {
  id: string
  /** airlines 레지스트리의 id ('other' = 직접 입력) */
  airlineId: string
  /** 직접 입력한 항공사명 (프리셋 선택 시 빈 문자열) */
  airlineName: string
  /** 편명 예: KE721 */
  flightNo: string
  fromCode: string
  toCode: string
  departDate: string
  departTime: string
  arriveDate: string
  arriveTime: string
}

export type StayEntry = {
  id: string
  name: string
  address: string
  checkInDate: string
  checkInTime: string
  checkOutDate: string
  checkOutTime: string
  phone: string
  memo: string
  /** 숙소 대표 이미지 (히어로 배너에 사용) */
  imageUrl: string
}

export const DEFAULT_STAY_IMAGE = '/images/hotel-osaka-station.png'

export function parseTripDate(value: string) {
  const [year, month, day] = value.split('.').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

/* ── 일정 (Schedule) ──────────────────────────────────────────────── */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export type TripDayMeta = {
  id: string
  label: string
  date: string
  weekday: string
  city: string
}

/** Every day of the trip, using seeded metadata where it exists. */
export function buildTripDays(trip: Trip): TripDayMeta[] {
  const seeded = seedSchedule[trip.id] ?? []
  const start = parseTripDate(trip.startDate)
  const fallbackCity = seeded.at(-1)?.city ?? trip.region

  return Array.from({ length: Math.max(1, trip.days) }, (_, index) => {
    const id = `day${index + 1}`
    const existing = seeded.find((day) => day.id === id)
    if (existing) {
      const { id: dayId, label, date, weekday, city } = existing
      return { id: dayId, label, date, weekday, city }
    }

    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    return {
      id,
      label: `${index + 1}일차`,
      date: `${`${date.getMonth() + 1}`.padStart(2, '0')}.${`${date.getDate()}`.padStart(2, '0')}`,
      weekday: WEEKDAYS[date.getDay()],
      city: fallbackCity,
    }
  })
}

/** tripId → dayId → items */
export const seedScheduleItems: Record<string, Record<string, ScheduleItem[]>> = Object.fromEntries(
  Object.entries(seedSchedule).map(([tripId, days]) => [
    tripId,
    Object.fromEntries(days.map((day) => [day.id, day.items])),
  ])
)

export type ScheduleSlotTemplate = {
  key: string
  time: string
  category: ScheduleItem['category']
  title: string
  action: string
}

/** Structural placeholder slots shown when a day has no schedule yet. */
export const defaultScheduleSlots: ScheduleSlotTemplate[] = [
  {
    key: 'move',
    time: '09:00',
    category: '이동',
    title: '출발 및 이동 일정',
    action: '클릭하여 항공/이동 정보 입력',
  },
  {
    key: 'stay',
    time: '14:00',
    category: '숙소',
    title: '체크인 숙소 정보',
    action: '클릭하여 숙소 정보 입력',
  },
  {
    key: 'sight',
    time: '16:00',
    category: '관광',
    title: '주요 방문 장소',
    action: '클릭하여 관광지/장소 입력',
  },
  {
    key: 'meal',
    time: '18:00',
    category: '식사',
    title: '저녁 식사 장소',
    action: '클릭하여 식당 정보 입력',
  },
]

export const scheduleCategories: ScheduleItem['category'][] = [
  '이동',
  '숙소',
  '관광',
  '식사',
  '카페',
]

export const airportOptions = [
  { code: 'ICN', city: '인천', match: ['korea', 'seoul', '서울', '한국'] },
  { code: 'GMP', city: '김포', match: ['gimpo', '김포'] },
  { code: 'PUS', city: '부산', match: ['busan', '부산'] },
  { code: 'KIX', city: '오사카', match: ['osaka', 'kyoto', '오사카', '교토'] },
  { code: 'NRT', city: '도쿄 나리타', match: ['tokyo', '도쿄'] },
  { code: 'DAD', city: '다낭', match: ['da nang', 'danang', 'hoi an', '다낭', '호이안'] },
  { code: 'TPE', city: '타이베이', match: ['taipei', 'taiwan', '타이베이', '대만'] },
  { code: 'BKK', city: '방콕', match: ['bangkok', '방콕'] },
]

/** Best-guess arrival airport code from a trip's country/city label. */
export function guessArrivalCode(trip: Trip) {
  const haystack = `${trip?.country ?? ""} ${trip?.region ?? ""} ${trip?.title ?? ""}`.toLowerCase()
  const hit = airportOptions.find((option) =>
    option.match.some((keyword) => haystack.includes(String(keyword ?? "").toLowerCase()))
  )
  return hit && hit.code !== "ICN" ? hit.code : "KIX"
}

export const seedFlights: Record<string, FlightEntry[]> = {}

export const seedStays: Record<string, StayEntry[]> = {}

/* ── 가고 싶은 곳 (Wishlist) ───────────────────────────────────────── */

export type WishlistKind = 'restaurant' | 'bar' | 'stay' | 'attraction'

export type WishlistEntry = Place & { kind: WishlistKind }

export const wishlistCategories: {
  kind: WishlistKind
  label: string
  guide: string
}[] = [
  { kind: 'restaurant', label: '레스토랑', guide: 'Restaurant' },
  { kind: 'bar', label: '라운지 & 바', guide: 'Lounge & Bar' },
  { kind: 'stay', label: '숙소', guide: 'Hotel & Stay' },
  { kind: 'attraction', label: '관광지', guide: 'Attraction' },
]

/** Canonical category values stored in `saved_places.category`. */
export const WISHLIST_CATEGORY_VALUE: Record<WishlistKind, string> = {
  restaurant: '레스토랑',
  bar: '라운지 & 바',
  stay: '숙소',
  attraction: '관광지',
}

export function toWishlistKind(category: unknown): WishlistKind {
  const raw = String(category ?? '').trim()
  if (raw === WISHLIST_CATEGORY_VALUE.stay || raw === 'stay' || raw === '숙소') return 'stay'
  if (raw === WISHLIST_CATEGORY_VALUE.bar || raw === 'bar') return 'bar'
  if (raw === WISHLIST_CATEGORY_VALUE.attraction || raw === 'attraction') return 'attraction'
  if (/숙소|hotel|lodging|resort|리조트|료칸|ryokan|stay/i.test(raw)) return 'stay'
  if (/라운지|lounge|\bbar\b|바/i.test(raw)) return 'bar'
  if (/관광|명소|랜드마크|landmark|공원|park|사원|temple|박물관|museum|미술관|gallery|전망대|타워|tower|신사|shrine|성당|cathedral/i.test(raw)) {
    return 'attraction'
  }
  return 'restaurant'
}

export const seedWishlist: Record<string, WishlistEntry[]> = {}

export const wishlistSuggestions: (Omit<Place, 'id' | 'savedBy'> & { kind: WishlistKind })[] = [
  {
    kind: 'restaurant',
    name: 'La Cime',
    nameLocal: 'ラ シーム',
    badge: 'Michelin 3 Stars',
    badgeNote: '2026 가이드 선정',
    address: '3-2-15 Bakuromachi, Chuo-ku, Osaka 541-0059',
    phone: '+81 6-6222-2010',
    category: '모던 프렌치 · 코스',
    priceRange: '¥¥¥¥',
    rating: 4.9,
    reviews: 1562,
    distanceKm: 1.4,
    walkMinutes: 18,
    image: '/images/place-sushi.png',
    imageAlt: '흰 접시에 정교하게 담긴 모던 프렌치 코스 요리',
  },
  {
    kind: 'restaurant',
    name: 'Kigawa',
    nameLocal: '喜川',
    badge: 'Michelin 1 Star',
    badgeNote: '오사카 갓포 요리',
    address: '1-7-7 Dotonbori, Chuo-ku, Osaka 542-0071',
    phone: '+81 6-6211-3030',
    category: '갓포 · 계절 정식',
    priceRange: '¥¥¥',
    rating: 4.6,
    reviews: 507,
    distanceKm: 2.1,
    walkMinutes: 26,
    image: '/images/place-sushi.png',
    imageAlt: '목재 카운터 위에 놓인 일본 갓포 요리 한 상',
  },
  {
    kind: 'bar',
    name: 'Bar Rockfish',
    nameLocal: 'バー ロックフィッシュ',
    badge: "Asia's 50 Best Bars #34",
    badgeNote: '하이볼 성지',
    address: '1-1-20 Higashi-Shinsaibashi, Chuo-ku, Osaka',
    phone: '+81 6-6241-1358',
    category: '하이볼 · 재패니즈 위스키',
    priceRange: '¥¥',
    rating: 4.7,
    reviews: 1103,
    distanceKm: 1.9,
    walkMinutes: 23,
    image: '/images/place-bar.png',
    imageAlt: '차분한 조명 아래 하이볼 잔이 놓인 바 카운터',
  },
  {
    kind: 'bar',
    name: 'Bee Kyoto',
    nameLocal: 'ビー 京都',
    badge: "World's 50 Best Bars #41",
    badgeNote: '교토 카모가와 뷰',
    address: '359 Kiyamachi-dori, Nakagyo-ku, Kyoto 604-8017',
    phone: '+81 75-212-5556',
    category: '시그니처 칵테일 · 강변 뷰',
    priceRange: '¥¥¥',
    rating: 4.5,
    reviews: 386,
    distanceKm: 3.2,
    walkMinutes: 38,
    image: '/images/place-bar.png',
    imageAlt: '강이 보이는 창가에 칵테일이 놓인 교토의 바',
  },
]
