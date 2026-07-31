"use client"

import { Suspense, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Plus, Search } from "lucide-react"

import { AccountMenu } from "@/components/account-menu"
import { ForgotPasswordView } from "@/components/auth/forgot-password-view"
import { LoginView } from "@/components/auth/login-view"
import { SignupView } from "@/components/auth/signup-view"
import { type NavKey } from "@/components/bottom-nav"
import { FriendsView } from "@/components/friends-view"
import { HomeView } from "@/components/home-view"
import { FlightSection } from "@/components/itinerary/flight-section"
import { StaySection } from "@/components/itinerary/stay-section"
import { WishlistSection } from "@/components/itinerary/wishlist-section"
import { MyPageView } from "@/components/mypage-view"
import { NotificationMenu } from "@/components/notification-menu"
import { ExpenseRegisterModal } from "@/components/quick-register/expense-register-modal"
import { PlaceRegisterModal } from "@/components/quick-register/place-register-modal"
import { QuickMenuSheet } from "@/components/quick-register/quick-menu-sheet"
import { TripRegisterModal } from "@/components/quick-register/trip-register-modal"
import { ScheduleTimeline } from "@/components/schedule-timeline"
import { SettlementView } from "@/components/settlement-view"
import { SpotsView } from "@/components/spots-view"
import { TripHeroCard } from "@/components/trip-hero-card"
import { TripSearchDialog } from "@/components/trip-search-dialog"
import { useTrips } from "@/components/trips-store"
import { type ViewMode } from "@/components/view-switcher"
import { Button } from "@/components/ui/button"
import { type AppView } from "@/lib/auth-data"
import { signOutAuth } from "@/lib/auth-api"
import { type Trip } from "@/lib/trip-data"
import { pickPreferredTripId } from "@/lib/trip-group"
import { createClient } from "@/utils/supabase/client"

export function WithtripApp() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        </div>
      }
    >
      <WithtripShell />
    </Suspense>
  )
}

