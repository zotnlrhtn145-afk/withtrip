"use client"

import { useState, type ReactNode } from "react"
import { CalendarDays, Check, Crown, MapPin, Users } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { useTrips } from "@/components/trips-store"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { formatTripDuration, getTripMembers, type Trip } from "@/lib/trip-data"

function formatLabel(date: Date) {
  return `${date.getFullYear()}.${`${date.getMonth() + 1}`.padStart(2, "0")}.${`${date.getDate()}`.padStart(2, "0")}`
}

function parseTripDate(value: string) {
  const [year, month, day] = value.split(".").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

/** "Japan · Osaka & Kyoto" -> { country, region } */
function splitDestination(value: string) {
  const [country, ...rest] = value.split("·")
  const region = rest.join("·").trim()
  return {
    country: country.trim(),
    region: region || country.trim(),
  }
}

export function EditTripDialog({ trip, trigger }: { trip: Trip; trigger: ReactNode }) {
  const { members, updateTrip } = useTrips()
  const [open, setOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const [title, setTitle] = useState(trip.title)
  const [destination, setDestination] = useState(`${trip.country} · ${trip.region}`)
  const [range, setRange] = useState<DateRange | undefined>({
    from: parseTripDate(trip.startDate),
    to: parseTripDate(trip.endDate),
  })
  const [memberIds, setMemberIds] = useState(trip.memberIds)

  // Re-seed the form from the trip whenever the modal is (re)opened.
  const syncFromTrip = () => {
    setTitle(trip.title)
    setDestination(`${trip.country} · ${trip.region}`)
    setRange({ from: parseTripDate(trip.startDate), to: parseTripDate(trip.endDate) })
    setMemberIds(trip.memberIds)
  }

  const draftMembers = getTripMembers({ ...trip, memberIds }, members)
  const hostId = trip.memberIds[0]

  const nights =
    range?.from && range?.to
      ? Math.max(
          0,
          Math.round((range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000))
        )
      : trip.nights

  const rangeLabel =
    range?.from && range?.to
      ? `${formatLabel(range.from)} ~ ${formatLabel(range.to)}`
      : range?.from
        ? `${formatLabel(range.from)} ~ 도착일 선택`
        : "출발일 ~ 도착일 선택"

  const canSubmit = Boolean(title.trim() && destination.trim() && range?.from && range?.to)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!range?.from || !range?.to) return
    const { country, region } = splitDestination(destination)
    updateTrip(trip.id, {
      title: title.trim(),
      country,
      region,
      startDate: range.from,
      endDate: range.to,
      memberIds,
    })
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) syncFromTrip()
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90svh] gap-5 overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">여행 정보 수정</DialogTitle>
          <DialogDescription>
            여행 이름과 일정, 함께하는 멤버를 한 번에 정리할 수 있어요.
          </DialogDescription>
        </DialogHeader>

        <form id="edit-trip-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-trip-title">여행 이름</FieldLabel>
              <Input
                id="edit-trip-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="오사카 · 교토 여행"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-trip-destination">목적지</FieldLabel>
              <Input
                id="edit-trip-destination"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                placeholder="Japan · Osaka &amp; Kyoto"
                required
              />
              <FieldDescription>
                <MapPin className="inline size-3 align-[-1px]" /> 국가와 도시를 · 로 구분해
                입력하세요.
              </FieldDescription>
            </Field>

            <Separator />

            <Field>
              <FieldLabel htmlFor="edit-trip-range">여행 일정 변경</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        id="edit-trip-range"
                        type="button"
                        variant="outline"
                        className="min-w-0 flex-1 justify-start rounded-xl font-medium tabular-nums"
                      />
                    }
                  >
                    <CalendarDays data-icon="inline-start" />
                    {rangeLabel}
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="range"
                      min={1}
                      numberOfMonths={1}
                      selected={range}
                      defaultMonth={range?.from}
                      formatters={{
                        formatWeekdayName: (date) =>
                          date.toLocaleDateString("ko-KR", { weekday: "narrow" }),
                        formatCaption: (date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
                      }}
                      onSelect={(next, triggerDate) => {
                        // A complete range already exists: restart from the clicked day
                        // instead of extending the saved range.
                        if (range?.from && range?.to) {
                          setRange({ from: triggerDate, to: undefined })
                          return
                        }
                        setRange(next)
                        if (next?.from && next?.to) setCalendarOpen(false)
                      }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
                <Badge className="h-9 shrink-0 rounded-full px-3 text-sm font-bold tabular-nums">
                  {formatTripDuration(nights, nights + 1)}
                </Badge>
              </div>
              <FieldDescription>출발일을 누른 뒤 도착일을 선택하세요.</FieldDescription>
            </Field>

            <Separator />

            <Field>
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <FieldLabel className="mb-0">참여 멤버 ({draftMembers.length}명)</FieldLabel>
              </div>

              <ul className="max-h-52 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {draftMembers.map((member) => {
                  const isHost = member.id === hostId
                  return (
                    <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className={`${member.color} text-xs font-semibold`}>
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">{member.name}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {isHost ? (
                            <>
                              <Crown className="size-3" />
                              모임장
                            </>
                          ) : (
                            "참여 중"
                          )}
                        </span>
                      </div>
                      {isHost ? null : (
                        <button
                          type="button"
                          onClick={() =>
                            setMemberIds((current) => current.filter((id) => id !== member.id))
                          }
                          aria-label={`${member.name} 멤버 삭제`}
                          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-none"
                        >
                          삭제
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
              <FieldDescription>
                모임장은 삭제할 수 없어요. 삭제한 멤버는 수정 완료 시 반영됩니다.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter className="rounded-b-2xl">
          <DialogClose
            render={
              <Button type="button" variant="outline" className="rounded-full font-semibold">
                취소
              </Button>
            }
          />
          <Button
            type="submit"
            form="edit-trip-form"
            disabled={!canSubmit}
            className="rounded-full font-bold"
          >
            <Check data-icon="inline-start" />
            수정 완료
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
