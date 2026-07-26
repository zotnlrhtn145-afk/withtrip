"use client"

import { useState } from "react"
import { CalendarClock, Plus } from "lucide-react"

import { useTrips } from "@/components/trips-store"
import { Button } from "@/components/ui/button"
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
      <DialogContent className="max-h-[90svh] gap-5 overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarClock className="size-4" />
            </span>
            일정 등록
          </DialogTitle>
          <DialogDescription>
            {dayLabel}에 추가할 일정을 입력하면 타임라인에 정리해 드려요.
          </DialogDescription>
        </DialogHeader>

        <form id="schedule-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="schedule-category">카테고리</FieldLabel>
              <div id="schedule-category" className="flex flex-wrap gap-2">
                {scheduleCategories.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant={category === item ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategory(item)}
                    className="rounded-full font-semibold"
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="schedule-time">시간</FieldLabel>
              <Input
                id="schedule-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="w-32 rounded-xl tabular-nums"
                required
              />
              <FieldDescription>등록하면 시간 순서대로 자동 정렬됩니다.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="schedule-place">장소</FieldLabel>
              <Input
                id="schedule-place"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                placeholder="예) 간사이 국제공항"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="schedule-activity">메모</FieldLabel>
              <Textarea
                id="schedule-activity"
                value={activity}
                onChange={(event) => setActivity(event.target.value)}
                placeholder="예) 입국 심사 후 하루카 특급 탑승"
                rows={3}
                className="resize-none"
              />
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter className="rounded-b-2xl">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-full font-semibold"
          >
            취소
          </Button>
          <Button
            type="submit"
            form="schedule-form"
            disabled={!canSubmit}
            className="rounded-full font-semibold"
          >
            <Plus data-icon="inline-start" />
            등록하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
