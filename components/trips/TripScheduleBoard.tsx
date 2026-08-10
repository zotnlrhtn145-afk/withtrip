"use client"

import { useEffect, useState } from "react"
import { BedDouble, CalendarRange, MapPin, Plane, type LucideIcon } from "lucide-react"

import { WishlistSection } from "@/components/itinerary/wishlist-section"
import { AccommodationSection } from "@/components/trips/AccommodationSection"
import { TransportSection } from "@/components/trips/TransportSection"
import { ScheduleSection } from "@/components/trips/ScheduleSection"
import { type ViewMode } from "@/components/view-switcher"
import { type Trip } from "@/lib/trip-data"
import { cn } from "@/lib/utils"

type TabKey = "schedule" | "transport" | "stay" | "wishlist"

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "schedule", label: "일정", icon: CalendarRange },
  { key: "transport", label: "이동수단", icon: Plane },
  { key: "stay", label: "숙소", icon: BedDouble },
  { key: "wishlist", label: "가고싶은곳", icon: MapPin },
]

/**
 * 여행 상세 보드 — 플랫폼별로 다른 양식:
 * - 웹: 넓은 화면을 살린 원래 2단 레이아웃(좌: 이동수단·숙소·가고싶은곳 / 우: 일정)으로
 *   여러 섹션을 한 번에 시원하게 노출.
 * - 모바일: 인스타 피드처럼 상단 가로 탭 + 아래 콘텐츠. 한 번에 한 섹션만 보여 스크롤을
 *   줄이고 한눈에 들어오게 한다. (섹션은 마운트 유지 + 숨김 토글 → 전환 즉시, 상태 보존)
 */
export function TripScheduleBoard({
  trip,
  onFlightChange,
  autoOpenAddPlace = false,
  onAutoOpenAddPlaceHandled,
  view = "desktop",
}: {
  trip: Trip
  onFlightChange?: () => void
  autoOpenAddPlace?: boolean
  onAutoOpenAddPlaceHandled?: () => void
  view?: ViewMode
}) {
  const [active, setActive] = useState<TabKey>("schedule")
  // 이동수단·숙소가 바뀌면 값을 올려 일정 섹션이 자동 동기화 결과를 다시 불러오게 한다.
  const [sourceRev, setSourceRev] = useState(0)
  const bumpSources = () => setSourceRev((rev) => rev + 1)
  const handleFlightChange = () => {
    onFlightChange?.()
    bumpSources()
  }

  // 퀵등록의 "장소 추가"로 진입하면 위시리스트 탭으로 이동해 추가 모달 맥락을 보여준다.
  useEffect(() => {
    if (autoOpenAddPlace) setActive("wishlist")
  }, [autoOpenAddPlace])

  const tripCity = trip.title.split(/[·•]/)[0]?.trim() || trip.region

  // ── 웹: 상단 2단(좌: 이동수단·숙소 / 우: 일정) + 하단 전체폭 가고싶은곳 ──
  //   가고싶은곳을 좁은 열에 두면 세로로 길어지므로 좌우 끝까지 펼쳐 카드가
  //   가로로 여러 개 배치되게(짧고 넓게) 한다.
  if (view !== "mobile") {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-5">
          <TransportSection tripId={trip.id} onTransportChange={handleFlightChange} />
          <AccommodationSection
            tripId={trip.id}
            tripStartDate={trip.startDate}
            tripEndDate={trip.endDate}
            onAccommodationChange={bumpSources}
          />
        </div>
        <div className="min-w-0 lg:col-span-7">
          <div className="h-full rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md sm:p-6">
            <ScheduleSection
              tripId={trip.id}
              tripStartDate={trip.startDate}
              tripDays={trip.days}
              tripCity={tripCity}
              refreshKey={sourceRev}
            />
          </div>
        </div>
        <div className="min-w-0 lg:col-span-12">
          <WishlistSection
            trip={trip}
            autoOpenAdd={autoOpenAddPlace}
            onAutoOpenHandled={onAutoOpenAddPlaceHandled}
          />
        </div>
      </div>
    )
  }

  // ── 모바일: 인스타 피드 상단 가로 탭 + 콘텐츠 ─────────────────────
  return (
    <div className="w-full">
      <nav
        role="tablist"
        aria-label="여행 상세 카테고리"
        className="flex items-stretch border-y border-slate-200/80 bg-white"
      >
        {TABS.map((tab) => {
          const isActive = active === tab.key
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`trip-panel-${tab.key}`}
              onClick={() => setActive(tab.key)}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 py-3 transition-colors",
                isActive ? "text-slate-900" : "text-slate-400"
              )}
            >
              <Icon className="size-5" strokeWidth={isActive ? 2.1 : 1.7} />
              <span className="text-[11px] font-semibold tracking-tight">{tab.label}</span>
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-0 -top-px h-0.5 transition-colors",
                  isActive ? "bg-slate-900" : "bg-transparent"
                )}
              />
            </button>
          )
        })}
      </nav>

      <div className="pt-5">
        <section
          id="trip-panel-schedule"
          role="tabpanel"
          aria-label="일정"
          hidden={active !== "schedule"}
        >
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <ScheduleSection
              tripId={trip.id}
              tripStartDate={trip.startDate}
              tripDays={trip.days}
              tripCity={tripCity}
              refreshKey={sourceRev}
            />
          </div>
        </section>

        <section
          id="trip-panel-transport"
          role="tabpanel"
          aria-label="이동수단"
          hidden={active !== "transport"}
        >
          <TransportSection tripId={trip.id} onTransportChange={handleFlightChange} />
        </section>

        <section
          id="trip-panel-stay"
          role="tabpanel"
          aria-label="숙소"
          hidden={active !== "stay"}
        >
          <AccommodationSection
            tripId={trip.id}
            tripStartDate={trip.startDate}
            tripEndDate={trip.endDate}
            onAccommodationChange={bumpSources}
          />
        </section>

        <section
          id="trip-panel-wishlist"
          role="tabpanel"
          aria-label="가고 싶은 곳"
          hidden={active !== "wishlist"}
        >
          <WishlistSection
            trip={trip}
            autoOpenAdd={autoOpenAddPlace}
            onAutoOpenHandled={onAutoOpenAddPlaceHandled}
          />
        </section>
      </div>
    </div>
  )
}
