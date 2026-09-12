"use client"

import { useState } from "react"
import styles from "./trip-schedule-board.module.css"
import { BedDouble, CalendarRange, Plane, type LucideIcon } from "lucide-react"

import { AccommodationSection } from "@/components/trips/AccommodationSection"
import { TransportSection } from "@/components/trips/TransportSection"
import { ScheduleSection } from "@/components/trips/ScheduleSection"
import { type ViewMode } from "@/components/view-switcher"
import { type Trip } from "@/lib/trip-data"
import { cn } from "@/lib/utils"

type TabKey = "schedule" | "transport" | "stay"

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "schedule", label: "일정", icon: CalendarRange },
  { key: "transport", label: "이동수단", icon: Plane },
  { key: "stay", label: "숙소", icon: BedDouble },
]

/**
 * 여행 상세 보드 — 플랫폼별로 다른 양식:
 * - 웹: 넓은 화면을 살린 2단 레이아웃(좌: 이동수단·숙소 / 우: 일정).
 * - 모바일: 인스타 피드처럼 상단 가로 탭 + 아래 콘텐츠. 한 번에 한 섹션만 보여 스크롤을
 *   줄이고 한눈에 들어오게 한다. (섹션은 마운트 유지 + 숨김 토글 → 전환 즉시, 상태 보존)
 *
 * ※ "가고싶은곳"은 저장>여행클립 찜과 성격이 겹쳐 이 화면에서는 제거했다.
 *   장소 찜은 저장 페이지의 "나의 찜 → 여행클립 찜" 담기로 관리한다.
 */
export function TripScheduleBoard({
  trip,
  onFlightChange,
  view = "desktop",
}: {
  trip: Trip
  onFlightChange?: () => void
  view?: ViewMode
}) {
  const [active, setActive] = useState<TabKey>("schedule")
  const [direction, setDirection] = useState("forward")
  // 이동수단·숙소가 바뀌면 값을 올려 일정 섹션이 자동 동기화 결과를 다시 불러오게 한다.
  const [sourceRev, setSourceRev] = useState(0)
  const bumpSources = () => setSourceRev((rev) => rev + 1)
  const handleFlightChange = () => {
    onFlightChange?.()
    bumpSources()
  }

  const tripCity = trip.title.split(/[·•]/)[0]?.trim() || trip.region

  // ── 웹: 2단(좌: 이동수단·숙소 / 우: 일정) ──
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
      </div>
    )
  }

  // ── 모바일: 인스타 피드 상단 가로 탭 + 콘텐츠 ─────────────────────
  return (
    <div className="w-full">
      <nav
        role="tablist"
        aria-label="여행 상세 카테고리"
        className="flex items-stretch border-b border-slate-200/80 bg-white"
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
              onClick={() => { setDirection(TABS.findIndex(t => t.key === tab.key) > TABS.findIndex(t => t.key === active) ? "forward" : "back"); setActive(tab.key) }}
              aria-label={tab.label}
              className={cn(
                "relative flex h-[60px] flex-1 items-center justify-center transition-colors active:scale-95",
                isActive ? "text-slate-900" : "text-slate-400"
              )}
            >
              <Icon className="size-[23px]" strokeWidth={1.7} />
              <span className="sr-only">{tab.label}</span>
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-[22%] -bottom-px h-[3px] rounded-full transition-colors",
                  isActive ? "bg-amber-400" : "bg-transparent"
                )}
              />
            </button>
          )
        })}
      </nav>

      <div className={styles.panels} data-direction={direction}>
        <section
          id="trip-panel-schedule"
          role="tabpanel"
          aria-label="일정"
          hidden={active !== "schedule"}
        >
          <div className="bg-white px-2.5">
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
      </div>
    </div>
  )
}
