"use client"

import { usePathname } from "next/navigation"
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
  const pathname = usePathname()
  const { filteredTrips, query } = useTrips()
  const isDetail = currentView === "detail"
  // Only show participating trips on settlement routes / settlement tab.
  const showParticipatingTrips =
    pathname.startsWith("/settlement") || currentView === "settlement"

  return (
    <aside className="sticky top-0 flex h-screen w-[15.5rem] shrink-0 flex-col gap-4 border-r border-border bg-sidebar/95 px-3 py-4 backdrop-blur">
      <button
        type="button"
        onClick={onHome}
        aria-label="WITHTRIP 홈으로"
        className="flex items-center gap-2.5 rounded-xl px-1 text-left transition-opacity hover:opacity-80"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Compass className="size-4 stroke-[1.5]" />
        </span>
        <span className="flex flex-col">
          <span className="text-[13px] leading-none font-extrabold tracking-tight">WITHTRIP</span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">위드트립</span>
        </span>
      </button>

      <nav aria-label="사이드 메뉴">
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const mappedView = navViewMap[item.key]
            const isActive =
              item.key === "home"
                ? currentView === "home" || (isDetail && active === "home")
                : item.key === "settlement"
                  ? showParticipatingTrips
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
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-primary/90 font-semibold text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  )}
                >
                  <item.icon className="size-[18px] stroke-[1.35]" />
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {showParticipatingTrips ? (
        <>
          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                참여 여행
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
                const isCurrent = selectedTrip?.id === item.id
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

          <div className="mt-auto rounded-xl bg-secondary p-3">
            <p className="text-xs font-semibold">정산할 여행을 선택하세요</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              항목을 누르면 해당 여행의 정산 내역으로 이동합니다.
            </p>
          </div>
        </>
      ) : isDetail && selectedTrip ? (
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
          <p className="text-xs font-semibold">WITHTRIP과 함께해요</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            정산 탭에서 참여 중인 여행을 고르면 지출·송금 내역을 볼 수 있어요.
          </p>
        </div>
      )}
    </aside>
  )
}
