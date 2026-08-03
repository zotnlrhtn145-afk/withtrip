"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Search } from "lucide-react"

import { AccountMenu } from "@/components/account-menu"
import { NotificationMenu } from "@/components/notification-menu"
import { TripHeroCard } from "@/components/trip-hero-card"
import { TripSearchDialog } from "@/components/trip-search-dialog"
import { TripScheduleBoard } from "@/components/trips/TripScheduleBoard"
import { TripsProvider, useTrips } from "@/components/trips-store"
import { type ViewMode } from "@/components/view-switcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetchTripById, getErrorMessage } from "@/lib/trips-api"
import { type Trip } from "@/lib/trip-data"

function TripDetailComplete({ tripId }: { tripId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { trips } = useTrips()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>("desktop")
  const [searchOpen, setSearchOpen] = useState(false)
  const [flightsRevision, setFlightsRevision] = useState(0)
  const [autoOpenAddPlace, setAutoOpenAddPlace] = useState(false)

  const handleFlightChange = () => {
    setFlightsRevision((current) => current + 1)
  }

  // 퀵등록의 "장소 추가"에서 넘어온 경우 (?addPlace=1) 장소 추가 모달을 바로 연다.
  useEffect(() => {
    if (searchParams.get("addPlace") !== "1") return
    setAutoOpenAddPlace(true)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("addPlace")
    const qs = params.toString()
    router.replace(qs ? `/trips/${tripId}?${qs}` : `/trips/${tripId}`)
  }, [searchParams, tripId, router])

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)")
    const sync = () => {
      setView(query.matches ? "desktop" : "mobile")
    }
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const fromStore = trips.find((item) => item.id === tripId)
        if (fromStore) {
          if (!cancelled) setTrip(fromStore)
          return
        }

        const remote = await fetchTripById(tripId)
        if (cancelled) return
        if (!remote) {
          setTrip(null)
          setError("여행을 찾을 수 없어요.")
          return
        }
        setTrip(remote)
      } catch (err) {
        if (cancelled) return
        console.error("[TripDetailComplete] fetch failed:", err)
        setError(getErrorMessage(err))
        setTrip(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [tripId, trips])

  const displayTrip = trip

  const goHome = () => router.push("/")
  const openTrip = (next: Trip) => router.push(`/settlement/${next.id}`)

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-4">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">여행 정보를 불러오는 중…</p>
      </div>
    )
  }

  if (error || !displayTrip) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold">여행을 불러오지 못했어요</h1>
          <p className="text-sm text-muted-foreground">{error ?? "알 수 없는 오류"}</p>
        </div>
        <Button type="button" onClick={goHome} className="rounded-full font-semibold">
          홈으로 돌아가기
        </Button>
      </div>
    )
  }

  const accountMenu = (compact: boolean) => (
    <AccountMenu
      compact={compact}
      onLoginClick={() => router.push("/?view=login")}
      onMyPageClick={() => router.push("/?nav=mypage")}
      onLogout={() => {
        router.push("/")
      }}
    />
  )

  const mainBody = (
    <>
      <TripHeroCard
        trip={displayTrip}
        compact={view === "mobile"}
        flightsRevision={flightsRevision}
        flushBottom
      />
      <TripScheduleBoard
        trip={displayTrip}
        onFlightChange={handleFlightChange}
        autoOpenAddPlace={autoOpenAddPlace}
        onAutoOpenAddPlaceHandled={() => setAutoOpenAddPlace(false)}
      />
    </>
  )

  if (view === "mobile") {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative mx-auto flex w-full max-w-md flex-col pb-8">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur">
            <Button variant="ghost" size="sm" onClick={goHome} className="-ml-2 font-semibold">
              <ArrowLeft data-icon="inline-start" />
              목록으로
            </Button>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="여행 검색"
                onClick={() => setSearchOpen(true)}
              >
                <Search />
              </Button>
              <NotificationMenu onSelectTrip={openTrip} />
              {accountMenu(true)}
            </div>
          </header>
          <main className="flex flex-col gap-5 p-4">{mainBody}</main>
        </div>
        <TripSearchDialog open={searchOpen} onOpenChange={setSearchOpen} onSelectTrip={openTrip} />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200/70 bg-white/90 px-6 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={goHome}
              className="-ml-2 shrink-0 font-semibold"
            >
              <ArrowLeft data-icon="inline-start" />
              목록으로 돌아가기
            </Button>
            <h1 className="truncate text-base font-bold">{displayTrip.title}</h1>
            <Badge className="shrink-0 tabular-nums">D-{displayTrip.dDay}</Badge>
            <span className="hidden text-xs text-muted-foreground tabular-nums lg:inline">
              {displayTrip.startDate} — {displayTrip.endDate}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              aria-label="여행 검색"
              onClick={() => setSearchOpen(true)}
              className="gap-2 rounded-full font-medium text-muted-foreground"
            >
              <Search />
              <span className="hidden lg:inline">여행 검색</span>
              <kbd className="hidden rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-semibold lg:inline">
                ⌘K
              </kbd>
            </Button>
            <NotificationMenu onSelectTrip={openTrip} />
            {accountMenu(false)}
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6">{mainBody}</main>
      </div>

      <TripSearchDialog open={searchOpen} onOpenChange={setSearchOpen} onSelectTrip={openTrip} />
    </div>
  )
}

export function TripDetailPage({ tripId }: { tripId: string }) {
  return (
    <TripsProvider>
      <Suspense fallback={null}>
        <TripDetailComplete tripId={tripId} />
      </Suspense>
    </TripsProvider>
  )
}
