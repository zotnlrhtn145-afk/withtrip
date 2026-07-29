"use client"

import { useState } from "react"
import { Calendar, Plus } from "lucide-react"

import { useTrips } from "@/components/trips-store"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ScheduleItem } from "@/lib/trip-data"
import { scheduleCategories } from "@/lib/trip-itinerary"
import { cn } from "@/lib/utils"

const inputClassName =
  "rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus-visible:border-amber-400 focus-visible:ring-1 focus-visible:ring-amber-400"

export function ScheduleDialog({
  tripId,
  dayId,
  dayLabel,
  initialCategory,
  initialTime,
  open,
  onOpenChange,
}: {
  tripId: string
  dayId: string
  dayLabel: string
  initialCategory: ScheduleItem["category"]
  initialTime: string
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const { addScheduleItem } = useTrips()
  const [category, setCategory] = useState<ScheduleItem["category"]>(initialCategory)
  const [time, setTime] = useState(initialTime)
  const [place, setPlace] = useState("")
  const [activity, setActivity] = useState("")

  const canSubmit = Boolean(time && place.trim())

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    addScheduleItem(tripId, dayId, {
      time,
      place: place.trim(),
      activity: activity.trim() || `${category} 일정`,
      category,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] gap-0 overflow-y-auto rounded-2xl border-zinc-200 bg-white p-0 sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b border-zinc-100 px-5 pt-5 pr-12 pb-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-zinc-900">
            <Calendar className="size-5 text-zinc-900" strokeWidth={1.75} />
            일정 등록
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-zinc-500">
            {dayLabel}에 추가할 일정을 입력하면 타임라인에 정리해 드려요.
          </DialogDescription>
        </DialogHeader>

        <form id="schedule-form" onSubmit={handleSubmit} className="flex flex-col gap-5 bg-white px-5 py-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="schedule-category" className="text-zinc-700">
                카테고리
              </FieldLabel>
              <div id="schedule-category" className="flex flex-wrap gap-2">
                {scheduleCategories.map((item) => {
                  const active = category === item
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCategory(item)}
                      className={cn(
                        "rounded-full px-3.5 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-amber-400 font-semibold text-zinc-900 shadow-sm"
                          : "bg-zinc-100 font-medium text-zinc-600 hover:bg-zinc-200"
                      )}
                    >
                      {item}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="schedule-time" className="text-zinc-700">
                시간
              </FieldLabel>
              <Input
                id="schedule-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className={cn(inputClassName, "w-32 tabular-nums")}
                required
              />
              <FieldDescription className="text-zinc-400">
                등록하면 시간 순서대로 자동 정렬됩니다.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="schedule-place" className="text-zinc-700">
                장소
              </FieldLabel>
              <Input
                id="schedule-place"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                placeholder="예) 간사이 국제공항"
                className={inputClassName}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="schedule-activity" className="text-zinc-700">
                메모
              </FieldLabel>
              <Textarea
                id="schedule-activity"
                value={activity}
                onChange={(event) => setActivity(event.target.value)}
                placeholder="예) 입국 심사 후 하루카 특급 탑승"
                rows={3}
                className={cn(inputClassName, "resize-none")}
              />
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter className="mx-0 mb-0 gap-2 rounded-b-2xl border-t border-zinc-100 bg-white p-4 sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full px-4 py-2.5 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            취소
          </button>
          <button
            type="submit"
            form="schedule-form"
            disabled={!canSubmit}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-amber-400 px-6 py-2.5 text-xs font-semibold text-zinc-900 transition-colors hover:bg-amber-500 disabled:opacity-60"
          >
            <Plus className="size-3.5" />
            등록하기
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
