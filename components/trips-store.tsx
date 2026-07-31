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

import { type AppNotification } from "@/lib/notifications"
import { insertSavedPlace } from "@/lib/saved-places-api"
import {
  fetchTripsFromSupabase,
  insertTripToSupabase,
  toIsoDate,
  type CreateTripInput,
} from "@/lib/trips-api"
import {
  memberPalette,
  type Member,
  type ScheduleItem,
  type Trip,
} from "@/lib/trip-data"
import {
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
  /** Update local trip settlement completion (syncs sub-panel lists). */
  setTripSettledStatus: (tripId: string, isSettled: boolean) => void
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

function initialsFromInvite(invite: string) {
  const handle = invite.includes("@") ? invite.split("@")[0] : invite
  const cleaned = handle.replace(/[^a-zA-Z가-힣]/g, "")
  if (!cleaned) return "??"
  if (/[가-힣]/.test(cleaned)) return cleaned.slice(-2)
  return cleaned.slice(0, 2).toUpperCase()
}

export function TripsProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [flightsByTrip, setFlightsByTrip] = useState<Record<string, FlightEntry[]>>({})
  const [staysByTrip, setStaysByTrip] = useState<Record<string, StayEntry[]>>({})
  const [wishlistByTrip, setWishlistByTrip] = useState<Record<string, WishlistEntry[]>>({})
  const [scheduleByTrip, setScheduleByTrip] =
    useState<Record<string, Record<string, ScheduleItem[]>>>({})

  const resetClientTripState = useCallback(() => {
    setTrips([])
    setMembers([])
    setNotifications([])
    setFlightsByTrip({})
    setStaysByTrip({})
    setWishlistByTrip({})
    setScheduleByTrip({})
    setQuery("")
    setError(null)
  }, [])

  const refreshTrips = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true)
    setError(null)
    try {
      const next = await fetchTripsFromSupabase()
      setTrips(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "여행 목록을 불러오지 못했어요.")
      setTrips([])
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshTrips()
  }, [refreshTrips])

  // Re-fetch when auth session changes (login / logout / OAuth).
  useEffect(() => {
    let mounted = true
    let unsubscribe: (() => void) | undefined

    void import("@/utils/supabase/client").then(({ createClient }) => {
      if (!mounted) return
      const supabase = createClient()
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          resetClientTripState()
        }
        void refreshTrips({ silent: true })
      })
      unsubscribe = () => subscription.unsubscribe()
    })

    const onSessionCleared = () => {
      resetClientTripState()
    }
    window.addEventListener("withtrip:session-cleared", onSessionCleared)

    return () => {
      mounted = false
      unsubscribe?.()
      window.removeEventListener("withtrip:session-cleared", onSessionCleared)
    }
  }, [refreshTrips, resetClientTripState])

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
    void insertSavedPlace({
      tripId,
      placeName: draft.name,
      category:
        draft.kind === "bar"
          ? "라운지 & 바"
          : draft.kind === "stay"
            ? "숙소"
            : "레스토랑",
      localName: draft.nameLocal,
      subCategory: draft.category,
      guideBadge: draft.badge,
      priceRange: draft.priceRange,
      address: draft.address,
      phoneNumber: draft.phone,
    }).catch((err) => {
      console.error("[addWishlistPlace] saved_places insert failed:", err)
    })
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

  const ensureTripBundle = useCallback((_trip: Trip) => {
    // No mock/seed fallback — trip detail loads only real Supabase data.
  }, [])

  const setTripSettledStatus = useCallback((tripId: string, isSettled: boolean) => {
    const id = String(tripId ?? "").trim()
    if (!id) return
    setTrips((current) =>
      current.map((trip) =>
        trip.id === id
          ? {
              ...trip,
              isSettled,
              isCompleted: isSettled,
              settlementStatus: isSettled ? "SETTLED" : "open",
              settledAt: isSettled ? new Date().toISOString() : null,
            }
          : trip
      )
    )
  }, [])

  useEffect(() => {
    const onSettled = (event: Event) => {
      const detail = (event as CustomEvent<{ tripId?: string; settled?: boolean }>).detail
      const id = String(detail?.tripId ?? "").trim()
      if (!id) return
      setTripSettledStatus(id, Boolean(detail?.settled))
    }
    window.addEventListener("withtrip:trip-settled", onSettled)
    return () => window.removeEventListener("withtrip:trip-settled", onSettled)
  }, [setTripSettledStatus])

  // When settle status changes elsewhere, soft-refresh from DB shortly after.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onSettled = () => {
      window.clearTimeout(timer)
      timer = setTimeout(() => {
        void refreshTrips({ silent: true })
      }, 400)
    }
    window.addEventListener("withtrip:trip-settled", onSettled)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("withtrip:trip-settled", onSettled)
    }
  }, [refreshTrips])

  // AI-generated trip cover finishes in the background — soft-refresh so the
  // cinematic image swaps in without the user having to reload.
  useEffect(() => {
    const onCoverReady = () => {
      void refreshTrips({ silent: true })
    }
    window.addEventListener("withtrip:trip-cover-ready", onCoverReady)
    return () => window.removeEventListener("withtrip:trip-cover-ready", onCoverReady)
  }, [refreshTrips])

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
    const keyword = String(query ?? "")
      .trim()
      .toLowerCase()
    const filteredTrips = keyword
      ? trips.filter((trip) =>
          [trip?.title, trip?.country, trip?.region]
            .map((part) => String(part ?? ""))
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        )
      : trips

    return {
      trips,
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
      setTripSettledStatus,
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
    setTripSettledStatus,
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
