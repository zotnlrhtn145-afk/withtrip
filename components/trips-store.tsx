"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { initialNotifications, type AppNotification } from "@/lib/notifications"
import {
  fetchTripsFromSupabase,
  insertTripToSupabase,
  toIsoDate,
  type CreateTripInput,
} from "@/lib/trips-api"
import {
  memberPalette,
  members as seedMembers,
  trips as seedTrips,
  type Member,
  type ScheduleItem,
  type Trip,
} from "@/lib/trip-data"
import {
  seedFlights,
  seedScheduleItems,
  seedStays,
  seedWishlist,
  type FlightEntry,
  type StayEntry,
  type WishlistEntry,
} from "@/lib/trip-itinerary"

export type NewTripDraft = {
  country: string
  region: string
  title: string
  startDate: Date
  endDate: Date
  invites: string[]
}

export type TripEditDraft = {
  title: string
  country: string
  region: string
  startDate: Date
  endDate: Date
  memberIds: string[]
}

export type FlightDraft = Omit<FlightEntry, "id">
export type StayDraft = Omit<StayEntry, "id">
export type WishlistDraft = Omit<WishlistEntry, "id" | "savedBy">
export type ScheduleItemDraft = Omit<ScheduleItem, "id">

type TripsStore = {
  trips: Trip[]
  members: Member[]
  filteredTrips: Trip[]
  query: string
  setQuery: (value: string) => void
  loading: boolean
  error: string | null
  refreshTrips: (options?: { silent?: boolean }) => Promise<void>
  createTrip: (input: CreateTripInput) => Promise<Trip>
  addTrip: (draft: NewTripDraft) => Promise<Trip>
  updateTrip: (tripId: string, draft: TripEditDraft) => void
  notifications: AppNotification[]
  unreadCount: number
  markAllRead: () => void
  markRead: (id: string) => void
  flightsByTrip: Record<string, FlightEntry[]>
  staysByTrip: Record<string, StayEntry[]>
  addFlight: (tripId: string, draft: FlightDraft) => void
  addStay: (tripId: string, draft: StayDraft) => void
  wishlistByTrip: Record<string, WishlistEntry[]>
  addWishlistPlace: (tripId: string, draft: WishlistDraft) => void
  scheduleByTrip: Record<string, Record<string, ScheduleItem[]>>
  addScheduleItem: (tripId: string, dayId: string, draft: ScheduleItemDraft) => void
  /** Clone seed flights/stays/wishlist onto a trip id when missing (for detail UI). */
  ensureTripBundle: (trip: Trip) => void
}

const TripsContext = createContext<TripsStore | null>(null)

const DAY_MS = 24 * 60 * 60 * 1000

