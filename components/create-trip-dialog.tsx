"use client"

import { useMemo, useState, type ReactNode } from "react"
import { CalendarDays, Plus, UserRoundPlus, X } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { SearchableSelect } from "@/components/searchable-select"
import { useTrips } from "@/components/trips-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
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
import type { Trip } from "@/lib/trip-data"
import {
  filterCities,
  findCountryByName,
  travelCountries,
} from "@/lib/travel-destinations"

function formatLabel(date: Date) {
  return `${date.getFullYear()}.${`${date.getMonth() + 1}`.padStart(2, "0")}.${`${date.getDate()}`.padStart(2, "0")}`
}

export function CreateTripDialog({
  trigger,
  onCreated,
  open: openProp,
  onOpenChange,
}: {
  trigger?: ReactNode
  /** Called after successful create. Prefer staying on home — do not open trip detail here. */
  onCreated?: (trip: Trip) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { addTrip, setQuery } = useTrips()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  const [country, setCountry] = useState("")
  const [region, setRegion] = useState("")
  const [title, setTitle] = useState("")
  const [range, setRange] = useState<DateRange | undefined>()
  const [inviteInput, setInviteInput] = useState("")
  const [invites, setInvites] = useState<string[]>([])
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const countryOptions = useMemo(
    () =>
      travelCountries.map((item) => ({
        value: item.nameKo,
        label: item.nameKo,
        description: item.nameEn,
      })),
    []
  )

  const cityOptions = useMemo(() => {
    const cities = filterCities(country, "")
    return cities.map((city) => ({
      value: city,
      label: city,
    }))
  }, [country])

  const selectedCountry = findCountryByName(country)

  const reset = () => {
    setCountry("")
    setRegion("")
    setTitle("")
    setRange(undefined)
    setInviteInput("")
    setInvites([])
    setSaving(false)
    setError(null)
  }

  const addInvite = () => {
    const value = inviteInput.trim()
    if (!value || invites.includes(value)) {
      setInviteInput("")
      return
    }
    setInvites((current) => [...current, value])
    setInviteInput("")
  }

  const rangeLabel =
    range?.from && range?.to
      ? `${formatLabel(range.from)} — ${formatLabel(range.to)}`
      : range?.from
        ? `${formatLabel(range.from)} — 종료일 선택`
        : "출발일 ~ 도착일 선택"

  const canSubmit = Boolean(
    String(country ?? "").trim() &&
      String(title ?? "").trim() &&
      range?.from &&
      range?.to
  )

  const handleCountryChange = (next: string) => {
    const prev = findCountryByName(country)
    const upcoming = findCountryByName(next)
    setCountry(next)
    if (prev?.code !== upcoming?.code) {
      setRegion("")
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!range?.from || !range?.to || saving) return

    const nextCountry = String(country ?? "").trim()
    const nextCity = String(region ?? "").trim()
    const nextTitle = String(title ?? "").trim()
    if (!nextCountry || !nextTitle) {
      setError("국가와 여행 제목을 입력해 주세요.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const trip = await addTrip({
        country: nextCountry,
        region: nextCity,
        title: nextTitle,
        startDate: range.from,
        endDate: range.to,
        invites,
      })
      // Close + reset form, clear search filter so the new card is visible on home.
      setOpen(false)
      reset()
      setQuery("")
      onCreated?.(trip)
    } catch (err) {
      console.error("[CreateTripDialog.onSubmit] Supabase error:", err)
      console.error(
        "[CreateTripDialog.onSubmit] error.message:",
        err && typeof err === "object" && "message" in err
          ? (err as { message: unknown }).message
          : undefined
      )
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message ?? "")
          : err instanceof Error
            ? err.message
            : "여행 저장에 실패했어요."
      setError(message || "여행 저장에 실패했어요.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      {trigger ? <DialogTrigger render={trigger as React.ReactElement} /> : null}
      <DialogContent className="max-h-[90svh] gap-5 overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">새 여행 만들기</DialogTitle>
          <DialogDescription>
            목적지와 일정을 입력하면 여행 카드가 바로 만들어져요.
          </DialogDescription>
        </DialogHeader>

        <form id="create-trip-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="trip-country">국가</FieldLabel>
                <SearchableSelect
                  id="trip-country"
                  value={country}
                  onChange={handleCountryChange}
                  options={countryOptions}
                  placeholder="국가 검색 · 선택"
                  emptyText="일치하는 국가가 없어요"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="trip-region">도시 · 지역</FieldLabel>
                <SearchableSelect
                  id="trip-region"
                  value={region}
                  onChange={setRegion}
                  options={cityOptions}
                  placeholder={
                    selectedCountry
                      ? `${selectedCountry.nameKo} 도시 검색`
                      : "먼저 국가를 선택하세요"
                  }
                  emptyText={
                    selectedCountry
                      ? "목록에 없으면 직접 입력할 수 있어요"
                      : "국가를 먼저 선택해 주세요"
                  }
                  allowCustom
                  customHint="예: 오사카 & 교토 처럼 여러 지역을 직접 입력할 수 있어요"
                  disabled={!country.trim()}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="trip-title">여행 제목</FieldLabel>
              <Input
                id="trip-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="포항 미식 투어"
                className="rounded-xl"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="trip-range">여행 기간</FieldLabel>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      id="trip-range"
                      type="button"
                      variant="outline"
                      className="w-full justify-start rounded-xl font-medium tabular-nums"
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
                    disabled={{ before: new Date() }}
                    formatters={{
                      formatWeekdayName: (date) =>
                        date.toLocaleDateString("ko-KR", { weekday: "narrow" }),
                      formatCaption: (date) =>
                        `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
                    }}
                    onSelect={(next) => {
                      setRange(next)
                      if (next?.from && next?.to) setCalendarOpen(false)
                    }}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
              <FieldDescription>출발일을 누른 뒤 도착일을 선택하세요.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="trip-invite">멤버 초대</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="trip-invite"
                  value={inviteInput}
                  onChange={(event) => setInviteInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return
                    if (event.nativeEvent.isComposing || event.keyCode === 229) return
                    event.preventDefault()
                    addInvite()
                  }}
                  placeholder="이메일 또는 닉네임"
                  className="rounded-xl"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addInvite}
                  className="shrink-0 rounded-xl font-semibold"
                >
                  <UserRoundPlus data-icon="inline-start" />
                  추가
                </Button>
              </div>
              {invites.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {invites.map((invite) => (
                    <Badge key={invite} variant="secondary" className="gap-1 rounded-full pr-1">
                      {invite}
                      <button
                        type="button"
                        onClick={() =>
                          setInvites((current) => current.filter((item) => item !== invite))
                        }
                        aria-label={`${invite} 초대 취소`}
                        className="flex size-4 items-center justify-center rounded-full hover:bg-foreground/10"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <FieldDescription>Enter를 눌러 여러 명을 초대할 수 있어요.</FieldDescription>
              )}
            </Field>
          </FieldGroup>
          {error ? (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </form>

        <DialogFooter className="rounded-b-2xl">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            className="rounded-full font-semibold"
          >
            취소
          </Button>
          <Button
            type="submit"
            form="create-trip-form"
            disabled={!canSubmit || saving}
            className="rounded-full font-semibold"
          >
            <Plus data-icon="inline-start" />
            {saving ? "저장 중…" : "여행 만들기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
