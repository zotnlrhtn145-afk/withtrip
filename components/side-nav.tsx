"use client"

import { Compass, Plane, Plus } from "lucide-react"

import { navItems, type NavKey } from "@/components/bottom-nav"
import { CreateTripDialog } from "@/components/create-trip-dialog"
import { useTrips } from "@/components/trips-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { type AppView } from "@/lib/auth-data"
import { type Trip } from "@/lib/trip-data"
import { cn } from "@/lib/utils"

const navViewMap: Partial<Record<NavKey, AppView>> = {
  home: "home",
  friends: "friends",
  spots: "spots",
  settlement: "settlement",
  mypage: "mypage",
}

export function SideNav({
  active,
  onSelect,
  currentView,
  selectedTrip,
  onSelectTrip,
  onHome,
}: {
  active: NavKey
  onSelect: (key: NavKey) => void
  currentView: AppView
  selectedTrip: Trip | null
  onSelectTrip: (trip: Trip) => void
  onHome: () => void
}) {
  const { filteredTrips, query } = useTrips()
  const isDetail = currentView === "detail"

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col gap-5 border-r border-border bg-sidebar px-4 py-5">
      <button
        type="button"
        onClick={onHome}
        aria-label="WITHTRIP 홈으로"
        className="flex items-center gap-2 rounded-xl text-left transition-opacity hover:opacity-80"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Compass className="size-5" />
        </span>
        <span className="flex flex-col">
          <span className="text-sm leading-none font-extrabold tracking-tight">WITHTRIP</span>
          <span className="text-[11px] text-muted-foreground">위드트립</span>
        </span>
      </button>

      <nav aria-label="사이드 메뉴">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const mappedView = navViewMap[item.key]
            const isActive =
              item.key === "home"
                ? currentView === "home" || (isDetail && active === "home")
                : mappedView
                  ? currentView === mappedView
                  : active === item.key
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onSelect(item.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <Separator />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            계획한 여행
          </span>
          <CreateTripDialog
            onCreated={() => onHome()}
            trigger={
              <Button variant="ghost" size="icon-xs" aria-label="새 여행 만들기">
                <Plus />
              </Button>
            }
          />
        </div>
        {query.trim() && filteredTrips.length === 0 ? (
          <p className="rounded-lg bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {`"${query}" 검색 결과가 없어요.`}
          </p>
        ) : null}
        <ul className="flex flex-col gap-1">
          {filteredTrips.map((item) => {
            const isCurrent = isDetail && selectedTrip?.id === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectTrip(item)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                    isCurrent ? "bg-primary/15" : "hover:bg-secondary"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Plane
                      className={cn(
                        "size-3.5 shrink-0",
                        isCurrent ? "text-foreground" : "text-muted-foreground"
                      )}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{item.title}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {item.startDate} 출발
                      </span>
                    </span>
                  </span>
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    D-{item.dDay}
                  </Badge>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {isDetail && selectedTrip ? (
        <div className="mt-auto rounded-xl bg-secondary p-3">
          <p className="text-xs font-semibold tabular-nums">
            여행 준비율 {selectedTrip.readiness}%
          </p>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card"
            role="progressbar"
            aria-valuenow={selectedTrip.readiness}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="여행 준비율"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${selectedTrip.readiness}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            숙소 확정 · 항공 확정 · 렌터카 미정
          </p>
        </div>
      ) : (
        <div className="mt-auto rounded-xl bg-secondary p-3">
          <p className="text-xs font-semibold">여행 카드를 선택해 주세요</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            일정 · 숙소 · 맛집 정보를 한 화면에서 확인할 수 있어요.
          </p>
        </div>
      )}
    </aside>
  )
}
