import type { TripGroupMember } from "@/lib/trip-group"

export type Member = {
  id: string
  name: string
  initials: string
  color: string
}

export type ScheduleItem = {
  id: string
  time: string
  place: string
  activity: string
  category: '이동' | '식사' | '관광' | '숙소' | '카페'
}

export type ScheduleDay = {
  id: string
  label: string
  date: string
  weekday: string
  city: string
  items: ScheduleItem[]
}

export type Place = {
  id: string
  name: string
  nameLocal: string
  badge: string
  badgeNote: string
  address: string
  phone: string
  category: string
  priceRange: string
  rating: number
  reviews: number
  distanceKm: number
  walkMinutes: number
  image: string
  imageAlt: string
  savedBy: string[]
}

export type Trip = {
  id: string
  title: string
  /** Share/invite code stored on `trips.invite_code`. */
  inviteCode?: string
  country: string
  region: string
  startDate: string
  endDate: string
  nights: number
  days: number
  dDay: number
  heroImage: string
  heroImageAlt: string
  weather: string
  weatherIcon: 'sun' | 'cloud-sun' | 'rain'
  flight: string
  memberIds: string[]
  readiness: number
  /** Live group members from `trip_members` (+ profiles). */
  groupMembers?: TripGroupMember[]
  /** Optional settlement completion flags from API/UI. */
  isCompleted?: boolean
  isSettled?: boolean
  settledAt?: string | null
  settlementStatus?: 'open' | 'SETTLED' | 'COMPLETED'
  status?: string
}

export const trips: Trip[] = [
  {
    id: 'osaka-kyoto',
    title: '오사카 · 교토 여행',
    country: 'Japan',
    region: 'Osaka & Kyoto',
    startDate: '2026.08.27',
    endDate: '2026.09.02',
    nights: 6,
    days: 7,
    dDay: 33,
    heroImage: '/images/osaka-kyoto-hero.png',
    heroImageAlt: '골든 아워의 교토 전통 목조 거리와 멀리 보이는 오층탑',
    weather: '맑음 31°C',
    weatherIcon: 'sun',
    flight: 'ICN 09:20 → KIX 11:15',
    memberIds: ['m1', 'm2', 'm3', 'm4'],
    readiness: 68,
  },
  {
    id: 'danang',
    title: '다낭 워케이션',
    country: 'Vietnam',
    region: 'Da Nang & Hoi An',
    startDate: '2026.11.14',
    endDate: '2026.11.21',
    nights: 7,
    days: 8,
    dDay: 112,
    heroImage: '/images/trip-danang.png',
    heroImageAlt: '야자수가 늘어선 다낭 해변과 에메랄드빛 바다',
    weather: '구름 조금 29°C',
    weatherIcon: 'cloud-sun',
    flight: 'ICN 19:40 → DAD 22:50',
    memberIds: ['m1', 'm3'],
    readiness: 24,
  },
  {
    id: 'taipei',
    title: '타이베이 미식투어',
    country: 'Taiwan',
    region: 'Taipei & Jiufen',
    startDate: '2027.01.02',
    endDate: '2027.01.06',
    nights: 4,
    days: 5,
    dDay: 161,
    heroImage: '/images/trip-taipei.png',
    heroImageAlt: '타이베이 101 타워와 등불이 켜진 야시장 거리',
    weather: '흐림 18°C',
    weatherIcon: 'rain',
    flight: 'ICN 08:05 → TPE 09:55',
    memberIds: ['m2', 'm3', 'm4'],
    readiness: 12,
  },
]

export const members: Member[] = [
  { id: 'm1', name: '지훈', initials: 'JH', color: 'bg-primary text-primary-foreground' },
  { id: 'm2', name: '민서', initials: 'MS', color: 'bg-chart-2 text-background' },
  { id: 'm3', name: '수아', initials: 'SA', color: 'bg-foreground text-background' },
  { id: 'm4', name: '현우', initials: 'HW', color: 'bg-secondary text-secondary-foreground' },
]

