"use client"

import { useEffect, useState } from "react"
import { BedDouble, CalendarRange, MapPin, Plane, type LucideIcon } from "lucide-react"

import { WishlistSection } from "@/components/itinerary/wishlist-section"
import { AccommodationSection } from "@/components/trips/AccommodationSection"
import { TransportSection } from "@/components/trips/TransportSection"
import { ScheduleSection } from "@/components/trips/ScheduleSection"
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
 * 여행 상세 보드 — 중카테고리(일정·이동수단·숙소·가고싶은곳)를 한 번에 하나씩 보여준다.
 *
 * 플랫폼별로 다른 양식:
 * - 모바일: 인스타 피드처럼 상단 가로 탭 + 아래 콘텐츠 (앱 느낌)
 * - 웹: 왼쪽 세로 카테고리 사이드바 + 오른쪽 콘텐츠 (데스크탑 대시보드 느낌)
 *
 * 모든 섹션은 마운트된 채 숨김만 토글하므로 전환이 즉시 되고 상태·기능은 그대로.
 */
export function TripScheduleBoard({
  trip,
  onFlightChange,
  autoOpenAddPlace = false,
  onAutoOpenAddPlaceHandled,
}: {
  trip: Trip
  onFlightChange?: () => void
  autoOpenAddPlace?: boolean
  onAutoOpenAddPlaceHandled?: () => void
}) {
  const [active, setActive] = useState<TabKey>("schedule")

  // 퀵등록의 "장소 추가"로 진입하면 위시리스트 탭으로 이동해 추가 모달 맥락을 보여준다.
  useEffect(() => {
    if (autoOpenAddPlace) setActive("wishlist")
  }, [autoOpenAddPlace])

  const tripCity = trip.title.split(/[·•]/)[0]?.trim() || trip.region

  const panels = (
    <>
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
          />
        </div>
      </section>

      <section
        id="trip-panel-transport"
        role="tabpanel"
        aria-label="이동수단"
        hidden={active !== "transport"}
      >
        <TransportSection tripId={trip.id} onTransportChange={onFlightChange} />
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
    </>
  )

  return (
    <div className="w-full">
      {/* 모바일: 인스타 피드 상단 가로 탭 (아이콘+라벨 세로, 화면 꽉 채우는 4등분) */}
      <nav
        role="tablist"
        aria-label="여행 상세 카테고리"
        className="flex items-stretch border-y border-slate-200/80 bg-white md:hidden"
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

      {/* 웹: 왼쪽 세로 카테고리 사이드바 + 오른쪽 콘텐츠 (대시보드 레이아웃) */}
      <div className="md:grid md:grid-cols-[210px_minmax(0,1fr)] md:gap-8">
        <aside className="hidden md:block">
          <div
            role="tablist"
            aria-label="여행 상세 카테고리"
            className="sticky top-20 flex flex-col gap-1"
          >
            <p className="px-4 pb-2 text-[11px] font-bold tracking-widest text-slate-300 uppercase">
              Categories
            </p>
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
                    "group flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all",
                    isActive
                      ? "bg-amber-50 text-slate-900 ring-1 ring-amber-200/70"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0 transition-colors",
                      isActive ? "text-amber-500" : "text-slate-400 group-hover:text-slate-600"
                    )}
                    strokeWidth={1.9}
                  />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="min-w-0 pt-5 md:pt-0">{panels}</div>
      </div>
    </div>
  )
}
