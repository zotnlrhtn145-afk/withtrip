"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, Plane, Search } from "lucide-react"

import { AccountMenu } from "@/components/account-menu"
import { NotificationMenu } from "@/components/notification-menu"
import {
  isSettlementInProgress,
  SettlementSubPanel,
} from "@/components/settlement-sub-panel"
import { SettlementView } from "@/components/settlement-view"
import { TripBannerCard } from "@/components/trip-banner-card"
import { TripSearchDialog } from "@/components/trip-search-dialog"
import { useTrips } from "@/components/trips-store"
import { type ViewMode } from "@/components/view-switcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { type Trip } from "@/lib/trip-data"

function SettlementTripPicker({
  trips,
  selectedTripId,
  onSelectTrip,
  compact = false,
}: {
  trips: Trip[]
  selectedTripId?: string | null
  onSelectTrip: (trip: Trip) => void
  compact?: boolean
}) {
  const selectable = trips.filter(isSettlementInProgress)
  const list = selectable.length > 0 ? selectable : trips

  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-secondary">
          <Plane className="size-5 text-muted-foreground" />
        </span>
        <p className="text-sm font-semibold">참여 중인 여행이 없어요</p>
        <p className="text-sm text-muted-foreground">
          홈에서 새 여행을 만들면 여기에서 정산을 시작할 수 있어요.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">정산할 여행 선택</h2>
        <p className="text-sm text-muted-foreground">
          정산 진행 중인 여행을 고르면 내역이 바로 열립니다. 완료된 정산은 왼쪽 목록에서
          확인할 수 있어요.
        </p>
      </div>
      <div className={compact ? "flex flex-col gap-4" : "grid gap-5 xl:grid-cols-2"}>
        {list.map((trip, index) => (
          <div key={trip.id} className="relative">
            {selectedTripId === trip.id ? (
              <Badge className="absolute top-3 right-3 z-10">선택됨</Badge>
            ) : null}
            <TripBannerCard
              trip={trip}
              onSelect={onSelectTrip}
              priority={index === 0}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function SettlementShellInner({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams<{ tripId?: string }>()
  const { trips, loading } = useTrips()
  const [view, setView] = useState<ViewMode>("mobile")
  const [searchOpen, setSearchOpen] = useState(false)

  const activeTripId = String(params.tripId ?? "").trim() || null

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)")
    const sync = () => {
      setView(query.matches ? "desktop" : "mobile")
    }
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  const openTrip = (trip: Trip) => {
    // Soft navigation — layout (and sub-panel) stays mounted.
    router.push(`/settlement/${trip.id}`)
  }

  const accountMenu = (compact: boolean) => (
    <AccountMenu
      compact={compact}
      onLoginClick={() => router.push("/?view=login")}
      onMyPageClick={() => router.push("/?nav=mypage")}
      onLogout={() => router.push("/")}
    />
  )

  const showPicker = !activeTripId && pathname === "/settlement"

  const detailContent = loading ? (
    <div className="flex flex-col items-center gap-3 py-16">
      <Loader2 className="size-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">여행 목록을 불러오는 중…</p>
    </div>
  ) : activeTripId ? (
    children
  ) : showPicker ? (
    <SettlementTripPicker
      trips={trips}
      selectedTripId={activeTripId}
      onSelectTrip={openTrip}
      compact={view === "mobile"}
    />
  ) : (
    children
  )

  if (view === "mobile") {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative mx-auto flex w-full max-w-md flex-col pb-28">
          <main className="flex flex-col gap-4 p-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTripId ?? "picker"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {detailContent}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
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
      {/* Mounted once under /settlement layout — no remount on trip switch */}
      <SettlementSubPanel
        trips={trips}
        selectedTripId={activeTripId}
        onSelectTrip={openTrip}
      />

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
            </Button>
            <NotificationMenu onSelectTrip={openTrip} />
            {accountMenu(false)}
          </div>
        </header>
        <main className="flex flex-col gap-5 p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTripId ?? "picker"}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="min-w-0"
            >
              {detailContent}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <TripSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelectTrip={openTrip}
      />
    </div>
  )
}

export function SettlementShell({ children }: { children: ReactNode }) {
  return <SettlementShellInner>{children}</SettlementShellInner>
}

export function SettlementTripDetail({ tripId }: { tripId: string }) {
  const { trips } = useTrips()
  const router = useRouter()
  const trip = trips.find((item) => item.id === tripId) ?? null

  return (
    <SettlementView
      tripId={tripId}
      tripTitle={trip?.title ?? null}
      onChangeTrip={() => router.push("/settlement")}
    />
  )
}
