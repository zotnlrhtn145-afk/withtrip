"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BedDouble,
  Camera,
  Coffee,
  Loader2,
  MapPin,
  Plane,
  Plus,
  Utensils,
  type LucideIcon,
} from "lucide-react"

import { AddItineraryModal } from "@/components/trip-detail/add-itinerary-modal"
import { Button } from "@/components/ui/button"
import {
  fetchItinerariesByTripId,
  formatItineraryTime,
  formatWon,
  sortItineraryItems,
  type ItineraryCategory,
  type ItineraryItem,
} from "@/lib/itineraries-api"
import { type Trip } from "@/lib/trip-data"
import { buildTripDays } from "@/lib/trip-itinerary"
import { cn } from "@/lib/utils"

const categoryIcon: Record<ItineraryCategory, LucideIcon> = {
  이동: Plane,
  식사: Utensils,
  관광: Camera,
  숙소: BedDouble,
  카페: Coffee,
}

const categoryBadge: Record<ItineraryCategory, string> = {
  이동: "bg-amber-100 text-amber-900",
  숙소: "bg-indigo-100 text-indigo-900",
  관광: "bg-emerald-100 text-emerald-900",
  식사: "bg-orange-100 text-orange-900",
  카페: "bg-rose-100 text-rose-900",
}

const categoryLabel: Record<ItineraryCategory, string> = {
  이동: "이동",
  식사: "식당",
  관광: "관광",
  숙소: "숙소",
  카페: "카페",
}

type DayFilter = number | "all"

function CategoryPill({ category }: { category: ItineraryCategory }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] leading-none font-semibold",
        categoryBadge[category]
      )}
    >
      {categoryLabel[category]}
    </span>
  )
}

function TimelineCard({
  item,
  dayLabel,
  showDay,
  isLast,
}: {
  item: ItineraryItem
  dayLabel?: string
  showDay?: boolean
  isLast: boolean
}) {
  const Icon = categoryIcon[item.category]
  const costLabel = formatWon(item.estimatedCost)

  return (
    <li className="relative flex gap-2 pb-4 last:pb-0 sm:gap-3">
      <div className="w-[72px] shrink-0 pt-1.5 text-right sm:w-[88px]">
        <span className="text-sm leading-none font-black tabular-nums text-foreground sm:text-base">
          {formatItineraryTime(item.time)}
        </span>
      </div>

      <div className="relative flex w-10 shrink-0 justify-center">
        {!isLast ? (
          <span
            aria-hidden="true"
            className="absolute top-10 w-0.5 rounded-full bg-foreground/15"
            style={{ height: "calc(100% - 2.5rem)" }}
          />
        ) : null}
        <div className="relative z-10 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Icon className="size-5" />
        </div>
      </div>

      <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-4 shadow-sm">
        {showDay && dayLabel ? (
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-primary uppercase">
            {dayLabel}
          </p>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <p className="text-base leading-snug font-bold text-pretty text-foreground">{item.title}</p>
          <CategoryPill category={item.category} />
        </div>
        {item.memo ? (
          <p className="mt-1.5 text-xs leading-relaxed text-pretty text-muted-foreground">{item.memo}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <MapPin className="size-3" />
            지도
          </span>
          {costLabel ? (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold tabular-nums text-foreground/80">
              예상 {costLabel}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  )
}

/**
 * 일정표 탭 전용 컨텐츠 (Day 스위처 · 타임라인 · 추가 모달).
 * 상세 페이지 히어로/상단 탭 스위처와 분리되어 동작합니다.
 */
export function ItineraryTab({ trip }: { trip: Trip }) {
  const days = useMemo(() => buildTripDays(trip), [trip])
  const [dayFilter, setDayFilter] = useState<DayFilter>(1)
  const [items, setItems] = useState<ItineraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchItinerariesByTripId(trip.id)
      setItems(data)
    } catch (err) {
      // fetchItinerariesByTripId already returns [] on failure; keep UI on empty state.
      console.error("[ItineraryTab] load failed:", err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [trip.id])

  useEffect(() => {
    void load()
  }, [load])

  const visibleItems = useMemo(() => {
    const filtered =
      dayFilter === "all" ? items : items.filter((item) => item.dayIndex === dayFilter)
    return sortItineraryItems(filtered)
  }, [items, dayFilter])

  const defaultDayIndex = dayFilter === "all" ? 1 : dayFilter
  const activeDayMeta = days[defaultDayIndex - 1]

  const dayLabelFor = (dayIndex: number) => {
    const meta = days[dayIndex - 1]
    if (!meta) return `Day ${dayIndex}`
    return `Day ${dayIndex} · ${meta.date} ${meta.weekday}`
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold tracking-tight">여행 일정</h2>
          <p className="text-sm text-muted-foreground">
            {activeDayMeta
              ? dayFilter === "all"
                ? `전체 · 등록된 일정 ${items.length}개`
                : `${dayLabelFor(defaultDayIndex)} · ${visibleItems.length}개`
              : "일차별 일정을 관리해요"}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-full font-semibold"
        >
          <Plus data-icon="inline-start" />
          일정 추가
        </Button>
      </div>

      {/* Day switcher */}
      <div
        role="tablist"
        aria-label="일차 선택"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
      >
        {days.map((day, index) => {
          const n = index + 1
          const active = dayFilter === n
          return (
            <button
              key={day.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setDayFilter(n)}
              className={cn(
                "inline-flex shrink-0 flex-col items-start rounded-2xl border px-3.5 py-2.5 text-left transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-foreground hover:bg-secondary"
              )}
            >
              <span className="text-sm font-bold">Day {n}</span>
              <span
                className={cn(
                  "text-[11px] font-medium tabular-nums",
                  active ? "text-primary-foreground/85" : "text-muted-foreground"
                )}
              >
                {day.date} {day.weekday}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          role="tab"
          aria-selected={dayFilter === "all"}
          onClick={() => setDayFilter("all")}
          className={cn(
            "inline-flex shrink-0 items-center rounded-2xl border px-3.5 py-2.5 text-sm font-bold transition-colors",
            dayFilter === "all"
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-card text-foreground hover:bg-secondary"
          )}
        >
          전체
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">일정을 불러오는 중…</p>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary">
            <MapPin className="size-5 text-muted-foreground" />
          </span>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold">아직 등록된 일정이 없어요.</p>
            <p className="text-sm text-muted-foreground">첫 번째 장소를 등록해보세요!</p>
          </div>
          <Button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-full font-semibold"
          >
            <Plus data-icon="inline-start" />
            일정 추가
          </Button>
        </div>
      ) : (
        <ol className="rounded-2xl border border-border bg-card/40 px-3 py-4 sm:px-4">
          {visibleItems.map((item, index) => (
            <TimelineCard
              key={item.id}
              item={item}
              showDay={dayFilter === "all"}
              dayLabel={dayLabelFor(item.dayIndex)}
              isLast={index === visibleItems.length - 1}
            />
          ))}
        </ol>
      )}

      <AddItineraryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        tripId={trip.id}
        days={days}
        defaultDayIndex={defaultDayIndex}
        onCreated={(item) => {
          setItems((current) => sortItineraryItems([...current, item]))
          if (dayFilter !== "all") setDayFilter(item.dayIndex)
        }}
      />
    </section>
  )
}
