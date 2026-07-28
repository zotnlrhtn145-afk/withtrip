"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BedDouble,
  CalendarDays,
  Camera,
  ChevronDown,
  Clock,
  Coffee,
  Loader2,
  MapPin,
  Phone,
  Plane,
  Plus,
  Star,
  Trash2,
  Utensils,
  type LucideIcon,
} from "lucide-react"

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
  fetchSavedPlacesByTripId,
  toScheduleCategory,
  type SavedPlace,
} from "@/lib/saved-places-api"
import {
  deleteSchedule,
  fetchSchedulesByTripId,
  getErrorMessage,
  getScheduleDayMeta,
  insertSchedule,
  SCHEDULE_CATEGORIES,
  sortSchedules,
  type ScheduleCategory,
  type TripSchedule,
} from "@/lib/schedules-api"
import {
  toWishlistKind,
  wishlistCategories,
  WISHLIST_CATEGORY_VALUE,
  type WishlistKind,
} from "@/lib/trip-itinerary"
import { cn } from "@/lib/utils"

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const

const CATEGORY_BADGE: Record<ScheduleCategory, string> = {
  이동: "bg-amber-100 text-amber-800",
  숙소: "bg-indigo-100 text-indigo-800",
  관광: "bg-emerald-100 text-emerald-800",
  식사: "bg-orange-100 text-orange-800",
  카페: "bg-amber-50 text-amber-900",
}

const CATEGORY_ICON: Record<ScheduleCategory, LucideIcon> = {
  이동: Plane,
  숙소: BedDouble,
  관광: Camera,
  식사: Utensils,
  카페: Coffee,
}

