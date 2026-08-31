"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import {
  BedDouble,
  Calendar,
  Camera,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Coffee,
  Footprints,
  Crown,
  Loader2,
  LogOut,
  MapPin,
  Pencil,
  Phone,
  Plane,
  Plus,
  Search,
  Trash2,
  UserRound,
  Utensils,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { DirectionsMenu } from "@/components/directions-menu"
import { TimeSelect24 } from "@/components/ui/time-select-24"
import { AddSectionButton } from "@/components/trips/AddSectionButton"
import { searchGooglePlaces, type PlaceSearchResult } from "@/lib/places-search"
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
import { getCurrentUserId } from "@/lib/auth-session"
import {
  autoSaveScheduledPlace,
  fetchSavedPlacesByTripId,
  toScheduleCategory,
  type SavedPlace,
} from "@/lib/saved-places-api"
import {
  deleteSchedule,
  fetchSchedulesByTripId,
  getScheduleDayMeta,
  getScheduleErrorMessage,
  insertSchedule,
  isAutoSchedule,
  isScheduleAuthor,
  SCHEDULE_CATEGORIES,
  sortSchedules,
  updateSchedule,
  type ScheduleCategory,
  type TripSchedule,
} from "@/lib/schedules-api"
import { legLabel, legTone, straightKm } from "@/shared/trip-distance"
import {
  computePresence,
  isPresent,
  momentBefore,
  presenceEvents,
  type Presence,
  type PresenceEvent,
} from "@/shared/trip-presence"
import { dayDate } from "@/shared/trip-days"
import { fetchProfilesByIds, fetchTripOwnerId, type TripMember } from "@/lib/trip-members-api"
import { supabase } from "@/lib/supabase"
import {
  toWishlistKind,
  wishlistCategories,
  WISHLIST_CATEGORY_VALUE,
  type WishlistKind,
} from "@/lib/trip-itinerary"
import { PlaceDetailSheet, type PlaceDetailInput } from "@/components/place-detail-sheet"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

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

// 구글 장소 종류(kind) → 일정 카테고리 자동 선택
const SCHEDULE_CATEGORY_OF_KIND: Record<WishlistKind, ScheduleCategory> = {
  restaurant: "식사",
  bar: "카페",
  stay: "숙소",
  attraction: "관광",
}

