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
  category: "이동" | "식사" | "관광" | "숙소" | "카페"
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
  /** `trips.user_id` — who created the trip (for owner-only UI like edit/delete). */
  ownerId?: string
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
  weatherIcon: "sun" | "cloud-sun" | "rain"
  flight: string
  memberIds: string[]
  readiness: number
  /** Live group members from `trip_members` (+ profiles). */
  groupMembers?: TripGroupMember[]
  /** Optional settlement completion flags from API/UI. */
  isCompleted?: boolean
  isSettled?: boolean
  settledAt?: string | null
  settlementStatus?: "open" | "SETTLED" | "COMPLETED"
  status?: string
}

export const trips: Trip[] = []

/** No global demo members — real members come from trip_members / profiles. */
export const members: Member[] = []

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
  "bg-primary text-primary-foreground",
  "bg-chart-2 text-background",
  "bg-foreground text-background",
  "bg-secondary text-secondary-foreground",
]

/** Legacy stub — stay details load from Supabase, not local mock. */
export const hotel = {
  name: "",
  nameLocal: "",
  address: "",
  phone: "",
  checkIn: "",
  checkOut: "",
  room: "",
}

/** Legacy stub — schedules load from Supabase, not local mock. */
export const scheduleDays: ScheduleDay[] = []

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
