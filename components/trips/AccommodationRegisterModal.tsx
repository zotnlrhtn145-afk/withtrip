"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { BedDouble, Check, Loader2, Plus } from "lucide-react"

import { SearchableSelect, type SearchableOption } from "@/components/searchable-select"
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
  insertAccommodation,
  isCheckoutBeforeCheckin,
  updateAccommodation,
  type Accommodation,
} from "@/lib/accommodations-api"
import { placeResultToSearchOption } from "@/lib/hotel-presets"
import { searchGooglePlaces, type PlaceSearchResult } from "@/lib/places-search"

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
  const [checkInDate, setCheckInDate] = useState("")
  const [checkInTime, setCheckInTime] = useState("15:00")
  const [checkOutDate, setCheckOutDate] = useState("")
  const [checkOutTime, setCheckOutTime] = useState("11:00")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [memo, setMemo] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setCheckInDate(toInputDate(editing.checkInDate))
      setCheckInTime(editing.checkInTime || "15:00")
      setCheckOutDate(toInputDate(editing.checkOutDate))
      setCheckOutTime(editing.checkOutTime || "11:00")
      setPhoneNumber(editing.phoneNumber)
      setMemo(editing.memo)
      setHotelQuery(editing.name)
      return
    }

    setName("")
    setAddress("")
    setCheckInDate(toInputDate(defaultCheckInDate))
    setCheckInTime("15:00")
    setCheckOutDate(toInputDate(defaultCheckOutDate))
    setCheckOutTime("11:00")
    setPhoneNumber("")
    setMemo("")
  }, [open, editing, defaultCheckInDate, defaultCheckOutDate])

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
      setError(null)
      return
    }
    setName(option.label)
    setHotelQuery(option.label)
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
      const payload = {
        tripId,
        name: name.trim(),
        address: address.trim(),
        checkInDate,
        checkInTime,
        checkOutDate,
        checkOutTime,
        phoneNumber: phoneNumber.trim(),
        memo: memo.trim(),
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
      <DialogContent className="max-h-[90svh] gap-5 overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BedDouble className="size-4" />
            </span>
            {isEditMode ? "숙소 정보 수정" : "숙소 정보 등록"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "숙소 정보를 수정한 뒤 수정 완료를 눌러 주세요."
              : "전 세계 숙소를 검색해 선택하면 주소·전화번호가 자동으로 채워져요."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="accommodation-register-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="acc-name">숙소 이름</FieldLabel>
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
              />
              {searchWarning ? (
                <FieldDescription className="text-amber-700">{searchWarning}</FieldDescription>
              ) : (
                <FieldDescription>
                  Google Places로 전 세계 호텔·리조트를 검색합니다.
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="acc-address">숙소 주소 / 위치</FieldLabel>
              <Input
                id="acc-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="예: 3-7-1-2 Nishi-Shinjuku, Shinjuku City, Tokyo"
                className="rounded-xl"
              />
              <FieldDescription>검색 선택 시 자동 입력되며, 직접 수정할 수 있어요.</FieldDescription>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="acc-checkin-date">체크인 날짜</FieldLabel>
                <Input
                  id="acc-checkin-date"
                  type="date"
                  value={checkInDate}
                  onChange={(event) => setCheckInDate(event.target.value)}
                  className="rounded-xl tabular-nums"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="acc-checkin-time">체크인 시간</FieldLabel>
                <Input
                  id="acc-checkin-time"
                  type="time"
                  value={checkInTime}
                  onChange={(event) => setCheckInTime(event.target.value)}
                  className="rounded-xl tabular-nums"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="acc-checkout-date">체크아웃 날짜</FieldLabel>
                <Input
                  id="acc-checkout-date"
                  type="date"
                  value={checkOutDate}
                  onChange={(event) => setCheckOutDate(event.target.value)}
                  className="rounded-xl tabular-nums"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="acc-checkout-time">체크아웃 시간</FieldLabel>
                <Input
                  id="acc-checkout-time"
                  type="time"
                  value={checkOutTime}
                  onChange={(event) => setCheckOutTime(event.target.value)}
                  className="rounded-xl tabular-nums"
                />
              </Field>
            </div>
            <FieldDescription>
              체크아웃 날짜는 체크인 날짜와 같거나 이후여야 해요.
            </FieldDescription>

            <Field>
              <FieldLabel htmlFor="acc-phone">전화번호</FieldLabel>
              <Input
                id="acc-phone"
                type="tel"
                inputMode="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="예: +81 3-5322-1234 (선택)"
                className="rounded-xl tabular-nums"
              />
              <FieldDescription>검색 선택 시 자동 입력되며, 직접 수정할 수 있어요.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="acc-memo">메모 / 특이사항</FieldLabel>
              <Textarea
                id="acc-memo"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="예: 짐 보관 가능 여부 확인 필요"
                rows={3}
                className="rounded-xl"
              />
            </Field>
          </FieldGroup>

          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <p className="break-words">{error}</p>
            </div>
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
            form="accommodation-register-form"
            disabled={saving}
            className="rounded-full font-semibold"
          >
            {saving ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : isEditMode ? (
              <Check data-icon="inline-start" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            {isEditMode ? "수정 완료" : "저장하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
