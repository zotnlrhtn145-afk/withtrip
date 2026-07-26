"use client"

import { useState } from "react"
import {
  Camera,
  Coffee,
  BedDouble,
  Plane,
  Plus,
  Utensils,
  type LucideIcon,
} from "lucide-react"

import { ScheduleDialog } from "@/components/itinerary/schedule-dialog"
import { useTrips } from "@/components/trips-store"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { type ScheduleItem, type Trip } from "@/lib/trip-data"
import { buildTripDays, defaultScheduleSlots, type ScheduleSlotTemplate } from "@/lib/trip-itinerary"
import { cn } from "@/lib/utils"

const categoryIcon: Record<ScheduleItem["category"], LucideIcon> = {
  이동: Plane,
  식사: Utensils,
  관광: Camera,
  숙소: BedDouble,
  카페: Coffee,
}

/** Soft, high-contrast tints so each category is scannable at a glance. */
const categoryBadge: Record<ScheduleItem["category"], string> = {
  이동: "bg-amber-100 text-amber-900",
  숙소: "bg-indigo-100 text-indigo-900",
  관광: "bg-emerald-100 text-emerald-900",
  식사: "bg-orange-100 text-orange-900",
  카페: "bg-rose-100 text-rose-900",
}

function CategoryPill({ category }: { category: ScheduleItem["category"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] leading-none font-semibold",
        categoryBadge[category]
      )}
    >
      {category}
    </span>
  )
}

/** Shared 3-column scaffold: time axis · timeline node · content card. */
function TimelineRail({
  time,
  category,
  isLast,
  muted = false,
  children,
}: {
  time: string
  category: ScheduleItem["category"]
  isLast: boolean
  muted?: boolean
  children: React.ReactNode
}) {
  const Icon = categoryIcon[category]

  return (
    <li className="relative flex gap-2 pb-4 last:pb-0 sm:gap-3">
      <div className="w-[52px] shrink-0 pt-1.5 text-right sm:w-[68px]">
        <span
          className={cn(
            "leading-none font-black tabular-nums",
            "text-base sm:text-lg",
            muted ? "text-foreground/55" : "text-foreground"
          )}
        >
          {time}
        </span>
      </div>

      <div className="relative flex w-10 shrink-0 justify-center">
        {!isLast ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-10 h-[calc(100%-2.5rem)]",
              muted ? "border-l-2 border-dashed border-border" : "w-0.5 rounded-full bg-foreground/15"
            )}
          />
        ) : null}

        <div
          className={cn(
            "relative z-10 flex size-10 items-center justify-center rounded-full",
            muted
              ? "border-2 border-dashed border-border bg-card text-foreground/50"
              : "bg-primary text-primary-foreground shadow-sm"
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>

      {children}
    </li>
  )
}

function TimelineRow({ item, isLast }: { item: ScheduleItem; isLast: boolean }) {
  return (
    <TimelineRail time={item.time} category={item.category} isLast={isLast}>
      <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <p className="text-base leading-snug font-bold text-foreground text-pretty">
            {item.place}
          </p>
          <CategoryPill category={item.category} />
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty">
          {item.activity}
        </p>
      </div>
    </TimelineRail>
  )
}

function TimelinePlaceholder({
  slot,
  isLast,
  onSelect,
}: {
  slot: ScheduleSlotTemplate
  isLast: boolean
  onSelect: () => void
}) {
  return (
    <TimelineRail time={slot.time} category={slot.category} isLast={isLast} muted>
      <button
        type="button"
        onClick={onSelect}
        aria-label={`${slot.title} 입력`}
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-2.5 rounded-xl border-2 border-dashed border-border bg-secondary/40 p-4 text-left transition-colors hover:border-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between sm:gap-3"
      >
        <span className="min-w-0 text-sm leading-snug font-semibold text-foreground/70 text-pretty">
          {slot.title}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs leading-none font-bold text-primary-foreground">
          <Plus aria-hidden="true" className="size-3.5" />
          일정 입력
        </span>
      </button>
    </TimelineRail>
  )
}

export function ScheduleTimeline({
  trip,
  activeDay,
  onDayChange,
}: {
  trip: Trip
  activeDay: string
  onDayChange: (dayId: string) => void
}) {
  const { scheduleByTrip } = useTrips()
  const [draft, setDraft] = useState<{
    category: ScheduleItem["category"]
    time: string
  } | null>(null)

  const days = buildTripDays(trip)
  const current = days.find((day) => day.id === activeDay) ?? days[0]
  const items = scheduleByTrip[trip.id]?.[current.id] ?? []
  const isEmpty = items.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-bold">여행 일정</CardTitle>
        <CardDescription>
          {current.date} ({current.weekday}) · {current.city} ·{" "}
          {isEmpty ? "기본 일정 템플릿" : `일정 ${items.length}개`}
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="일정 추가"
            onClick={() => setDraft({ category: "관광", time: "12:00" })}
          >
            <Plus />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-4">
          <div
            role="tablist"
            aria-label="일정 일자 선택"
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {days.map((day) => {
              const isActive = day.id === current.id
              return (
                <button
                  key={day.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onDayChange(day.id)}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  )}
                >
                  {day.label}
                  <span className="font-mono text-xs tabular-nums opacity-70">{day.date}</span>
                </button>
              )
            })}
          </div>

          {isEmpty ? (
            <p className="rounded-xl bg-secondary/60 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground text-pretty">
              아직 등록된 일정이 없어요. 기본 일정 폼을 눌러 바로 채워 보세요.
            </p>
          ) : null}

          <ol className="flex flex-col">
            {isEmpty
              ? defaultScheduleSlots.map((slot, index) => (
                  <TimelinePlaceholder
                    key={slot.key}
                    slot={slot}
                    isLast={index === defaultScheduleSlots.length - 1}
                    onSelect={() => setDraft({ category: slot.category, time: slot.time })}
                  />
                ))
              : items.map((item, index) => (
                  <TimelineRow key={item.id} item={item} isLast={index === items.length - 1} />
                ))}
          </ol>

          <Button
            type="button"
            variant="outline"
            onClick={() => setDraft({ category: "관광", time: "12:00" })}
            className="rounded-full border-dashed font-semibold"
          >
            <Plus data-icon="inline-start" />
            사용자 정의 일정 추가
          </Button>
        </div>
      </CardContent>

      <ScheduleDialog
        key={draft ? `${current.id}-${draft.category}-${draft.time}` : "closed"}
        tripId={trip.id}
        dayId={current.id}
        dayLabel={`${current.label} (${current.date})`}
        initialCategory={draft?.category ?? "관광"}
        initialTime={draft?.time ?? "12:00"}
        open={draft !== null}
        onOpenChange={(next) => {
          if (!next) setDraft(null)
        }}
      />
    </Card>
  )
}
