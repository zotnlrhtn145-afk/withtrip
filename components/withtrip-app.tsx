"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Compass, Search } from "lucide-react"

import { AccountMenu } from "@/components/account-menu"
import { ForgotPasswordView } from "@/components/auth/forgot-password-view"
import { LoginView } from "@/components/auth/login-view"
import { SignupView } from "@/components/auth/signup-view"
import { BottomNav, type NavKey } from "@/components/bottom-nav"
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
import { SideNav } from "@/components/side-nav"
import { SpotsView } from "@/components/spots-view"
import { TripHeroCard } from "@/components/trip-hero-card"
import { TripSearchDialog } from "@/components/trip-search-dialog"
import { TripsProvider, useTrips } from "@/components/trips-store"
import { ViewSwitcher, type ViewMode } from "@/components/view-switcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { type AppView } from "@/lib/auth-data"
import { type Trip } from "@/lib/trip-data"

const pageTitles: Partial<Record<AppView, string>> = {
  home: "내 여행",
  friends: "친구",
  spots: "주변 스팟",
  settlement: "정산",
  mypage: "마이페이지",
}

export function WithtripApp() {
  return (
    <TripsProvider>
      <WithtripShell />
    </TripsProvider>
  )
}

function WithtripShell() {
  const router = useRouter()
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
  const manualOverride = useRef(false)
  const { trips } = useTrips()

  // Derive from the store so edits to the trip flow straight into the detail view.
  const selectedTrip = selectedTripId
    ? (trips.find((item) => item.id === selectedTripId) ?? null)
    : null

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)")
    const sync = () => {
      if (manualOverride.current) return
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

  const handleViewChange = (next: ViewMode) => {
    manualOverride.current = true
    setView(next)
  }

  const goTo = (next: AppView) => {
    setCurrentView(next)
    window.scrollTo({ top: 0 })
  }

  const goHome = () => {
    setSelectedTripId(null)
    setActiveNav("home")
    goTo("home")
  }

  const openTrip = (trip: Trip) => {
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
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setSelectedTripId(null)
    setActiveNav("home")
    goTo("home")
  }

  const handleNavSelect = (key: NavKey) => {
    setActiveNav(key)
    if (key === "mypage") {
      goTo(isLoggedIn ? "mypage" : "login")
      return
    }
    if (key === "home") {
      goTo("home")
      return
    }
    if (key === "friends") {
      goTo("friends")
      return
    }
    if (key === "spots") {
      goTo("spots")
      return
    }
    if (key === "settlement") {
      goTo("settlement")
      return
    }
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
      {currentView === "settlement" ? <SettlementView /> : null}
      {currentView === "mypage" ? (
        <MyPageView onSelectTrip={openTrip} onLogout={handleLogout} />
      ) : null}
      {currentView === "home" ? (
        <HomeView onSelectTrip={openTrip} compact={view === "mobile"} />
      ) : null}
    </>
  )

  const accountMenu = (compact: boolean) => (
    <AccountMenu
      isLoggedIn={isLoggedIn}
      compact={compact}
      onLoginClick={() => goTo("login")}
      onMyPageClick={openMyPage}
      onLogout={handleLogout}
    />
  )

  if (currentView === "login" || currentView === "signup" || currentView === "forgot-password") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="flex items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={goHome}
            className="-ml-2 gap-2 font-extrabold tracking-tight"
          >
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Compass className="size-3.5" />
            </span>
            WITHTRIP
          </Button>
          <Button variant="ghost" size="sm" onClick={goHome} className="font-semibold">
            <ArrowLeft data-icon="inline-start" />
            여행 목록으로
          </Button>
        </header>

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
          <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
            {currentView === "detail" ? (
              <Button variant="ghost" size="sm" onClick={goHome} className="-ml-2 font-semibold">
                <ArrowLeft data-icon="inline-start" />
                목록으로
              </Button>
            ) : (
              <button
                type="button"
                onClick={goHome}
                aria-label="WITHTRIP 홈으로"
                className="flex items-center gap-2 transition-opacity hover:opacity-80"
              >
                <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Compass className="size-4.5" />
                </span>
                <span className="text-base leading-none font-extrabold tracking-tight">
                  WITHTRIP
                </span>
              </button>
            )}
            <div className="flex items-center gap-1">
              <ViewSwitcher view={view} onViewChange={handleViewChange} />
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

          <main className="flex flex-col gap-4 p-4">{mainContent}</main>
        </div>

        <BottomNav
          active={activeNav}
          onSelect={handleNavSelect}
          onQuickAdd={() => setIsQuickMenuOpen(true)}
        />
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
          onSaved={(draft) => {
            setActiveNav("settlement")
            goTo("settlement")
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
          <div className="fixed inset-x-0 bottom-24 z-[70] mx-auto w-full max-w-md px-4">
            <div className="rounded-2xl bg-foreground px-4 py-3 text-center text-sm font-semibold text-background shadow-lg animate-in fade-in-0 slide-in-from-bottom-2">
              {quickToast}
            </div>
          </div>
        ) : null}
        <TripSearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onSelectTrip={openTrip}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SideNav
        active={activeNav}
        onSelect={handleNavSelect}
        currentView={currentView}
        selectedTrip={selectedTrip}
        onSelectTrip={openTrip}
        onHome={goHome}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-6 py-3 backdrop-blur">
          {currentView === "detail" && selectedTrip ? (
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
              <h1 className="truncate text-base font-bold">{selectedTrip.title}</h1>
              <Badge className="shrink-0 tabular-nums">D-{selectedTrip.dDay}</Badge>
              <span className="hidden text-xs text-muted-foreground tabular-nums lg:inline">
                {selectedTrip.startDate} — {selectedTrip.endDate}
              </span>
            </div>
          ) : (
            <h1 className="text-base font-bold">{pageTitles[currentView] ?? "내 여행"}</h1>
          )}
          <div className="flex items-center gap-2">
            <ViewSwitcher view={view} onViewChange={handleViewChange} />
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

        <main className="flex flex-col gap-5 p-6">{mainContent}</main>
      </div>

      <TripSearchDialog open={searchOpen} onOpenChange={setSearchOpen} onSelectTrip={openTrip} />
    </div>
  )
}