export function getTripMembers(tripItem: Trip, pool: Member[] = members): Member[] {
  if (tripItem.groupMembers && tripItem.groupMembers.length > 0) {
    return tripItem.groupMembers.map((member) => ({
      id: member.id,
      name: member.name,
      initials: member.initials,
      color: member.color,
    }))
  }
  return tripItem.memberIds
    .map((id) => pool.find((member) => member.id === id))
    .filter((member): member is Member => Boolean(member))
}

export const memberPalette = [
  'bg-primary text-primary-foreground',
  'bg-chart-2 text-background',
  'bg-foreground text-background',
  'bg-secondary text-secondary-foreground',
]

export const hotel = {
  name: 'The Osaka Station Hotel',
  nameLocal: 'ザ オオサカ ステーションホテル',
  address: '3-1-1 Umeda, Kita-ku, Osaka 530-0001, Japan',
  phone: '+81 6-6347-1111',
  checkIn: '08.27 (목) 15:00',
  checkOut: '09.02 (수) 11:00',
  room: '디럭스 트윈 · 2박 / 슈페리어 킹 · 4박',
}

export const scheduleDays: ScheduleDay[] = [
  {
    id: 'day1',
    label: '1일차',
    date: '08.27',
    weekday: '목',
    city: '오사카',
    items: [
      { id: 'd1-1', time: '09:20', place: '인천국제공항 T2', activity: 'KIX행 탑승 · 게이트 231', category: '이동' },
      { id: 'd1-2', time: '11:15', place: '간사이 국제공항', activity: '입국 심사 후 하루카 특급 탑승', category: '이동' },
      { id: 'd1-3', time: '13:30', place: 'The Osaka Station Hotel', activity: '캐리어 맡기고 체크인 대기', category: '숙소' },
      { id: 'd1-4', time: '15:00', place: '도톤보리', activity: '글리코 사인 · 타코야키 투어', category: '관광' },
      { id: 'd1-5', time: '19:30', place: 'Kigawa', activity: '첫날 저녁 · 오사카 갓포 요리', category: '식사' },
    ],
  },
  {
    id: 'day2',
    label: '2일차',
    date: '08.28',
    weekday: '금',
    city: '오사카',
    items: [
      { id: 'd2-1', time: '08:30', place: '호텔 라운지', activity: '조식 · 오늘 일정 브리핑', category: '식사' },
      { id: 'd2-2', time: '10:00', place: '오사카성 공원', activity: '천수각 전망대 관람', category: '관광' },
      { id: 'd2-3', time: '13:00', place: 'Hajime', activity: '미슐랭 3스타 런치 코스 (예약 완료)', category: '식사' },
      { id: 'd2-4', time: '16:00', place: '나카자키초', activity: '빈티지 카페 거리 산책', category: '카페' },
      { id: 'd2-5', time: '21:00', place: 'Bar Nayuta', activity: '나이트캡 · 시그니처 하이볼', category: '식사' },
    ],
  },
  {
    id: 'day3',
    label: '3일차',
    date: '08.29',
    weekday: '토',
    city: '교토',
    items: [
      { id: 'd3-1', time: '08:00', place: '오사카역', activity: '특급 열차로 교토 이동 (29분)', category: '이동' },
      { id: 'd3-2', time: '09:30', place: '후시미이나리 신사', activity: '센본토리이 트레킹', category: '관광' },
      { id: 'd3-3', time: '12:30', place: '니시키 시장', activity: '길거리 음식 브런치', category: '식사' },
      { id: 'd3-4', time: '15:00', place: '아라시야마 대나무숲', activity: '치쿠린 산책 · 도게츠교', category: '관광' },
      { id: 'd3-5', time: '18:30', place: '기온 하나미코지', activity: '골목 산책 후 가이세키 저녁', category: '식사' },
    ],
  },
  {
    id: 'day4',
    label: '4일차',
    date: '08.30',
    weekday: '일',
    city: '고베',
    items: [
      { id: 'd4-1', time: '09:40', place: '한신 본선', activity: '고베 산노미야로 이동', category: '이동' },
      { id: 'd4-2', time: '11:00', place: '기타노 이진칸', activity: '서양식 저택 거리 관람', category: '관광' },
      { id: 'd4-3', time: '13:00', place: 'Steakland Kobe', activity: '고베규 철판 런치', category: '식사' },
      { id: 'd4-4', time: '17:00', place: '메리켄 파크', activity: '항구 야경 · 포트타워', category: '관광' },
      { id: 'd4-5', time: '22:00', place: 'The Bar Sazanka', activity: '클래식 칵테일 한 잔', category: '식사' },
    ],
  },
]

