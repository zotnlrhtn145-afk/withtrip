"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BedDouble, Check, Loader2, Plus, X } from "lucide-react"

import { SearchableSelect, type SearchableOption } from "@/components/searchable-select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TimeSelect24 } from "@/components/ui/time-select-24"
import {
  getErrorMessage,
  insertAccommodation,
  isCheckoutBeforeCheckin,
  updateAccommodation,
  type Accommodation,
} from "@/lib/accommodations-api"
import { getCurrentUserId } from "@/lib/auth-session"
import { placeResultToSearchOption } from "@/lib/hotel-presets"
import { searchGooglePlaces, type PlaceSearchResult } from "@/lib/places-search"
import { fetchTripRoster, type TripMember } from "@/lib/trip-members-api"
import { cn } from "@/lib/utils"

const labelClass =
  "mb-1.5 flex items-center gap-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase"
const inputClass =
  "h-auto rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-none transition-all placeholder:text-slate-400 focus-visible:border-amber-400 focus-visible:ring-4 focus-visible:ring-amber-400/15"
const helperClass = "mt-1.5 text-[11px] font-normal text-slate-400"

export function AccommodationRegisterModal({
  open,
  onOpenChange,
  tripId,
  editing = null,
  defaultCheckInDate = "",
  defaultCheckOutDate = "",
  onSaved,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  tripId: string
  editing?: Accommodation | null
  /** Prefill for create mode (trip dates as YYYY-MM-DD or YYYY.MM.DD). */
  defaultCheckInDate?: string
  defaultCheckOutDate?: string
  onSaved: (item?: Accommodation) => void
}) {
  const isEditMode = Boolean(editing)

  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [checkInDate, setCheckInDate] = useState("")
  const [checkInTime, setCheckInTime] = useState("15:00")
  const [checkOutDate, setCheckOutDate] = useState("")
  const [checkOutTime, setCheckOutTime] = useState("11:00")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [memo, setMemo] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [guestIds, setGuestIds] = useState<string[]>([])
  const [roster, setRoster] = useState<TripMember[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)

  const [hotelQuery, setHotelQuery] = useState("")
  const [hotelResults, setHotelResults] = useState<PlaceSearchResult[]>([])
  const [searchingHotels, setSearchingHotels] = useState(false)
  const [searchWarning, setSearchWarning] = useState<string | null>(null)
  const searchSeq = useRef(0)

  const hotelOptions = useMemo(
    () => hotelResults.map(placeResultToSearchOption),
    [hotelResults]
  )

  const toInputDate = (value: string) => {
    const raw = String(value ?? "").trim()
    const match = raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/)
    if (!match) return ""
    return `${match[1]}-${`${Number(match[2])}`.padStart(2, "0")}-${`${Number(match[3])}`.padStart(2, "0")}`
  }

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    setHotelResults([])
    setSearchingHotels(false)
    setSearchWarning(null)
    setHotelQuery("")

    if (editing) {
      setName(editing.name)
      setAddress(editing.address)
      setImageUrl(editing.imageUrl)
      setLat(editing.lat)
      setLng(editing.lng)
      setCheckInDate(toInputDate(editing.checkInDate))
      setCheckInTime(editing.checkInTime || "15:00")
      setCheckOutDate(toInputDate(editing.checkOutDate))
      setCheckOutTime(editing.checkOutTime || "11:00")
      setPhoneNumber(editing.phoneNumber)
      setMemo(editing.memo)
      setHotelQuery(editing.name)
      setGuestIds(editing.guestIds ?? [])
      return
    }

    setName("")
    setAddress("")
    setImageUrl("")
    setLat(null)
    setLng(null)
    setCheckInDate(toInputDate(defaultCheckInDate))
    setCheckInTime("15:00")
    setCheckOutDate(toInputDate(defaultCheckOutDate))
    setCheckOutTime("11:00")
    setPhoneNumber("")
    setMemo("")
    setGuestIds([])
  }, [open, editing, defaultCheckInDate, defaultCheckOutDate])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setRosterLoading(true)
    void fetchTripRoster(tripId).then((members) => {
      if (cancelled) return
      setRoster(members)
      setRosterLoading(false)
    })
    return () => { cancelled = true }
  }, [open, tripId])

  useEffect(() => {
    if (!open) return
    const q = hotelQuery.trim()
    if (q.length < 1) {
      setHotelResults([])
      setSearchingHotels(false)
      setSearchWarning(null)
      return
    }

    const seq = ++searchSeq.current
    setSearchingHotels(true)
    const timer = window.setTimeout(() => {
      void (async () => {
        const { results, warning } = await searchGooglePlaces(q, "stay")
        if (seq !== searchSeq.current) return
        setHotelResults(results)
        setSearchWarning(warning ?? null)
        setSearchingHotels(false)
      })()
    }, 300)

    return () => window.clearTimeout(timer)
  }, [hotelQuery, open])

  const handleHotelSelect = (option: SearchableOption) => {
    const place =
      hotelResults.find((item) => option.id && item.id === option.id) ??
      hotelResults.find((item) => item.placeName === option.value)
    if (place) {
      setName(place.placeName)
      setHotelQuery(place.placeName)
      setAddress(place.address)
      setPhoneNumber(place.phoneNumber)
      setImageUrl(String(place.imageUrl ?? place.image ?? "").trim())
      setLat(typeof place.lat === "number" ? place.lat : null)
      setLng(typeof place.lng === "number" ? place.lng : null)
      setError(null)
      return
    }
    setName(option.label)
    setHotelQuery(option.label)
    setImageUrl("")
    setLat(null)
    setLng(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return

    if (!name.trim()) {
      setError("숙소 이름을 입력해 주세요")
      return
    }
    if (!checkInDate || !checkOutDate) {
      setError("체크인·체크아웃 날짜를 선택해 주세요")
      return
    }
    if (isCheckoutBeforeCheckin(checkInDate, checkOutDate)) {
      setError("체크아웃 날짜는 체크인 날짜보다 빠를 수 없어요")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const authUserId = await getCurrentUserId()
      const payload = {
        tripId,
        name: name.trim(),
        address: address.trim(),
        imageUrl: imageUrl.trim(),
        lat,
        lng,
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        phoneNumber: phoneNumber.trim(),
        memo: memo.trim(),
        createdBy: isEditMode ? undefined : authUserId,
        guestIds,
      }

      const saved =
        isEditMode && editing
          ? await updateAccommodation(editing.id, payload)
          : await insertAccommodation(payload)

      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      console.error("[AccommodationRegisterModal] save failed:", err)
      setError(getErrorMessage(err) || "숙소 저장에 실패했어요. 잠시 후 다시 시도해 주세요.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex w-full max-w-[calc(100%-0px)] flex-col gap-0 overflow-hidden bg-white p-0 text-sm text-slate-900 shadow-xl ring-1 ring-slate-200/60",
          // Mobile: bottom sheet
          "inset-x-0 top-auto bottom-0 max-h-[90vh] translate-x-0 translate-y-0 rounded-t-3xl rounded-b-none",
          // Desktop: centered modal
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:max-h-[90svh] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
        )}
      >
        <DialogHeader className="relative shrink-0 gap-0 border-b border-slate-100 px-5 pt-5 pb-4 text-left sm:px-6 sm:pt-6">
          <DialogClose
            className={cn(
              "absolute top-3 right-3 rounded-full p-2 text-slate-400 transition-all",
              "hover:bg-slate-100 hover:text-slate-700"
            )}
          >
            <X className="size-4" />
            <span className="sr-only">닫기</span>
          </DialogClose>

          <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-500">
            <BedDouble className="size-5" />
          </span>
          <DialogTitle className="text-lg font-bold tracking-tight text-slate-900">
            {isEditMode ? "숙소 정보 수정" : "숙소 정보 등록"}
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-xs font-medium text-slate-400">
            {isEditMode
              ? "숙소 정보를 수정한 뒤 저장해 주세요."
              : "전 세계 숙소를 검색해 선택하면 주소·전화번호가 자동으로 채워져요."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="accommodation-register-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4 sm:px-6"
        >
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="acc-name" className={labelClass}>
                숙소 이름
              </FieldLabel>
              <SearchableSelect
                id="acc-name"
                value={name}
                onChange={setName}
                onQueryChange={setHotelQuery}
                onSelectOption={handleHotelSelect}
                options={hotelOptions}
                placeholder="숙소 이름이나 도시를 입력하세요"
                idleText="숙소 이름이나 도시를 입력하세요"
                emptyText="일치하는 숙소가 없어요"
                loading={searchingHotels}
                filterLocally={false}
                allowCustom
                customHint="목록에 없으면 입력한 이름을 그대로 저장해요."
                inputClassName={cn(
                  inputClass,
                  "h-auto min-h-10 py-2.5 pr-9 pl-9"
                )}
              />
              {searchWarning ? (
                <p className={cn(helperClass, "text-amber-600")}>{searchWarning}</p>
              ) : (
                <FieldDescription className={helperClass}>
                  Google Places로 전 세계 호텔·리조트를 검색합니다.
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="acc-address" className={labelClass}>
                숙소 주소 / 위치
              </FieldLabel>
              <Input
                id="acc-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="예: 3-7-1-2 Nishi-Shinjuku, Shinjuku City, Tokyo"
                className={inputClass}
              />
              <FieldDescription className={helperClass}>
                검색 선택 시 자동 입력되며, 직접 수정할 수 있어요.
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="acc-checkin-date" className={labelClass}>
                  체크인 날짜
                </FieldLabel>
                <Input
                  id="acc-checkin-date"
                  type="date"
                  value={checkInDate}
                  onChange={(event) => setCheckInDate(event.target.value)}
                  className={cn(inputClass, "tabular-nums")}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="acc-checkin-time" className={labelClass}>
                  체크인 시간
                </FieldLabel>
                <TimeSelect24 id="acc-checkin-time" value={checkInTime} onChange={setCheckInTime} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="acc-checkout-date" className={labelClass}>
                  체크아웃 날짜
                </FieldLabel>
                <Input
                  id="acc-checkout-date"
                  type="date"
                  value={checkOutDate}
                  onChange={(event) => setCheckOutDate(event.target.value)}
                  className={cn(inputClass, "tabular-nums")}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="acc-checkout-time" className={labelClass}>
                  체크아웃 시간
                </FieldLabel>
                <TimeSelect24 id="acc-checkout-time" value={checkOutTime} onChange={setCheckOutTime} />
              </Field>
            </div>
            <FieldDescription className={cn(helperClass, "-mt-2")}>
              체크아웃 날짜는 체크인 날짜와 같거나 이후여야 해요.
            </FieldDescription>

            <Field>
              <FieldLabel htmlFor="acc-phone" className={labelClass}>
                전화번호
              </FieldLabel>
              <Input
                id="acc-phone"
                type="tel"
                inputMode="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="예: +81 3-5322-1234 (선택)"
                className={cn(inputClass, "tabular-nums")}
              />
              <FieldDescription className={helperClass}>
                검색 선택 시 자동 입력되며, 직접 수정할 수 있어요.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="acc-memo" className={labelClass}>
                메모 / 특이사항
              </FieldLabel>
              <Textarea
                id="acc-memo"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="예: 짐 보관 가능 여부 확인 필요"
                rows={3}
                className={cn(
                  "min-h-[90px] resize-none rounded-xl border border-slate-200/80 bg-white p-3 text-sm text-slate-900 shadow-none transition-all",
                  "placeholder:text-slate-400 focus-visible:border-amber-400 focus-visible:ring-4 focus-visible:ring-amber-400/15"
                )}
              />
            </Field>

            <Field>
              <FieldLabel className={labelClass}>투숙 멤버</FieldLabel>
              {rosterLoading ? (
                <p className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="size-3.5 animate-spin" /> 멤버 불러오는 중…
                </p>
              ) : roster.length === 0 ? (
                <p className="text-xs text-slate-400">여행에 참여 중인 멤버가 없어요.</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1.5">
                  {roster.map((member) => {
                    const checked = guestIds.includes(member.userId)
                    return (
                      <li key={member.userId}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-slate-50">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) => {
                              setGuestIds((cur) =>
                                next
                                  ? cur.includes(member.userId) ? cur : [...cur, member.userId]
                                  : cur.filter((id) => id !== member.userId)
                              )
                            }}
                            className="data-[state=checked]:border-amber-400 data-[state=checked]:bg-amber-400 data-[state=checked]:text-slate-900"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                            {member.name}
                          </span>
                          {member.role === "owner" ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">방장</span>
                          ) : null}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Field>
          </FieldGroup>

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-600"
            >
              <p className="break-words">{error}</p>
            </div>
          ) : null}
        </form>

        <DialogFooter
          className={cn(
            "sticky bottom-0 left-0 right-0 z-10 mx-0 mb-0",
            "grid w-full grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:items-center sm:justify-end",
            "rounded-none border-t border-slate-100 bg-white/95 px-5 pt-3.5 backdrop-blur-md sm:rounded-b-3xl",
            "pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-3"
          )}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-full px-4 py-2.5 text-xs font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            form="accommodation-register-form"
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-amber-400 px-6 py-2.5 text-xs font-bold text-slate-950 shadow-sm shadow-amber-400/20 transition-all hover:bg-amber-500 active:scale-95 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : isEditMode ? (
              <Check className="size-3.5" />
            ) : (
              <Plus className="size-3.5" />
            )}
            {saving ? "저장 중…" : isEditMode ? "수정 완료" : "저장하기"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