function formatDate(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${date.getFullYear()}.${month}.${day}`
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function resolveSeedTemplateId(trip: Trip): string | null {
  if (seedFlights[trip.id] || seedStays[trip.id] || seedWishlist[trip.id]) return trip.id
  const hay = `${trip.title} ${trip.region} ${trip.country}`.toLowerCase()
  if (/osaka|kyoto|오사카|교토/.test(hay)) return "osaka-kyoto"
  if (/danang|da nang|다낭|호이안/.test(hay)) return "danang"
  if (/taipei|타이베이|대만/.test(hay)) return "taipei"
  return null
}

function cloneWithPrefix<T extends { id: string }>(items: T[] | undefined, tripId: string): T[] {
  return (items ?? []).map((item) => ({
    ...item,
    id: `${tripId}__${item.id}`,
  }))
}

function initialsFromInvite(invite: string) {
  const handle = invite.includes("@") ? invite.split("@")[0] : invite
  const cleaned = handle.replace(/[^a-zA-Z가-힣]/g, "")
  if (!cleaned) return "??"
  if (/[가-힣]/.test(cleaned)) return cleaned.slice(-2)
  return cleaned.slice(0, 2).toUpperCase()
}

export function TripsProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [members, setMembers] = useState<Member[]>(seedMembers)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications)
  const [flightsByTrip, setFlightsByTrip] = useState<Record<string, FlightEntry[]>>(seedFlights)
  const [staysByTrip, setStaysByTrip] = useState<Record<string, StayEntry[]>>(seedStays)
  const [wishlistByTrip, setWishlistByTrip] =
    useState<Record<string, WishlistEntry[]>>(seedWishlist)
  const [scheduleByTrip, setScheduleByTrip] =
    useState<Record<string, Record<string, ScheduleItem[]>>>(seedScheduleItems)

  const refreshTrips = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true)
    setError(null)
    try {
      const next = await fetchTripsFromSupabase()
      setTrips(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "여행 목록을 불러오지 못했어요.")
      if (!options?.silent) setTrips([])
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshTrips()
  }, [refreshTrips])

  const createTrip = useCallback(
    async (input: CreateTripInput) => {
      try {
        const trip = await insertTripToSupabase(input)
        setTrips((current) => [trip, ...current.filter((item) => item.id !== trip.id)])
        await refreshTrips({ silent: true })
        setNotifications((current) => [
          {
            id: `n-${trip.id}`,
            kind: "member",
            title: `${trip.title} 여행이 만들어졌어요`,
            body: "이제 일정과 숙소를 추가해 보세요.",
            time: "방금 전",
            tripId: trip.id,
            read: false,
          },
          ...current,
        ])
        return trip
      } catch (err) {
        console.error("[createTrip] Supabase error:", err)
        console.error(
          "[createTrip] error.message:",
          err && typeof err === "object" && "message" in err
            ? (err as { message: unknown }).message
            : undefined
        )
        throw err
      }
    },
    [refreshTrips]
  )

  const addScheduleItem = useCallback(
    (tripId: string, dayId: string, draft: ScheduleItemDraft) => {
      setScheduleByTrip((current) => {
        const tripDays = current[tripId] ?? {}
        const dayItems = tripDays[dayId] ?? []
        const nextItems = [...dayItems, { ...draft, id: `sch-${Date.now()}` }].sort((a, b) =>
          a.time.localeCompare(b.time)
        )
        return { ...current, [tripId]: { ...tripDays, [dayId]: nextItems } }
      })
    },
    []
  )

  const addWishlistPlace = useCallback((tripId: string, draft: WishlistDraft) => {
    setWishlistByTrip((current) => ({
      ...current,
      [tripId]: [...(current[tripId] ?? []), { ...draft, id: `w-${Date.now()}`, savedBy: ["JH"] }],
    }))
  }, [])

  const addFlight = useCallback((tripId: string, draft: FlightDraft) => {
    setFlightsByTrip((current) => ({
      ...current,
      [tripId]: [...(current[tripId] ?? []), { ...draft, id: `f-${Date.now()}` }],
    }))
  }, [])

  const addStay = useCallback((tripId: string, draft: StayDraft) => {
    setStaysByTrip((current) => ({
      ...current,
      [tripId]: [...(current[tripId] ?? []), { ...draft, id: `s-${Date.now()}` }],
    }))
  }, [])

  const ensureTripBundle = useCallback((trip: Trip) => {
    const templateId = resolveSeedTemplateId(trip)
    if (!templateId) return
    const tripId = trip.id

    setFlightsByTrip((current) => {
      if ((current[tripId] ?? []).length > 0) return current
      return { ...current, [tripId]: cloneWithPrefix(seedFlights[templateId], tripId) }
    })
    setStaysByTrip((current) => {
      if ((current[tripId] ?? []).length > 0) return current
      return { ...current, [tripId]: cloneWithPrefix(seedStays[templateId], tripId) }
    })
    setWishlistByTrip((current) => {
      if ((current[tripId] ?? []).length > 0) return current
      return { ...current, [tripId]: cloneWithPrefix(seedWishlist[templateId], tripId) }
    })
    setScheduleByTrip((current) => {
      if (current[tripId] && Object.keys(current[tripId]).length > 0) return current
      const template = seedScheduleItems[templateId] ?? {}
      const cloned = Object.fromEntries(
        Object.entries(template).map(([dayId, items]) => [
          dayId,
          items.map((item) => ({ ...item, id: `${tripId}__${item.id}` })),
        ])
      )
      return { ...current, [tripId]: cloned }
    })
  }, [])

  const addTrip = useCallback(
    async (draft: NewTripDraft) => {
      try {
        const trip = await createTrip({
          title: draft.title,
          country: draft.country,
          city: draft.region,
          startDate: toIsoDate(startOfDay(draft.startDate)),
          endDate: toIsoDate(startOfDay(draft.endDate)),
        })

        const invitedMembers: Member[] = draft.invites.map((invite, index) => ({
          id: `${trip.id}-m${index + 1}`,
          name: invite.includes("@") ? invite.split("@")[0] : invite,
          initials: initialsFromInvite(invite),
          color: memberPalette[(index + 1) % memberPalette.length],
        }))
        if (invitedMembers.length > 0) {
          setMembers((current) => [...current, ...invitedMembers])
        }

        return trip
      } catch (err) {
        console.error("[addTrip] Supabase error:", err)
        console.error(
          "[addTrip] error.message:",
          err && typeof err === "object" && "message" in err
            ? (err as { message: unknown }).message
            : undefined
        )
        throw err
      }
    },
    [createTrip]
  )

  const updateTrip = useCallback((tripId: string, draft: TripEditDraft) => {
    const start = startOfDay(draft.startDate)
    const end = startOfDay(draft.endDate)
    const nights = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS))
    const dDay = Math.max(
      0,
      Math.round((start.getTime() - startOfDay(new Date()).getTime()) / DAY_MS)
    )

    setTrips((current) =>
      current.map((trip) =>
        trip.id === tripId
          ? {
              ...trip,
              title: draft.title,
              country: draft.country,
              region: draft.region,
              startDate: formatDate(start),
              endDate: formatDate(end),
              nights,
              days: nights + 1,
              dDay,
              memberIds: draft.memberIds,
            }
          : trip
      )
    )
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })))
  }, [])

  const markRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item))
    )
  }, [])

  const value = useMemo<TripsStore>(() => {
    const mergedTrips = (() => {
      const supabaseTitles = new Set(trips.map((t) => t.title))
      const demos = seedTrips.filter((t) => !supabaseTitles.has(t.title))
      return [...trips, ...demos]
    })()

    const keyword = String(query ?? "")
      .trim()
      .toLowerCase()
    const filteredTrips = keyword
      ? mergedTrips.filter((trip) =>
          [trip?.title, trip?.country, trip?.region]
            .map((part) => String(part ?? ""))
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        )
      : mergedTrips

    return {
      trips: mergedTrips,
      members,
      filteredTrips,
      query,
      setQuery,
      loading,
      error,
      refreshTrips,
      createTrip,
      addTrip,
      updateTrip,
      notifications,
      unreadCount: notifications.filter((item) => !item.read).length,
      markAllRead,
      markRead,
      flightsByTrip,
      staysByTrip,
      addFlight,
      addStay,
      wishlistByTrip,
      addWishlistPlace,
      scheduleByTrip,
      addScheduleItem,
      ensureTripBundle,
    }
  }, [
    addFlight,
    addScheduleItem,
    addStay,
    addTrip,
    addWishlistPlace,
    createTrip,
    ensureTripBundle,
    error,
    flightsByTrip,
    loading,
    markAllRead,
    markRead,
    members,
    notifications,
    query,
    refreshTrips,
    scheduleByTrip,
    staysByTrip,
    trips,
    updateTrip,
    wishlistByTrip,
  ])

  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>
}

export function useTrips() {
  const context = useContext(TripsContext)
  if (!context) throw new Error("useTrips must be used inside TripsProvider")
  return context
}