export const restaurants: Place[] = [
  {
    id: 'r1',
    name: 'Hajime',
    nameLocal: 'ハジメ',
    badge: 'Michelin 3 Stars',
    badgeNote: '2026 가이드 선정',
    address: '1-9-11 Edobori, Nishi-ku, Osaka 550-0002',
    phone: '+81 6-6447-6688',
    category: '이노베이티브 프렌치 · 코스',
    priceRange: '¥¥¥¥',
    rating: 4.8,
    reviews: 1284,
    distanceKm: 0.8,
    walkMinutes: 11,
    image: '/images/place-sushi.png',
    imageAlt: '히노키 목재 카운터 위에 놓인 정갈한 스시 한 접시',
    savedBy: ['JH', 'MS'],
  },
  {
    id: 'r2',
    name: 'Koryu',
    nameLocal: '弧柳',
    badge: 'Michelin 2 Stars',
    badgeNote: '가이세키 · 카운터 8석',
    address: '1-1-14 Higashi-Shinsaibashi, Chuo-ku, Osaka',
    phone: '+81 6-6244-6801',
    category: '가이세키 · 일본 정식',
    priceRange: '¥¥¥¥',
    rating: 4.7,
    reviews: 642,
    distanceKm: 1.6,
    walkMinutes: 20,
    image: '/images/place-sushi.png',
    imageAlt: '따뜻한 조명 아래의 일본 가이세키 코스 요리',
    savedBy: ['SA'],
  },
]

export const bars: Place[] = [
  {
    id: 'b1',
    name: 'Bar Nayuta',
    nameLocal: 'バー ナユタ',
    badge: "World's 50 Best Bars #12",
    badgeNote: '2025 랭킹',
    address: '2-3-18 Sonezaki, Kita-ku, Osaka 530-0057',
    phone: '+81 6-6360-4310',
    category: '시그니처 칵테일 · 재패니즈 위스키',
    priceRange: '¥¥¥',
    rating: 4.6,
    reviews: 918,
    distanceKm: 1.2,
    walkMinutes: 15,
    image: '/images/place-bar.png',
    imageAlt: '앰버 조명이 감도는 고급 일본식 칵테일 바의 목재 카운터',
    savedBy: ['JH', 'HW', 'MS'],
  },
  {
    id: 'b2',
    name: 'The Bar Sazanka',
    nameLocal: 'ザ・バー サザンカ',
    badge: "Asia's 50 Best Bars #27",
    badgeNote: '호텔 루프탑',
    address: '5-15 Kitanagasadori, Chuo-ku, Kobe 650-0012',
    phone: '+81 78-333-2200',
    category: '클래식 칵테일 · 하이볼',
    priceRange: '¥¥¥',
    rating: 4.5,
    reviews: 431,
    distanceKm: 2.4,
    walkMinutes: 28,
    image: '/images/place-bar.png',
    imageAlt: '바텐더가 칵테일을 젓고 있는 어두운 분위기의 바 인테리어',
    savedBy: ['SA', 'HW'],
  },
]

/** Korean standard stay length: "6박 7일". Day trip → "1일". */
export function formatTripDuration(nights: number, days?: number): string {
  const n = Math.max(0, Math.round(Number(nights) || 0))
  const d = Math.max(1, Math.round(days ?? n + 1))
  if (n <= 0) return `${d}일`
  return `${n}박 ${d}일`
}

/** Derive nights/days from two calendar dates (same day → 0 nights / 1 day). */
export function computeTripStay(start: Date, end: Date): { nights: number; days: number } {
  const DAY_MS = 24 * 60 * 60 * 1000
  const nights = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS))
  return { nights, days: nights + 1 }
}