function ScheduleRegisterModal({
  open,
  onOpenChange,
  tripId,
  tripStartDate,
  defaultDayIndex,
  onSaved,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  tripId: string
  tripStartDate: string
  defaultDayIndex: number
  onSaved: (item: TripSchedule) => void
}) {
  const [dayNumber, setDayNumber] = useState(1)
  const [category, setCategory] = useState<ScheduleCategory>("관광")
  const [placeName, setPlaceName] = useState("")
  const [visitTime, setVisitTime] = useState("12:00")
  const [address, setAddress] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [memo, setMemo] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wishlistOpen, setWishlistOpen] = useState(false)
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([])
  const [wishlistLoading, setWishlistLoading] = useState(false)

  const dayMeta = useMemo(
    () => getScheduleDayMeta(tripStartDate, dayNumber),
    [tripStartDate, dayNumber]
  )

  const groupedPlaces = useMemo(() => {
    const groups: Record<WishlistKind, SavedPlace[]> = {
      restaurant: [],
      bar: [],
      stay: [],
    }
    for (const place of savedPlaces) {
      groups[toWishlistKind(place.category)].push(place)
    }
    return groups
  }, [savedPlaces])

  const loadSavedPlaces = useCallback(async () => {
    if (!tripId) {
      setSavedPlaces([])
      return
    }
    setWishlistLoading(true)
    try {
      const rows = await fetchSavedPlacesByTripId(tripId)
      setSavedPlaces(rows)
    } catch (err) {
      console.error("[ScheduleRegisterModal] saved places load failed:", err)
      setSavedPlaces([])
    } finally {
      setWishlistLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    if (!open) return
    setDayNumber(Math.min(7, Math.max(1, defaultDayIndex || 1)))
    setCategory("관광")
    setPlaceName("")
    setVisitTime("12:00")
    setAddress("")
    setPhoneNumber("")
    setMemo("")
    setError(null)
    setSaving(false)
    setWishlistOpen(false)
    void loadSavedPlaces()
  }, [open, defaultDayIndex, loadSavedPlaces])

  const toggleWishlist = () => {
    setWishlistOpen((current) => {
      const next = !current
      if (next) void loadSavedPlaces()
      return next
    })
  }

  const applySavedPlace = (place: SavedPlace) => {
    const wishlistKind = toWishlistKind(place.category)
    setPlaceName(place.placeName)
    setAddress(place.address)
    setPhoneNumber(place.phoneNumber)
    setCategory(toScheduleCategory(place.category, wishlistKind))
    setMemo(place.memo)
    setWishlistOpen(false)
    setError(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    if (!placeName.trim()) {
      setError("장소를 입력해 주세요")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const saved = await insertSchedule({
        tripId,
        dayNumber,
        category,
        placeName: placeName.trim(),
        visitTime,
        address: address.trim(),
        phoneNumber: phoneNumber.trim(),
        memo: memo.trim(),
      })
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      console.error("[ScheduleRegisterModal] save failed:", err)
      if (err && typeof err === "object") {
        console.error(
          "[ScheduleRegisterModal] error.message:",
          (err as { message?: unknown }).message ?? getErrorMessage(err)
        )
        console.error("[ScheduleRegisterModal] error.details:", (err as { details?: unknown }).details)
        console.error("[ScheduleRegisterModal] error.hint:", (err as { hint?: unknown }).hint)
        console.error("[ScheduleRegisterModal] error.code:", (err as { code?: unknown }).code)
      }
      setError(getErrorMessage(err) || "일정 저장에 실패했어요.")
    } finally {
      setSaving(false)
    }
  }

  const visitDateLabel = dayMeta.visitDate || dayMeta.dateLabel || "—"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-lg">
        <DialogHeader className="gap-2 px-5 pt-5 pr-12 pb-0">
          <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <CalendarDays className="size-5" />
            </span>
            일정 등록
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {dayNumber}일차 ({visitDateLabel})에 추가할 일정을 입력하면 타임라인에 정리해 드려요.
          </DialogDescription>
        </DialogHeader>

        <form
          id="schedule-register-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-5 px-5 py-5"
        >
          <FieldGroup>
            <Field>
              <FieldLabel>카테고리</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {SCHEDULE_CATEGORIES.map((item) => {
                  const active = category === item
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCategory(item)}
                      className={cn(
                        "rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      )}
                    >
                      {item}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="schedule-time">시간</FieldLabel>
              <div className="relative">
                <Input
                  id="schedule-time"
                  type="time"
                  value={visitTime}
                  onChange={(event) => setVisitTime(event.target.value)}
                  className="rounded-xl pr-10 tabular-nums"
                />
                <Clock
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
              </div>
              <FieldDescription>등록하면 시간 순서대로 자동 정렬됩니다.</FieldDescription>
            </Field>

            <Field>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="schedule-place">장소</FieldLabel>
                <button
                  type="button"
                  onClick={toggleWishlist}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                    wishlistOpen
                      ? "bg-amber-400 text-foreground"
                      : "bg-amber-50 text-amber-900 hover:bg-amber-100"
                  )}
                >
                  <Star className="size-3.5 fill-current" />
                  가고 싶은 곳에서 가져오기
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", wishlistOpen && "rotate-180")}
                  />
                </button>
              </div>

              {wishlistOpen ? (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-amber-100 bg-amber-50/40 shadow-sm">
                  {wishlistLoading ? (
                    <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      불러오는 중…
                    </div>
                  ) : savedPlaces.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      저장된 가고 싶은 곳이 없어요.
                      <br />
                      아래에서 위시리스트에 먼저 추가해 주세요.
                    </p>
                  ) : (
                    <div className="flex flex-col">
                      {wishlistCategories.map((group) => {
                        const items = groupedPlaces[group.kind]
                        if (items.length === 0) return null
                        return (
                          <div key={group.kind}>
                            <p className="sticky top-0 bg-amber-100/80 px-3 py-1.5 text-[11px] font-bold tracking-wide text-amber-900 uppercase">
                              {group.label}
                            </p>
                            <ul className="divide-y divide-amber-100/80">
                              {items.map((place) => (
                                <li key={place.id}>
                                  <button
                                    type="button"
                                    onClick={() => applySavedPlace(place)}
                                    className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-amber-100/60"
                                  >
                                    <span className="flex items-center justify-between gap-2">
                                      <span className="truncate text-sm font-bold text-foreground">
                                        {place.placeName}
                                      </span>
                                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                                        {WISHLIST_CATEGORY_VALUE[toWishlistKind(place.category)]}
                                      </span>
                                    </span>
                                    {place.address ? (
                                      <span className="truncate text-xs text-muted-foreground">
                                        {place.address}
                                      </span>
                                    ) : null}
                                    {place.phoneNumber ? (
                                      <span className="truncate text-xs tabular-nums text-muted-foreground">
                                        {place.phoneNumber}
                                      </span>
                                    ) : null}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              <Input
                id="schedule-place"
                value={placeName}
                onChange={(event) => setPlaceName(event.target.value)}
                placeholder="예) 간사이 국제공항"
                className="mt-2 rounded-xl"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="schedule-address">주소</FieldLabel>
              <Input
                id="schedule-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="예) 1-1 Senshu-kuko Naka, Izumisano"
                className="rounded-xl"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="schedule-phone">전화번호</FieldLabel>
              <Input
                id="schedule-phone"
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="예) +81 72-455-2500"
                className="rounded-xl"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="schedule-memo">메모</FieldLabel>
              <Textarea
                id="schedule-memo"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="예) 입국 심사 후 하루카 특급 탑승"
                rows={3}
                className="resize-none rounded-xl"
              />
            </Field>
          </FieldGroup>

          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}
        </form>

        <DialogFooter className="mx-0 mb-0 rounded-b-2xl border-t bg-secondary/60 p-4 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-full font-semibold text-foreground"
          >
            취소
          </Button>
          <Button
            type="submit"
            form="schedule-register-form"
            disabled={saving}
            className="rounded-full font-semibold"
          >
            {saving ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            등록하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TimelineItem({
  item,
  isLast,
  deleting,
  onDelete,
}: {
  item: TripSchedule
  isLast: boolean
  deleting: boolean
  onDelete: (id: string) => void
}) {
  const Icon = CATEGORY_ICON[item.category] ?? MapPin
  const timeLabel = item.visitTime || "--:--"

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0 sm:gap-4">
      {/* Left: time + axis */}
      <div className="flex w-[3.25rem] shrink-0 flex-col items-end pt-2 sm:w-14">
        <span className="text-sm leading-none font-bold tabular-nums text-foreground sm:text-base">
          {timeLabel}
        </span>
      </div>

      <div className="relative flex w-10 shrink-0 flex-col items-center">
        <span className="relative z-10 flex size-10 items-center justify-center rounded-full bg-amber-50 text-amber-500 shadow-sm ring-1 ring-amber-100">
          <Icon className="size-5" strokeWidth={2.25} />
        </span>
        {!isLast ? (
          <span
            aria-hidden="true"
            className="absolute top-10 bottom-0 w-0.5 rounded-full bg-slate-200"
          />
        ) : null}
      </div>

      {/* Right: content card */}
      <div className="media-card min-w-0 flex-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-base leading-snug font-bold text-pretty text-slate-900">
                {item.placeName}
              </p>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  CATEGORY_BADGE[item.category]
                )}
              >
                {item.category}
              </span>
            </div>
            {item.memo ? (
              <p className="mt-1.5 text-xs leading-relaxed text-pretty text-gray-500">{item.memo}</p>
            ) : null}
            {item.address || item.phoneNumber ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-500">
                {item.address ? (
                  <span className="inline-flex min-w-0 items-start gap-1">
                    <MapPin className="mt-0.5 size-3 shrink-0" />
                    <span className="text-pretty">{item.address}</span>
                  </span>
                ) : null}
                {item.address && item.phoneNumber ? (
                  <span aria-hidden="true" className="text-gray-300">
                    ·
                  </span>
                ) : null}
                {item.phoneNumber ? (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Phone className="size-3 shrink-0" />
                    <span>{item.phoneNumber}</span>
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="일정 삭제"
            disabled={deleting}
            onClick={() => onDelete(item.id)}
            className="shrink-0 text-gray-400 hover:text-destructive"
          >
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        </div>
      </div>
    </li>
  )
}

/**
 * Supabase `trip_schedules` 연동 여행 일정 섹션 (타임라인 UI).
 */
export function ScheduleSection({
  tripId,
  tripStartDate = "",
  tripCity = "",
}: {
  tripId: string
  tripStartDate?: string
  /** Shown in subtitle, e.g. 오사카 */
  tripCity?: string
}) {
  const [selectedDay, setSelectedDay] = useState(1)
  const [items, setItems] = useState<TripSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSchedulesByTripId(tripId)
      setItems(data)
    } catch (err) {
      console.error("[ScheduleSection] load failed:", err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    void load()
  }, [load])

  const visibleItems = useMemo(() => {
    return sortSchedules(items.filter((item) => item.dayNumber === selectedDay))
  }, [items, selectedDay])

  const activeMeta = getScheduleDayMeta(tripStartDate, selectedDay)
  const cityLabel = tripCity.trim() || "여행지"
  const subtitleParts = [
    activeMeta.dateLabel
      ? `${activeMeta.dateLabel}${activeMeta.weekday ? `(${activeMeta.weekday})` : ""}`
      : null,
    cityLabel,
    `일정 ${visibleItems.length}개`,
  ].filter(Boolean)

  const handleDelete = async (id: string) => {
    if (!window.confirm("이 일정을 삭제할까요?")) return
    setDeletingId(id)
    try {
      const ok = await deleteSchedule(id)
      if (ok) setItems((current) => current.filter((item) => item.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const openAdd = () => setModalOpen(true)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="mb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Itinerary
          </p>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">여행 일정</h2>
          <p className="text-sm text-slate-500">{subtitleParts.join(" · ")}</p>
        </div>
        <button
          type="button"
          aria-label="일정 추가"
          onClick={openAdd}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm transition-all hover:bg-slate-800"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div
        role="tablist"
        aria-label="일차 선택"
        className="no-scrollbar flex gap-2 overflow-x-auto pb-1"
      >
        {DAY_OPTIONS.map((day) => {
          const meta = getScheduleDayMeta(tripStartDate, day)
          const active = selectedDay === day
          return (
            <button
              key={day}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedDay(day)}
              className={cn(
                "touch-press inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs transition-all",
                active
                  ? "bg-slate-900 font-bold text-white shadow-sm"
                  : "bg-slate-100 font-medium text-slate-500 hover:bg-slate-200/70"
              )}
            >
              <span>{day}일차</span>
              {meta.dateLabel ? (
                <span
                  className={cn(
                    "tabular-nums",
                    active ? "text-white/70" : "text-slate-400"
                  )}
                >
                  {meta.dateLabel}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
          <Loader2 className="size-6 animate-spin text-amber-500" />
          <p className="text-sm text-slate-500">일정을 불러오는 중…</p>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <MapPin className="size-5" />
          </span>
          <p className="text-sm font-bold text-slate-900">아직 등록된 일정이 없어요</p>
          <p className="mt-1 text-xs text-slate-500">첫 번째 장소를 등록해보세요!</p>
        </div>
      ) : (
        <ol className="px-0.5 pt-1">
          {visibleItems.map((item, index) => (
            <TimelineItem
              key={item.id}
              item={item}
              isLast={index === visibleItems.length - 1}
              deleting={deletingId === item.id}
              onDelete={(id) => void handleDelete(id)}
            />
          ))}
        </ol>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={openAdd}
        className="h-11 w-full rounded-full border-dashed border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-700 hover:border-amber-400 hover:bg-white"
      >
        <Plus data-icon="inline-start" />
        사용자 정의 일정 추가
      </Button>

      <ScheduleRegisterModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        tripId={tripId}
        tripStartDate={tripStartDate}
        defaultDayIndex={selectedDay}
        onSaved={(item) => {
          setItems((current) => {
            const without = current.filter((row) => row.id !== item.id)
            return sortSchedules([...without, item])
          })
          setSelectedDay(item.dayNumber)
          void load()
        }}
      />
    </section>
  )
}