function ScheduleRegisterModal({
  open,
  onOpenChange,
  tripId,
  tripStartDate,
  tripDays,
  defaultDayIndex,
  editingSchedule = null,
  onSaved,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  tripId: string
  tripStartDate: string
  tripDays: number
  defaultDayIndex: number
  editingSchedule?: TripSchedule | null
  onSaved: (item: TripSchedule) => void
}) {
  const maxDay = Math.max(1, tripDays)
  const isEditMode = Boolean(editingSchedule)
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
  // 구글 장소 검색(자동완성) — 선택 시 주소·전화번호·카테고리 자동 기입
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // 구글 검색에서 고른 장소 원본 — 일정 저장 시 나의 찜 + 여행클립 찜에 자동 등록하려고 보관.
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(null)

  const dayMeta = useMemo(
    () => getScheduleDayMeta(tripStartDate, dayNumber),
    [tripStartDate, dayNumber]
  )

  const groupedPlaces = useMemo(() => {
    const groups: Record<WishlistKind, SavedPlace[]> = {
      restaurant: [],
      bar: [],
      stay: [],
      attraction: [],
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

    if (editingSchedule) {
      setDayNumber(Math.min(maxDay, Math.max(1, editingSchedule.dayNumber || 1)))
      setCategory(editingSchedule.category)
      setPlaceName(editingSchedule.placeName)
      setVisitTime(editingSchedule.visitTime || "12:00")
      setAddress(editingSchedule.address)
      setPhoneNumber(editingSchedule.phoneNumber)
      setMemo(editingSchedule.memo)
    } else {
      setDayNumber(Math.min(maxDay, Math.max(1, defaultDayIndex || 1)))
      setCategory("관광")
      setPlaceName("")
      setVisitTime("12:00")
      setAddress("")
      setPhoneNumber("")
      setMemo("")
    }

    setError(null)
    setSaving(false)
    setWishlistOpen(false)
    setSearchQuery("")
    setSearchResults([])
    setSearching(false)
    setSearchOpen(false)
    void loadSavedPlaces()
  }, [open, defaultDayIndex, editingSchedule, loadSavedPlaces, maxDay])

  // 검색어 입력 → 300ms 디바운스 후 구글 장소 검색
  useEffect(() => {
    if (!open) return
    const q = searchQuery.trim()
    if (q.length < 1) {
      setSearchResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { results } = await searchGooglePlaces(q)
          if (cancelled) return
          setSearchResults(results)
          setSearchOpen(true)
        } catch (err) {
          console.error("[ScheduleRegisterModal] place search failed:", err)
          if (!cancelled) setSearchResults([])
        } finally {
          if (!cancelled) setSearching(false)
        }
      })()
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchQuery, open])

  const applyGooglePlace = (place: PlaceSearchResult) => {
    setPlaceName(place.placeName)
    if (place.address) setAddress(place.address)
    if (place.phoneNumber) setPhoneNumber(place.phoneNumber)
    if (place.kind && SCHEDULE_CATEGORY_OF_KIND[place.kind]) {
      setCategory(SCHEDULE_CATEGORY_OF_KIND[place.kind])
    }
    setSelectedPlace(place)
    setSearchQuery("")
    setSearchResults([])
    setSearchOpen(false)
    setWishlistOpen(false)
    setError(null)
  }

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
    setSelectedPlace(null) // 위시리스트에서 고른 건 이미 저장돼 있어 자동 등록 대상 아님
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
      const authUserId = await getCurrentUserId()
      const payload = {
        tripId,
        dayNumber,
        category,
        placeName: placeName.trim(),
        visitTime,
        address: address.trim(),
        phoneNumber: phoneNumber.trim(),
        memo: memo.trim(),
        createdBy: authUserId,
        /*
          ⚠️ 좌표를 같이 저장한다. 구글에서 고른 장소면 lat/lng 가 이미 손에
             있는데, 예전에는 찜에만 넣고 **일정에는 안 넣었다.** 그래서 일정이
             어디쯤인지 알 수 없어 거리·동선 계산이 불가능했다.
          ⚠️ **이름을 손으로 바꿨으면 좌표를 안 붙인다.** 다른 곳인데 예전
             좌표가 남으면 엉뚱한 거리를 그럴듯하게 보여 주게 된다.
             (아래 자동 찜 등록이 쓰는 것과 같은 판단이다)
        */
        lat:
          selectedPlace && selectedPlace.placeName.trim() === placeName.trim()
            ? (selectedPlace.lat ?? null)
            : null,
        lng:
          selectedPlace && selectedPlace.placeName.trim() === placeName.trim()
            ? (selectedPlace.lng ?? null)
            : null,
      }
      const saved =
        isEditMode && editingSchedule
          ? await updateSchedule(editingSchedule.id, payload)
          : await insertSchedule(payload)

      // 신규 등록 + 구글에서 고른 장소(이름을 그대로 쓴 경우)면 나의 찜 + 여행클립 찜에 자동 등록.
      if (
        !isEditMode &&
        selectedPlace &&
        selectedPlace.placeName.trim() === payload.placeName
      ) {
        const kind = selectedPlace.kind ?? "attraction"
        try {
          await autoSaveScheduledPlace({
            tripId,
            userId: authUserId,
            place: {
              placeName: payload.placeName,
              localName: selectedPlace.localName,
              subCategory: selectedPlace.subCategory,
              category: WISHLIST_CATEGORY_VALUE[kind] ?? WISHLIST_CATEGORY_VALUE.attraction,
              address: selectedPlace.address || payload.address,
              phoneNumber: selectedPlace.phoneNumber || payload.phoneNumber,
              imageUrl: selectedPlace.imageUrl,
              rating: selectedPlace.rating ?? null,
              reviewCount: selectedPlace.reviewCount ?? null,
              lat: selectedPlace.lat ?? null,
              lng: selectedPlace.lng ?? null,
              photoUrls: selectedPlace.photoUrls,
            },
          })
        } catch (autoErr) {
          console.warn("[ScheduleRegisterModal] 자동 찜 등록 실패(무시):", autoErr)
        }
      }

      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      console.error("[ScheduleRegisterModal] save failed:", err)
      if (err && typeof err === "object") {
        console.error(
          "[ScheduleRegisterModal] error.message:",
          (err as { message?: unknown }).message ?? getScheduleErrorMessage(err)
        )
        console.error("[ScheduleRegisterModal] error.details:", (err as { details?: unknown }).details)
        console.error("[ScheduleRegisterModal] error.hint:", (err as { hint?: unknown }).hint)
        console.error("[ScheduleRegisterModal] error.code:", (err as { code?: unknown }).code)
      }
      setError(getScheduleErrorMessage(err) || "일정 저장에 실패했어요.")
    } finally {
      setSaving(false)
    }
  }

  const visitDateLabel = dayMeta.visitDate || dayMeta.dateLabel || "—"

  const labelClassName = "mb-0 text-sm font-medium text-zinc-700"
  const inputClassName =
    "h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:border-amber-400 focus-visible:ring-1 focus-visible:ring-amber-400"
  const textareaClassName =
    "min-h-28 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:border-amber-400 focus-visible:ring-1 focus-visible:ring-amber-400"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] gap-0 overflow-y-auto rounded-2xl border-zinc-200 bg-white p-0 sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b border-zinc-100 px-5 pt-5 pr-12 pb-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-zinc-900">
            <Calendar className="size-5 text-zinc-900" strokeWidth={1.75} />
            {isEditMode ? "일정 수정" : "일정 등록"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-zinc-500">
            {isEditMode
              ? `${dayNumber}일차 (${visitDateLabel}) 일정 정보를 수정해요.`
              : `${dayNumber}일차 (${visitDateLabel})에 추가할 일정을 입력하면 타임라인에 정리해 드려요.`}
          </DialogDescription>
        </DialogHeader>

        <form
          id="schedule-register-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-5 bg-white px-5 py-5"
        >
          <FieldGroup className="gap-5">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="schedule-search" className={labelClassName}>
                장소 검색
              </FieldLabel>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400"
                />
                <Input
                  id="schedule-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) setSearchOpen(true)
                  }}
                  placeholder="맛집·명소·숙소 검색 (예: 해운대 암소갈비집)"
                  className={cn(inputClassName, "pr-10 pl-10")}
                  autoComplete="off"
                />
                {searching ? (
                  <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-zinc-400" />
                ) : null}
                {searchOpen && searchResults.length > 0 ? (
                  <div className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
                    <ul className="divide-y divide-zinc-100">
                      {searchResults.map((place) => (
                        <li key={place.id}>
                          <button
                            type="button"
                            onClick={() => applyGooglePlace(place)}
                            className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50"
                          >
                            <span className="truncate text-sm font-semibold text-zinc-900">
                              {place.placeName}
                            </span>
                            {place.address ? (
                              <span className="truncate text-xs text-zinc-400">{place.address}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <FieldDescription className="text-zinc-400">
                검색해서 선택하면 주소·전화번호·카테고리가 자동으로 채워져요.
              </FieldDescription>
            </Field>

            <Field className="gap-1.5">
              <FieldLabel className={labelClassName}>카테고리</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {SCHEDULE_CATEGORIES.map((item) => {
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

            <Field className="gap-1.5">
              <FieldLabel htmlFor="schedule-time" className={labelClassName}>
                시간
              </FieldLabel>
              <TimeSelect24 id="schedule-time" value={visitTime} onChange={setVisitTime} />
              <FieldDescription className="text-zinc-400">
                등록하면 시간 순서대로 자동 정렬됩니다.
              </FieldDescription>
            </Field>

            <Field className="gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="schedule-place" className={labelClassName}>
                  장소
                </FieldLabel>
                <button
                  type="button"
                  onClick={toggleWishlist}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    wishlistOpen
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
                  )}
                >
                  가고 싶은 곳에서 가져오기
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", wishlistOpen && "rotate-180")}
                  />
                </button>
              </div>

              {wishlistOpen ? (
                <div className="max-h-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
                  {wishlistLoading ? (
                    <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-zinc-400">
                      <Loader2 className="size-4 animate-spin" />
                      불러오는 중…
                    </div>
                  ) : savedPlaces.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-zinc-400">
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
                            <p className="sticky top-0 bg-zinc-50 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
                              {group.label}
                            </p>
                            <ul className="divide-y divide-zinc-100">
                              {items.map((place) => (
                                <li key={place.id}>
                                  <button
                                    type="button"
                                    onClick={() => applySavedPlace(place)}
                                    className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50"
                                  >
                                    <span className="flex items-center justify-between gap-2">
                                      <span className="truncate text-sm font-semibold text-zinc-900">
                                        {place.placeName}
                                      </span>
                                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                                        {WISHLIST_CATEGORY_VALUE[toWishlistKind(place.category)]}
                                      </span>
                                    </span>
                                    {place.address ? (
                                      <span className="truncate text-xs text-zinc-400">
                                        {place.address}
                                      </span>
                                    ) : null}
                                    {place.phoneNumber ? (
                                      <span className="truncate text-xs tabular-nums text-zinc-400">
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
                className={inputClassName}
                required
              />
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="schedule-address" className={labelClassName}>
                주소
              </FieldLabel>
              <Input
                id="schedule-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="예) 1-1 Senshu-kuko Naka, Izumisano"
                className={inputClassName}
              />
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="schedule-phone" className={labelClassName}>
                전화번호
              </FieldLabel>
              <Input
                id="schedule-phone"
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="예) +81 72-455-2500"
                className={inputClassName}
              />
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="schedule-memo" className={labelClassName}>
                메모
              </FieldLabel>
              <Textarea
                id="schedule-memo"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="예) 입국 심사 후 하루카 특급 탑승"
                rows={4}
                className={cn(textareaClassName, "resize-none")}
              />
            </Field>
          </FieldGroup>

          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-600"
            >
              {error}
            </div>
          ) : null}
        </form>

        <DialogFooter
          className={cn(
            "mx-0 mb-0 gap-2 border-t border-zinc-100 bg-white p-4 sm:justify-end",
            "rounded-b-2xl"
          )}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-full px-4 py-2.5 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            form="schedule-register-form"
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-amber-400 px-6 py-2.5 text-xs font-semibold text-zinc-900 transition-colors hover:bg-amber-500 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : isEditMode ? (
              <Check className="size-3.5" />
            ) : (
              <Plus className="size-3.5" />
            )}
            {saving ? "저장 중…" : isEditMode ? "수정 완료" : "등록하기"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function profileInitials(name: string) {
  const compact = name.replace(/\s+/g, "").trim()
  if (!compact) return "?"
  return compact.slice(0, 1).toUpperCase()
}

function CreatorBadge({
  name,
  avatarUrl,
  isHost = false,
}: {
  name: string
  avatarUrl?: string
  isHost?: boolean
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = Boolean(avatarUrl) && !imgFailed

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 text-xs text-zinc-500">
      <span className="relative flex size-5 shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/80">
        {showImage ? (
          <img
            src={avatarUrl}
            alt=""
            className="size-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="flex size-full items-center justify-center bg-zinc-200 text-[9px] font-semibold text-zinc-600">
            {name && name !== "멤버" ? (
              profileInitials(name)
            ) : (
              <UserRound className="size-3 text-zinc-500" aria-hidden="true" />
            )}
          </span>
        )}
      </span>
      <span className="truncate font-medium">{name}</span>
      {isHost ? (
        <Crown className="size-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="방장" />
      ) : null}
    </span>
  )
}

function MemberAvatars({
  members,
  ownerId = "",
  suffix,
}: {
  members: TripMember[]
  ownerId?: string
  /** "3명 중 2명" 처럼 이름 뒤에 덧붙일 말 */
  suffix?: string
}) {
  const [failed, setFailed] = useState<Record<string, boolean>>({})
  if (members.length === 0) return null
  const shown = members.slice(0, 4)
  const extra = members.length - shown.length
  const names = members
    .map((member) => member.name)
    .filter((name) => name && name !== "멤버")
    .join(", ")

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {shown.map((member) => {
          const showImage = Boolean(member.avatarUrl) && !failed[member.userId]
          const isHost = Boolean(ownerId) && member.userId === ownerId
          return (
            <span
              key={member.userId}
              title={isHost ? `${member.name} (방장)` : member.name}
              className={cn(
                "relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 ring-2 ring-white",
                isHost && "ring-amber-300"
              )}
            >
              {showImage ? (
                <img
                  src={member.avatarUrl}
                  alt=""
                  className="size-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setFailed((prev) => ({ ...prev, [member.userId]: true }))}
                />
              ) : (
                <span className="flex size-full items-center justify-center bg-zinc-200 text-[9px] font-semibold text-zinc-600">
                  {member.name && member.name !== "멤버" ? (
                    profileInitials(member.name)
                  ) : (
                    <UserRound className="size-3 text-zinc-500" aria-hidden="true" />
                  )}
                </span>
              )}
              {isHost ? (
                <Crown
                  className="absolute -top-1 -right-0.5 size-3 fill-amber-400 text-amber-500 drop-shadow-sm"
                  aria-hidden="true"
                />
              ) : null}
            </span>
          )
        })}
        {extra > 0 ? (
          <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-semibold text-zinc-600 ring-2 ring-white">
            +{extra}
          </span>
        ) : null}
      </div>
      <span className="min-w-0 truncate text-xs text-zinc-500">
        {(names ? `함께 · ${names}` : `함께 · ${members.length}명`) + (suffix ? ` · ${suffix}` : "")}
      </span>
    </div>
  )
}

function TimelineItem({
  item,
  nextItem,
  realLeg,
  isLast,
  isAuthor,
  authorProfile,
  memberProfiles,
  partialMembers,
  totalPeople,
  notMine,
  notMineReason,
  ownerId,
  deleting,
  onEdit,
  onDelete,
  onOpenPlace,
}: {
  item: TripSchedule
  /** 바로 다음 일정 — 사이 거리를 재는 데 쓴다. 마지막이면 null */
  nextItem?: TripSchedule | null
  /** 실제 조회된 이동 시간 (없으면 추정치 사용) */
  realLeg?: { minutes: number; mode: "transit" | "drive" } | null
  isLast: boolean
  isAuthor: boolean
  authorProfile?: TripMember | null
  memberProfiles: TripMember[]
  /** 손으로 넣은 일정에 **일부만** 있을 때의 참여자. 전원이면 빈 배열 */
  partialMembers: TripMember[]
  totalPeople: number
  /** 내가 아직 안 왔거나 이미 떠난(또는 이름이 안 적힌) 일정인가 */
  notMine: boolean
  /** 흐리게 그린 이유. 이름이 적혀 있어 빠진 경우는 빈 문자열(문구를 안 붙인다) */
  notMineReason: string
  ownerId: string
  deleting: boolean
  onEdit: (item: TripSchedule) => void
  onDelete: (id: string) => void
  /** 가게 상세를 연다. 가게가 아닌 일정(조식 등)에는 안 준다 */
  onOpenPlace?: (item: TripSchedule) => void
}) {
  const Icon = CATEGORY_ICON[item.category] ?? MapPin
  const timeLabel = item.visitTime || "--:--"

  /*
    다음 일정까지의 구간. 좌표가 둘 다 있을 때만 그린다.
    ⚠️ 이동수단은 지금은 도보 기준이다. 앱에는 렌터카를 등록한 날을 차 기준으로
       바꿔 주는 로직이 있는데, 웹 화면은 그 정보를 아직 안 받는다 —
       숫자가 어긋나지 않게 **둘 다 도보로 통일**해 두고, 차 기준은 앱·웹을
       같이 바꿀 때 붙인다.
  */
  const leg =
    !isLast && item.lat != null && item.lng != null && nextItem?.lat != null && nextItem?.lng != null
      ? (() => {
          const km = straightKm(
            { lat: item.lat, lng: item.lng },
            { lat: nextItem.lat as number, lng: nextItem.lng as number }
          )
          return {
            km,
            text: legLabel(km, realLeg?.mode ?? "walk", realLeg?.minutes ?? null),
            far: legTone(km) === "far" && realLeg == null,
          }
        })()
      : null
  const authorName = authorProfile?.name || "멤버"
  const authorIsHost = Boolean(ownerId) && (authorProfile?.userId === ownerId || item.createdBy === ownerId)
  const isAuto = isAutoSchedule(item)
  // 자동 일정은 원본(이동수단/숙소)에서 관리 → 함께하는 멤버를 대신 노출.
  const showAuthor = !isAuto && Boolean(item.createdBy || item.userId)

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
      {/*
        ⚠️ 지우지 않고 **흐리게** 둔다. 늦게 합류하는 사람 화면에서 앞 일정을
           아예 없애면 무엇을 놓쳤는지 모르고, 그냥 두면 자기가 가는 줄 안다.
      */}
      <div
        className={cn(
          "media-card min-w-0 flex-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:shadow-md",
          notMine && "opacity-45"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* 좁은 모바일 폭에서 제목이 뱃지와 폭 경쟁하다 글자 단위로 줄바꿈되던 문제 →
                flex-wrap 으로 좁으면 뱃지를 아래 줄로, break-keep 으로 한글은 단어 단위로만 줄바꿈 */}
            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
              {/*
                ⚠️ **가게면 눌러서 상세로 간다.** 사진·별점·영업시간·리뷰가
                   거기 다 있는데, 일정에서는 갈 길이 없었다(앱에서 신고받음).
                ⚠️ 갈 수 있는지는 부르는 쪽이 정한다(`onOpenPlace` 가 있는가).
                   「조식」처럼 주소도 좌표도 없는 일정은 **누르는 표시를 아예
                   안 준다** — 눌리는 것처럼 보였다가 아무 일도 안 일어나는 게
                   제일 나쁘다.
              */}
              {onOpenPlace ? (
                <button
                  type="button"
                  onClick={() => onOpenPlace(item)}
                  className="group -m-1 flex min-w-0 items-center gap-1 rounded-lg p-1 text-left transition-colors hover:bg-amber-50"
                >
                  <span className="min-w-0 text-base leading-snug font-bold break-keep text-slate-900 group-hover:text-amber-700">
                    {item.placeName}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-slate-300 transition-colors group-hover:text-amber-500" />
                </button>
              ) : (
                <p className="min-w-0 text-base leading-snug font-bold break-keep text-slate-900">
                  {item.placeName}
                </p>
              )}
              <span className="flex shrink-0 items-center gap-1">
                {isAuto ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
                    자동
                  </span>
                ) : null}
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    CATEGORY_BADGE[item.category]
                  )}
                >
                  {item.category}
                </span>
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {/* 길찾기 — 좌표가 없어도 이름/주소로 검색(3모드 피커). 모두에게 노출. */}
            {item.placeName || item.address ? (
              <DirectionsMenu
                destination={null}
                fallbackQuery={item.address || item.placeName}
                variant="icon"
                className="size-8 text-amber-600"
              />
            ) : null}
            {isAuthor && !isAuto ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="일정 수정"
                  disabled={deleting}
                  onClick={() => onEdit(item)}
                  className="text-gray-400 hover:text-amber-600"
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="일정 삭제"
                  disabled={deleting}
                  onClick={() => onDelete(item.id)}
                  className="text-gray-400 hover:text-destructive"
                >
                  {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {/* 작성자·메모·주소·전화는 제목 행 **밖**에 둔다.
            제목 행 안(=아이콘 버튼과 같은 flex 행)에 있으면, 아이콘 3개(길찾기·수정·삭제)가
            shrink-0 으로 폭을 가져가 좁은 폰에서 텍스트 컬럼이 100pt 남짓만 남는다.
            그러면 break-keep 때문에 주소가 어절마다 한 줄씩 끊겨 내려온다.
            (아이콘이 1개뿐인 자동 일정 카드만 멀쩡해 보이던 이유) */}
        {showAuthor ? (
          <div className="mt-2">
            <CreatorBadge name={authorName} avatarUrl={authorProfile?.avatarUrl} isHost={authorIsHost} />
          </div>
        ) : null}
        {isAuto ? (
          <MemberAvatars members={memberProfiles} ownerId={ownerId} />
        ) : partialMembers.length > 0 ? (
          <MemberAvatars
            members={partialMembers}
            ownerId={ownerId}
            suffix={`${totalPeople}명 중 ${partialMembers.length}명`}
          />
        ) : null}
        {notMine && notMineReason ? (
          <p className="mt-1.5 text-[11px] font-bold text-slate-400">{notMineReason}</p>
        ) : null}
        {item.memo ? (
          <p className="mt-1.5 text-xs leading-relaxed text-pretty text-gray-500">{item.memo}</p>
        ) : null}
        {item.address || item.phoneNumber ? (
          <div className="mt-1.5 flex flex-col gap-y-0.5 text-xs text-gray-500">
            {item.address ? (
              <p className="flex items-start gap-1">
                <MapPin className="mt-0.5 size-3 shrink-0" />
                <span className="min-w-0 flex-1 break-keep">{item.address}</span>
              </p>
            ) : null}
            {item.phoneNumber ? (
              <p className="flex items-center gap-1 tabular-nums">
                <Phone className="size-3 shrink-0" />
                <span>{item.phoneNumber}</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/*
        일정과 일정 사이 — 얼마나 떨어져 있는지.
        ⚠️ `li` 아래쪽 여백(pb-6) 자리에 얹는다. 카드 안에 넣으면 카드가 복잡해지고,
           새 줄을 만들면 연결선이 끊긴다.
        ⚠️ 왼쪽 여백은 시간칸(3.25rem)+간격+축(2.5rem)+간격 을 더한 값이다.
      */}
      {leg ? (
        <span
          className={cn(
            "absolute bottom-0.5 left-[7.25rem] flex items-center gap-1 text-xs font-semibold sm:left-[8rem]",
            leg.far ? "text-amber-700" : "text-slate-400"
          )}
        >
          {leg.far ? <AlertCircle className="size-3.5" /> : <Footprints className="size-3.5" />}
          {leg.text}
        </span>
      ) : null}
    </li>
  )
}

/**
 * Supabase `trip_schedules` 연동 여행 일정 섹션 (타임라인 UI).
 */
type TransportRow = {
  passenger_ids: string[] | null
  depart_date: string | null
  depart_time: string | null
  arrive_date: string | null
  arrive_time: string | null
}

/**
 * 「합류」·「먼저 출발」 띠.
 *
 * ⚠️ 일정 카드가 아니라 **가로줄**로 그린다. 카드로 그리면 일정처럼 보여서
 *    "여기 뭘 하러 가지?" 가 된다. 이건 할 일이 아니라 **사람이 바뀌는 순간**이다.
 * ⚠️ 이름을 쓴다. "2명 합류" 로는 누구인지 몰라 쓸모가 없다. 프로필을 못 찾은
 *    사람은 조용히 뺀다.
 */
function JoinBand({
  band,
  profileById,
}: {
  band: PresenceEvent & { day: number }
  profileById: Map<string, TripMember>
}) {
  const names = band.personIds
    .map((id) => profileById.get(String(id).trim())?.name)
    .filter((n): n is string => Boolean(n))
  if (names.length === 0) return null
  const who = names.join("·")
  const join = band.kind === "join"
  const text = join
    ? band.everyoneNow
      ? `${who} 합류 — 이제 ${band.countAfter}명 모두 모였어요`
      : `${who} 합류 (${band.countAfter}명)`
    : `${who} 먼저 출발 (남은 ${band.countAfter}명)`

  return (
    <li className="flex items-center gap-3 pb-3 text-xs">
      <span className="w-12 shrink-0 text-right font-semibold text-slate-400 tabular-nums">
        {band.at.time}
      </span>
      <span className={cn("shrink-0", join ? "text-amber-500" : "text-slate-400")}>
        {join ? <Plane className="size-4" /> : <LogOut className="size-4" />}
      </span>
      <span className={cn("font-extrabold", join ? "text-amber-700" : "text-slate-500")}>{text}</span>
      <span className={cn("h-px flex-1", join ? "bg-amber-200" : "bg-slate-200")} />
    </li>
  )
}

export function ScheduleSection({
  tripId,
  tripStartDate = "",
  tripDays = 1,
  tripCity = "",
  refreshKey = 0,
}: {
  tripId: string
  tripStartDate?: string
  /** Trip length in days (nights + 1) — controls how many day tabs render. */
  tripDays?: number
  /** Shown in subtitle, e.g. 오사카 */
  tripCity?: string
  /** 값이 바뀌면 일정을 다시 불러온다 (이동수단/숙소 자동 동기화 반영용). */
  refreshKey?: number
}) {
  const dayOptions = useMemo(
    () => Array.from({ length: Math.max(1, tripDays) }, (_, index) => index + 1),
    [tripDays]
  )
  const [selectedDay, setSelectedDay] = useState(1)
  const [items, setItems] = useState<TripSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<TripSchedule | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  /** 일정에서 연 가게 상세 — 닫으면 null */
  const [detailPlace, setDetailPlace] = useState<PlaceDetailInput | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profileById, setProfileById] = useState<Map<string, TripMember>>(new Map())
  const [ownerId, setOwnerId] = useState<string>("")

  // 호스트(방장)는 모든 일정을 수정·삭제할 수 있다.
  const isHost = Boolean(currentUserId && ownerId && currentUserId === ownerId)

  useEffect(() => {
    let cancelled = false
    void fetchTripOwnerId(tripId).then((id) => {
      if (!cancelled) setOwnerId(id)
    })
    return () => {
      cancelled = true
    }
  }, [tripId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSchedulesByTripId(tripId)
      setItems(data)

      const authorIds = [
        ...new Set(
          data
            .flatMap((item) => [
              String(item.createdBy || item.userId || "").trim(),
              ...item.memberIds.map((id) => String(id ?? "").trim()),
            ])
            .filter(Boolean)
        ),
      ]
      const profiles = await fetchProfilesByIds(authorIds)
      const next = new Map<string, TripMember>()
      for (const profile of profiles) next.set(profile.userId, profile)

      // Enrich current Kakao session metadata when profiles row is thin
      try {
        const supabase = createClient()
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()
        if (authUser?.id && next.has(authUser.id)) {
          const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>
          const metaName = [
            meta.full_name,
            meta.name,
            meta.nickname,
            meta.preferred_username,
          ]
            .map((value) => String(value ?? "").trim())
            .find((value) => Boolean(value) && !value.includes("@"))
          const metaAvatar = [meta.avatar_url, meta.picture, meta.profile_image]
            .map((value) => String(value ?? "").trim())
            .find(Boolean)
          const current = next.get(authUser.id)!
          next.set(authUser.id, {
            ...current,
            name: metaName || current.name,
            avatarUrl: metaAvatar || current.avatarUrl,
          })
        }
      } catch {
        // ignore metadata enrichment failures
      }

      setProfileById(next)
    } catch (err) {
      console.error("[ScheduleSection] load failed:", err)
      setItems([])
      setProfileById(new Map())
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    void load()
  }, [load])

  // 이동수단/숙소 변경 시(상위 refreshKey 증가) 자동 동기화된 일정을 다시 불러온다.
  useEffect(() => {
    if (refreshKey > 0) void load()
  }, [refreshKey, load])

  useEffect(() => {
    setSelectedDay((current) => Math.min(current, dayOptions.length))
  }, [dayOptions.length])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!cancelled) {
          setCurrentUserId(user?.id ?? null)
          setAuthReady(true)
        }
      } catch {
        if (!cancelled) {
          setCurrentUserId(null)
          setAuthReady(true)
        }
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      setCurrentUserId(session?.user?.id ?? null)
      setAuthReady(true)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const visibleItems = useMemo(() => {
    return sortSchedules(items.filter((item) => item.dayNumber === selectedDay))
  }, [items, selectedDay])

  /**
   * 합류·먼저 출발 띠.
   *
   * 같은 여행이라도 다 같이 출발하지 않는다 — 제주 여행은 한 명이 10:10 에,
   * 두 명이 10:25 에 따로 내려 공항에서 만난다. 날짜가 아예 달라서 이틀 뒤에
   * 합류하는 경우도 있다.
   *
   * ⚠️ 앱과 **같은 공통 파일**(shared/trip-presence)을 쓴다. 웹과 앱이 다르게
   *    읽히면 같은 여행을 두 기기로 볼 때 말이 달라진다.
   */
  const [transportRows, setTransportRows] = useState<TransportRow[]>([])
  useEffect(() => {
    if (!tripId) return
    let alive = true
    void supabase
      .from("trip_transports")
      .select("passenger_ids, depart_date, depart_time, arrive_date, arrive_time")
      .eq("trip_id", tripId)
      .then(({ data }) => {
        if (alive) setTransportRows((data as TransportRow[] | null) ?? [])
      })
    return () => {
      alive = false
    }
  }, [tripId, refreshKey])

  const who = useMemo(() => {
    const empty = { presence: new Map<string, Presence>(), personIds: [] as string[] }
    if (!tripStartDate) return empty
    const personIds = [
      ...new Set(
        [
          ...transportRows.flatMap((t) => t.passenger_ids ?? []),
          ...items.flatMap((i) => i.memberIds ?? []),
        ]
          .map((x) => String(x ?? "").trim())
          .filter(Boolean)
      ),
    ]
    if (personIds.length < 2) return empty
    const end = dayDate(tripStartDate, Math.max(1, tripDays))
    const presence = computePresence({
      startDate: tripStartDate,
      endDate: end
        ? `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`
        : null,
      personIds,
      transports: transportRows.map((t) => ({
        passengerIds: (t.passenger_ids ?? []).map(String),
        departDate: t.depart_date,
        departTime: t.depart_time,
        arriveDate: t.arrive_date,
        arriveTime: t.arrive_time,
      })),
    })
    return { presence, personIds }
  }, [transportRows, items, tripStartDate, tripDays])

  const joinBands = useMemo(() => {
    if (!tripStartDate || who.personIds.length < 2) return []
    const s0 = new Date(tripStartDate + "T00:00:00")
    return presenceEvents(who.presence).map((e) => ({
      ...e,
      day:
        Math.floor((new Date(e.at.date + "T00:00:00").getTime() - s0.getTime()) / 86400000) + 1,
    }))
  }, [who, tripStartDate])

  /** 그 일차의 날짜(YYYY-MM-DD) — 일정 시각을 사람 있고 없고와 맞춰 보는 데 쓴다 */
  const selectedDate = useMemo(() => {
    const d = dayDate(tripStartDate, selectedDay)
    return d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      : null
  }, [tripStartDate, selectedDay])

  /*
    실제 이동 시간. 추정치를 먼저 그리고, 조회가 돌아오면 바꿔 끼운다.
    ⚠️ 앱과 같은 규칙이다 — 2km 미만은 안 묻고(추정으로 충분), 2~20km 만 묻는다.
       대중교통을 먼저 묻고, 노선이 없다면(일본) 차로 다시 물어 "차 N분" 으로.
       서버(/api/routes/legs)가 캐시를 먼저 보므로 같은 구간은 한 번만 나간다.
  */
  const [realLegs, setRealLegs] = useState<Map<number, { minutes: number; mode: "transit" | "drive" }>>(
    new Map()
  )
  useEffect(() => {
    let alive = true
    setRealLegs(new Map())
    const pairs: { from: { lat: number; lng: number }; to: { lat: number; lng: number } }[] = []
    const at: number[] = []
    for (let i = 0; i < visibleItems.length - 1; i++) {
      const a = visibleItems[i]
      const b = visibleItems[i + 1]
      if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) continue
      const km = straightKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng })
      if (km >= 2 && km <= 20) {
        pairs.push({ from: { lat: a.lat, lng: a.lng }, to: { lat: b.lat, lng: b.lng } })
        at.push(i)
      }
    }
    if (pairs.length === 0) return
    void (async () => {
      try {
        const ask = async (mode: string, legs: typeof pairs) => {
          const res = await fetch("/api/routes/legs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode, legs }),
          })
          const json = (await res.json()) as {
            results?: { durationS: number | null; noRoute: boolean }[]
          }
          return json.results ?? []
        }
        const tr = await ask("transit", pairs)
        const next = new Map<number, { minutes: number; mode: "transit" | "drive" }>()
        const misses: number[] = []
        at.forEach((idx, j) => {
          const r = tr[j]
          if (r?.durationS != null) next.set(idx, { minutes: Math.round(r.durationS / 60), mode: "transit" })
          else if (r?.noRoute) misses.push(j)
        })
        if (misses.length > 0) {
          const dr = await ask("drive", misses.map((j) => pairs[j]))
          misses.forEach((j, k) => {
            const d = dr[k]?.durationS
            if (d != null) next.set(at[j], { minutes: Math.round(d / 60), mode: "drive" })
          })
        }
        if (alive && next.size > 0) setRealLegs(next)
      } catch {
        /* 조회가 실패해도 추정치가 이미 떠 있다 */
      }
    })()
    return () => {
      alive = false
    }
  }, [visibleItems])

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
    const target = items.find((item) => item.id === id)
    if (
      !target ||
      isAutoSchedule(target) ||
      !authReady ||
      !(isHost || isScheduleAuthor(target, currentUserId))
    )
      return
    if (!window.confirm("이 일정을 삭제할까요?")) return
    setDeletingId(id)
    try {
      const ok = await deleteSchedule(id)
      if (ok) setItems((current) => current.filter((item) => item.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const openAdd = () => {
    setEditingSchedule(null)
    setModalOpen(true)
  }

  const openEdit = (item: TripSchedule) => {
    if (isAutoSchedule(item) || !authReady || !(isHost || isScheduleAuthor(item, currentUserId)))
      return
    setEditingSchedule(item)
    setModalOpen(true)
  }

  const handleModalOpenChange = (next: boolean) => {
    setModalOpen(next)
    if (!next) setEditingSchedule(null)
  }

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
      </div>

      <AddSectionButton label="일정 추가" onClick={openAdd} />

      <div
        role="tablist"
        aria-label="일차 선택"
        className="no-scrollbar flex gap-2 overflow-x-auto pb-1"
      >
        {dayOptions.map((day) => {
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
                  ? "bg-amber-400 font-semibold text-zinc-900 shadow-sm"
                  : "bg-slate-100 font-medium text-slate-500 hover:bg-slate-200/70"
              )}
            >
              <span>{day}일차</span>
              {meta.dateLabel ? (
                <span
                  className={cn(
                    "tabular-nums",
                    active ? "text-zinc-900/70" : "text-slate-400"
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
            <Fragment key={item.id}>
            {/*
              이 일정 **앞에** 들어갈 띠. 앞 일정과 이 일정 사이의 시각인 것만
              고른다 — 안 그러면 같은 띠가 하루에 여러 번 나온다.
            */}
            {joinBands
              .filter(
                (b) =>
                  b.day === selectedDay &&
                  b.at.time > (index === 0 ? "" : (visibleItems[index - 1].visitTime ?? "").slice(0, 5)) &&
                  b.at.time <= (item.visitTime ?? "99:99").slice(0, 5)
              )
              .map((b) => (
                <JoinBand key={`${b.kind}-${b.at.time}`} band={b} profileById={profileById} />
              ))}
            <TimelineItem
              item={item}
              isLast={index === visibleItems.length - 1}
              /*
                다음 일정까지 얼마나 먼가.
                ⚠️ **좌표가 둘 다 있을 때만** 넘긴다. 주소만 있는 일정은 어디인지
                   모르는데, 없는 값을 지어내면 그걸 믿고 계획을 짠다.
                ⚠️ 계산은 앱과 같은 공통 파일(shared/trip-distance)을 쓴다 —
                   웹과 앱이 다른 숫자를 보여 주면 안 된다.
              */
              nextItem={visibleItems[index + 1] ?? null}
              realLeg={realLegs.get(index) ?? null}
              isAuthor={authReady && (isHost || isScheduleAuthor(item, currentUserId))}
              authorProfile={
                profileById.get(String(item.createdBy || item.userId || "").trim()) ?? null
              }
              memberProfiles={item.memberIds
                .map((memberId) => profileById.get(String(memberId ?? "").trim()))
                .filter((member): member is TripMember => Boolean(member))}
              {...(() => {
                /*
                  이 일정에 **누가 있나.**

                  ⚠️ 손으로 정한 게 있으면(`memberIds`) 그게 우선이다. 없으면
                     교통편에서 나온 합류·이탈 시각으로 계산한다. 일정마다 사람을
                     찍게 하면 20건짜리 여행에 20번이라 아무도 안 쓴다.
                  ⚠️ **전원이면 아무것도 안 붙인다.** 전원인 게 대부분이라, 매 줄에
                     얼굴을 붙이면 정작 "일부만" 인 줄이 안 보인다.
                */
                const at = selectedDate
                  ? { date: selectedDate, time: (item.visitTime ?? "12:00").slice(0, 5) }
                  : null
                const explicit = (item.memberIds ?? []).map((x) => String(x ?? "").trim()).filter(Boolean)
                const joining =
                  explicit.length > 0
                    ? explicit
                    : at
                      ? who.personIds.filter((pid) => isPresent(who.presence.get(pid), at))
                      : who.personIds
                const partial =
                  who.personIds.length >= 2 &&
                  joining.length > 0 &&
                  joining.length < who.personIds.length
                const me = String(currentUserId ?? "").trim()
                /*
                  ⚠️ **이름이 적혀 있으면 그게 답이다.** 계산으로 덮지 않는다.
                     내가 탄 비행기는 도착 전이라 "합류 전" 으로 잡혀 흐려졌었다.
                */
                const mine = who.personIds.includes(me)
                const notMine = mine
                  ? explicit.length > 0
                    ? !explicit.includes(me)
                    : Boolean(at) && !isPresent(who.presence.get(me), at!)
                  : false
                const p = me ? who.presence.get(me) : undefined
                /*
                  ⚠️ 이름이 적힌 일정에는 문구를 안 붙인다. 남의 비행기는 얼굴이
                     이미 누구 것인지 말해 주는데, 거기에 "먼저 출발한 뒤" 를
                     붙였더니 내가 떠난 것처럼 읽혔다. 흐리게만 두면 충분하다.
                */
                const reason =
                  !notMine || explicit.length > 0
                    ? ""
                    : p?.joinsAt && at && momentBefore(at, p.joinsAt)
                      ? "합류 전 일정이에요"
                      : "먼저 출발한 뒤의 일정이에요"
                return {
                  partialMembers: partial
                    ? (joining
                        .map((pid) => profileById.get(pid))
                        .filter((m): m is TripMember => Boolean(m)) as TripMember[])
                    : [],
                  totalPeople: who.personIds.length,
                  notMine,
                  notMineReason: reason,
                }
              })()}
              ownerId={ownerId}
              deleting={deletingId === item.id}
              onEdit={openEdit}
              onDelete={(id) => void handleDelete(id)}
              /*
                ⚠️ **가게인 일정만** 넘긴다. 「조식」·「호텔에서 수영」처럼 주소도
                   좌표도 없는 것은 구글에 물어도 나올 게 없다 — 그런 줄에
                   화살표를 달면 눌러 보고 실망한다.
                ⚠️ 앱과 같은 기준이다(`src/app/trips/[id].tsx` 의 `detailHref`).
              */
              onOpenPlace={
                item.placeName.trim() && (item.address || item.lat != null)
                  ? (it) =>
                      setDetailPlace({
                        name: it.placeName,
                        address: it.address ?? null,
                        lat: it.lat ?? null,
                        lng: it.lng ?? null,
                        /*
                          ⚠️ 일정에는 찜 번호가 없다. 시트는 이름·좌표만 있으면
                             사진·별점·영업시간을 구글에서 받아 오므로 그대로 열린다
                             (`savedPlaceId` 는 원래 선택값이다).
                        */
                      })
                  : undefined
              }
            />
            {/* 그날 마지막 일정 뒤에 오는 띠(저녁에 합류·출발)도 놓치지 않는다 */}
            {index === visibleItems.length - 1
              ? joinBands
                  .filter(
                    (b) =>
                      b.day === selectedDay && b.at.time > (item.visitTime ?? "99:99").slice(0, 5)
                  )
                  .map((b) => (
                    <JoinBand key={`tail-${b.kind}-${b.at.time}`} band={b} profileById={profileById} />
                  ))
              : null}
            </Fragment>
          ))}
        </ol>
      )}

      <ScheduleRegisterModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        tripId={tripId}
        tripStartDate={tripStartDate}
        tripDays={tripDays}
        defaultDayIndex={selectedDay}
        editingSchedule={editingSchedule}
        onSaved={(item) => {
          setItems((current) => {
            const without = current.filter((row) => row.id !== item.id)
            return sortSchedules([...without, item])
          })
          setSelectedDay(item.dayNumber)
          setEditingSchedule(null)
          void load()
        }}
      />

      {/* 일정에서 연 가게 상세 — 찜 탭과 같은 시트를 쓴다 */}
      <PlaceDetailSheet place={detailPlace} onClose={() => setDetailPlace(null)} />
    </section>
  )
}