function WithtripShell() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [view, setView] = useState<ViewMode>("mobile")
  const [searchOpen, setSearchOpen] = useState(false)
  const [currentView, setCurrentView] = useState<AppView>("home")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [activeNav, setActiveNav] = useState<NavKey>("home")
  const [activeDay, setActiveDay] = useState("day1")
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false)
  const [isTripModalOpen, setIsTripModalOpen] = useState(false)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false)
  const [quickToast, setQuickToast] = useState<string | null>(null)
  const { trips } = useTrips()

  // Derive from the store so edits to the trip flow straight into the detail view.
  const selectedTrip = selectedTripId
    ? (trips.find((item) => item.id === selectedTripId) ?? null)
    : null

  // Prefer Paris trip as the active settlement/group context when available.
  useEffect(() => {
    if (trips.length === 0) return
    const preferred = pickPreferredTripId(
      trips.map((trip) => trip.id),
      selectedTripId
    )
    if (preferred && preferred !== selectedTripId && !selectedTripId) {
      setSelectedTripId(preferred)
    }
  }, [trips, selectedTripId])

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
    const onKeyDown = (event: KeyboardEvent) => {
      const key = (event.key ?? "").toLowerCase()
      if (key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setSearchOpen((current) => !current)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Sync in-app views with global Sidebar deep-links (?nav= / ?view=).
  useEffect(() => {
    if (pathname === "/login") {
      setCurrentView("login")
      return
    }
    if (pathname === "/friends") {
      setActiveNav("friends")
      setCurrentView("friends")
      return
    }
    if (pathname === "/around" || pathname === "/spots") {
      setActiveNav("spots")
      setCurrentView("spots")
      return
    }
    if (pathname === "/mypage") {
      setActiveNav("mypage")
      setCurrentView(isLoggedIn ? "mypage" : "login")
      return
    }
    if (pathname === "/") {
      const nav = searchParams.get("nav") as NavKey | null
      const viewParam = searchParams.get("view")
      if (viewParam === "login") {
        setCurrentView("login")
        return
      }
      if (
        nav === "friends" ||
        nav === "spots" ||
        nav === "mypage" ||
        nav === "home"
      ) {
        setActiveNav(nav)
        if (nav === "mypage") {
          setCurrentView(isLoggedIn ? "mypage" : "login")
        } else {
          setCurrentView(nav)
        }
        return
      }
    }

    const nav = searchParams.get("nav") as NavKey | null
    const viewParam = searchParams.get("view")

    if (viewParam === "login") {
      setCurrentView("login")
      return
    }

    if (
      nav === "friends" ||
      nav === "spots" ||
      nav === "mypage" ||
      nav === "home"
    ) {
      setActiveNav(nav)
      if (nav === "mypage") {
        setCurrentView(isLoggedIn ? "mypage" : "login")
      } else {
        setCurrentView(nav)
      }
      return
    }

    if (nav === "settlement") {
      const preferred = pickPreferredTripId(
        trips.map((trip) => trip.id),
        selectedTripId
      )
      if (preferred) {
        router.replace(`/settlement/${preferred}`)
      } else {
        router.replace("/settlement")
      }
    }
  }, [pathname, searchParams, isLoggedIn, trips, selectedTripId, router])

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return
      if (error && error.message !== "Auth session missing!") {
        console.warn("[WithtripShell] getUser:", error.message)
      }
      setIsLoggedIn(Boolean(data.user))
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user))
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const onBottomTab = (
      event: Event
    ) => {
      const detail = (
        event as CustomEvent<{ key?: NavKey }>
      ).detail
      const key = detail?.key
      if (!key) return
      setActiveNav(key)
      if (key === "home") {
        setCurrentView("home")
        return
      }
      if (key === "spots") {
        setCurrentView("spots")
        return
      }
      if (key === "friends") {
        setCurrentView("friends")
        return
      }
      if (key === "settlement") {
        setCurrentView("settlement")
        return
      }
      if (key === "mypage") {
        setCurrentView(isLoggedIn ? "mypage" : "login")
      }
    }
    window.addEventListener("withtrip:bottom-nav-tab", onBottomTab)
    return () =>
      window.removeEventListener("withtrip:bottom-nav-tab", onBottomTab)
  }, [isLoggedIn])

  const goTo = (next: AppView) => {
    setCurrentView(next)
    window.scrollTo({ top: 0 })
  }

  const openTripDetail = (trip: Trip) => {
    // Home planned-trip cards → trip schedule/detail page.
    setSelectedTripId(trip.id)
    router.push(`/trips/${trip.id}`)
  }

  const openMyPage = () => {
    setActiveNav("mypage")
    goTo(isLoggedIn ? "mypage" : "login")
  }

  const handleLogin = () => {
    setIsLoggedIn(true)
    setActiveNav("home")
    goTo("home")
    router.push("/")
  }

  const handleLogout = () => {
    void (async () => {
      try {
        await signOutAuth()
      } catch (err) {
        console.error("[WithtripShell] signOut failed:", err)
      } finally {
        setIsLoggedIn(false)
        setSelectedTripId(null)
        setActiveNav("home")
        goTo("home")
        router.push("/")
      }
    })()
  }

  const mainContent = (
    <>
      {currentView === "detail" && selectedTrip ? (
        view === "mobile" ? (
          <>
            <TripHeroCard trip={selectedTrip} compact />
            <FlightSection trip={selectedTrip} />
            <StaySection trip={selectedTrip} />
            <ScheduleTimeline
              trip={selectedTrip}
              activeDay={activeDay}
              onDayChange={setActiveDay}
            />
            <WishlistSection trip={selectedTrip} />
          </>
        ) : (
          <>
            <TripHeroCard trip={selectedTrip} />
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              <div className="flex flex-col gap-5">
                <FlightSection trip={selectedTrip} />
                <StaySection trip={selectedTrip} />
              </div>
              <ScheduleTimeline
                trip={selectedTrip}
                activeDay={activeDay}
                onDayChange={setActiveDay}
              />
            </div>
            <WishlistSection trip={selectedTrip} />
          </>
        )
      ) : null}
      {currentView === "friends" ? <FriendsView /> : null}
      {currentView === "spots" ? <SpotsView /> : null}
      {currentView === "settlement" ? (
        <SettlementView
          tripId={selectedTripId}
          tripTitle={selectedTrip?.title ?? null}
          onChangeTrip={() => router.push("/settlement")}
        />
      ) : null}
      {currentView === "mypage" ? (
        <MyPageView onSelectTrip={openTripDetail} onLogout={handleLogout} />
      ) : null}
      {currentView === "home" ? (
        <HomeView onSelectTrip={openTripDetail} compact={view === "mobile"} />
      ) : null}
    </>
  )

  const accountMenu = (compact: boolean) => (
    <AccountMenu
      compact={compact}
      onLoginClick={() => goTo("login")}
      onMyPageClick={openMyPage}
      onLogout={() => {
        setIsLoggedIn(false)
        setSelectedTripId(null)
        setActiveNav("home")
        goTo("home")
      }}
    />
  )

  // Shared across mobile + desktop so quick-add (trip/expense/place) works on every viewport.
  const quickAddOverlay = (
    <>
      <QuickMenuSheet
        open={isQuickMenuOpen}
        onOpenChange={setIsQuickMenuOpen}
        onSelectTrip={() => {
          setIsQuickMenuOpen(false)
          setIsTripModalOpen(true)
        }}
        onSelectExpense={() => {
          setIsQuickMenuOpen(false)
          setIsExpenseModalOpen(true)
        }}
        onSelectPlace={() => {
          setIsQuickMenuOpen(false)
          setIsPlaceModalOpen(true)
        }}
      />
      <TripRegisterModal
        open={isTripModalOpen}
        onOpenChange={setIsTripModalOpen}
        onSaved={(trip) => {
          // Stay on home dashboard — do not open trip detail.
          setSelectedTripId(null)
          setActiveNav("home")
          goTo("home")
          setQuickToast(`「${trip.title}」 여행이 등록되었어요.`)
          window.setTimeout(() => setQuickToast(null), 2800)
        }}
      />
      <ExpenseRegisterModal
        open={isExpenseModalOpen}
        onOpenChange={setIsExpenseModalOpen}
        tripId={selectedTripId}
        onSaved={(draft) => {
          setActiveNav("settlement")
          const targetTripId = selectedTripId
          if (targetTripId) {
            router.push(`/settlement/${targetTripId}`)
          } else {
            router.push("/settlement")
          }
          setQuickToast(`「${draft.storeName}」 지출이 등록되었어요.`)
          window.setTimeout(() => setQuickToast(null), 2800)
        }}
      />
      <PlaceRegisterModal
        open={isPlaceModalOpen}
        onOpenChange={setIsPlaceModalOpen}
        onSaved={(draft) => {
          setActiveNav("spots")
          goTo("spots")
          setQuickToast(`「${draft.name}」 장소가 저장되었어요.`)
          window.setTimeout(() => setQuickToast(null), 2800)
        }}
      />
      {quickToast ? (
        <div className="fixed inset-x-0 bottom-24 z-[70] mx-auto w-full max-w-md px-4 md:right-6 md:left-auto md:max-w-sm">
          <div className="rounded-2xl bg-foreground px-4 py-3 text-center text-sm font-semibold text-background shadow-lg animate-in fade-in-0 slide-in-from-bottom-2">
            {quickToast}
          </div>
        </div>
      ) : null}
    </>
  )

  const quickAddFab = (
    <button
      type="button"
      onClick={() => setIsQuickMenuOpen(true)}
      aria-label="퀵 등록"
      title="퀵 등록"
      className="fixed right-5 bottom-24 z-[65] flex size-14 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-lg shadow-amber-300/40 transition-all hover:scale-105 hover:bg-amber-500 active:scale-95 md:right-8 md:bottom-8"
    >
      <Plus className="size-6" strokeWidth={2.5} />
    </button>
  )

  if (currentView === "login" || currentView === "signup" || currentView === "forgot-password") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        {currentView === "login" ? (
          <LoginView
            onLogin={handleLogin}
            onSignup={() => goTo("signup")}
            onForgotPassword={() => goTo("forgot-password")}
          />
        ) : null}
        {currentView === "signup" ? (
          <SignupView onSignupComplete={handleLogin} onLogin={() => goTo("login")} />
        ) : null}
        {currentView === "forgot-password" ? (
          <ForgotPasswordView onBackToLogin={() => goTo("login")} />
        ) : null}
      </div>
    )
  }

  if (view === "mobile") {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative mx-auto flex w-full max-w-md flex-col pb-28">
          <main
            className={
              currentView === "friends"
                ? "flex min-h-0 flex-1 flex-col p-2 sm:p-3"
                : "flex flex-col gap-4 p-4"
            }
          >
            {mainContent}
          </main>
        </div>

        {quickAddOverlay}
        {quickAddFab}
        <TripSearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onSelectTrip={openTripDetail}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-10 items-center justify-end gap-1 bg-background/85 px-4 py-1 backdrop-blur">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              aria-label="여행 검색"
              onClick={() => setSearchOpen(true)}
              className="h-8 gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground"
            >
              <Search className="size-3.5 stroke-[1.5]" />
              <span className="hidden lg:inline">검색</span>
              <kbd className="hidden rounded border border-border bg-secondary px-1 py-0.5 text-[9px] font-semibold lg:inline">
                ⌘K
              </kbd>
            </Button>
            <NotificationMenu onSelectTrip={openTripDetail} />
            {accountMenu(true)}
          </div>
        </header>

        <main
          className={
            currentView === "friends"
              ? "flex flex-1 flex-col p-3 sm:p-4"
              : "flex flex-1 flex-col gap-5 p-6"
          }
        >
          {mainContent}
        </main>
      </div>

      {quickAddOverlay}
      {quickAddFab}
      <TripSearchDialog open={searchOpen} onOpenChange={setSearchOpen} onSelectTrip={openTripDetail} />
    </div>
  )
}
