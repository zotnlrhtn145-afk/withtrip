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
 * 여행 상세 보드 — 중카테고리(일정·이동수단·숙소·가고싶은곳)를 세로로 길게 쌓지 않고
 * 인스타그램 프로필 피드 상단처럼 탭으로 나눠 한 번에 하나씩 보여준다. 스크롤을 줄여
 * 한눈에 들어오게 하는 게 목적. 모든 섹션은 마운트된 채 숨김만 토글하므로 탭 전환 시
 * 재로딩 없이 즉시 바뀌고 각 섹션의 상태·기능은 그대로 유지된다.
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

  return (
    <div className="w-full">
      {/*
        인스타그램 피드 상단 탭 스타일.
        - 모바일: 아이콘+라벨 세로, 화면 꽉 채우는 4등분 (앱 느낌)
        - 웹: 아이콘+라벨 가로 인라인, 가운데 정렬 + 넉넉한 간격 (인스타 웹 피드 탭 느낌)
        활성 탭은 상단 라인으로 강조.
      */}
      <nav
        role="tablist"
        aria-label="여행 상세 카테고리"
        className="flex items-stretch border-y border-slate-200/80 bg-white md:justify-center md:gap-10"
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
                "md:flex-none md:flex-row md:gap-2 md:px-5 md:py-4",
                isActive ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Icon className="size-5 md:size-4" strokeWidth={isActive ? 2.1 : 1.7} />
              <span className="text-[11px] font-semibold tracking-tight md:text-[13px] md:tracking-normal">
                {tab.label}
              </span>
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
      </div>
    </div>
  )
}
