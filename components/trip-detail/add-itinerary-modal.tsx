"use client"

import { useEffect, useState } from "react"
import { CalendarClock, Loader2, Plus } from "lucide-react"

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
import {
  getErrorMessage,
  insertItinerary,
  ITINERARY_CATEGORIES,
  type ItineraryCategory,
  type ItineraryItem,
} from "@/lib/itineraries-api"
import { type TripDayMeta } from "@/lib/trip-itinerary"
import { cn } from "@/lib/utils"

export function AddItineraryModal({
  open,
  onOpenChange,
  tripId,
  days,
  defaultDayIndex,
  onCreated,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  tripId: string
  days: TripDayMeta[]
  defaultDayIndex: number
  onCreated: (item: ItineraryItem) => void
}) {
  const [dayIndex, setDayIndex] = useState(defaultDayIndex)
  const [time, setTime] = useState("10:00")
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<ItineraryCategory>("관광")
  const [memo, setMemo] = useState("")
  const [cost, setCost] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDayIndex(Math.min(Math.max(1, defaultDayIndex), Math.max(1, days.length)))
    setTime("10:00")
    setTitle("")
    setCategory("관광")
    setMemo("")
    setCost("")
    setError(null)
    setSaving(false)
  }, [open, defaultDayIndex, days.length])

  const canSubmit = Boolean(title.trim() && time && dayIndex >= 1 && !saving)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const parsedCost = cost.trim() === "" ? null : Number(cost.replace(/,/g, ""))
      const item = await insertItinerary({
        tripId,
        dayIndex,
        time,
        title: title.trim(),
        category,
        memo: memo.trim(),
        estimatedCost:
          parsedCost === null || Number.isNaN(parsedCost) ? null : Math.max(0, parsedCost),
      })
      onCreated(item)
      onOpenChange(false)
    } catch (err) {
      console.error("[AddItineraryModal] save failed:", err)
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] gap-5 overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarClock className="size-4" />
            </span>
            일정 추가
          </DialogTitle>
          <DialogDescription>
            시간·장소·카테고리를 입력하면 해당 일차 타임라인에 바로 반영돼요.
          </DialogDescription>
        </DialogHeader>

        <form id="add-itinerary-form" onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel>일차 선택</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {days.map((day, index) => {
                  const n = index + 1
                  const active = dayIndex === n
                  return (
                    <Button
                      key={day.id}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => setDayIndex(n)}
                      className="rounded-full font-semibold"
                    >
                      Day {n}
                      <span className="ml-1 font-normal opacity-80">
                        · {day.date} {day.weekday}
                      </span>
                    </Button>
                  )
                })}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="itinerary-time">시간</FieldLabel>
              <Input
                id="itinerary-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="w-36 rounded-xl tabular-nums"
                required
              />
              <FieldDescription>저장 후 시간순으로 자동 정렬됩니다.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="itinerary-title">장소 / 일정명</FieldLabel>
              <Input
                id="itinerary-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="예) 도톤보리 산책"
                required
                className="rounded-xl"
              />
            </Field>

            <Field>
              <FieldLabel>카테고리</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {ITINERARY_CATEGORIES.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    size="sm"
                    variant={category === item ? "default" : "outline"}
                    onClick={() => setCategory(item)}
                    className={cn("rounded-full font-semibold", item === "식사" && "min-w-14")}
                  >
                    {item === "식사" ? "식당" : item}
                  </Button>
                ))}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="itinerary-memo">간단한 메모</FieldLabel>
              <Textarea
                id="itinerary-memo"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="예) 타코야키 먹고 글리코상 앞에서 사진"
                rows={3}
                className="resize-none rounded-xl"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="itinerary-cost">예상 비용 (원)</FieldLabel>
              <Input
                id="itinerary-cost"
                inputMode="numeric"
                value={cost}
                onChange={(event) => setCost(event.target.value.replace(/[^\d]/g, ""))}
                placeholder="선택 사항 · 예) 15000"
                className="rounded-xl tabular-nums"
              />
            </Field>
          </FieldGroup>

          {error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </form>

        <DialogFooter className="rounded-b-2xl">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-full font-semibold"
          >
            취소
          </Button>
          <Button
            type="submit"
            form="add-itinerary-form"
            disabled={!canSubmit}
            className="rounded-full font-semibold"
          >
            {saving ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            저장하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
