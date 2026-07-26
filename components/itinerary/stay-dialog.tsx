"use client"

import { useState, type ReactNode } from "react"
import { BedDouble } from "lucide-react"

import { DateTimeField, formatDotDate } from "@/components/itinerary/date-time-field"
import { useTrips } from "@/components/trips-store"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { DEFAULT_STAY_IMAGE, parseTripDate } from "@/lib/trip-itinerary"
import type { Trip } from "@/lib/trip-data"

export function StayDialog({ trip, trigger }: { trip: Trip; trigger: ReactNode }) {
  const { addStay } = useTrips()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [checkInDate, setCheckInDate] = useState<Date | undefined>(() =>
    parseTripDate(trip.startDate)
  )
  const [checkInTime, setCheckInTime] = useState("15:00")
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>(() =>
    parseTripDate(trip.endDate)
  )
  const [checkOutTime, setCheckOutTime] = useState("11:00")
  const [phone, setPhone] = useState("")
  const [memo, setMemo] = useState("")
  const [imageUrl, setImageUrl] = useState(DEFAULT_STAY_IMAGE)

  const reset = () => {
    setName("")
    setAddress("")
    setImageUrl(DEFAULT_STAY_IMAGE)
    setCheckInDate(parseTripDate(trip.startDate))
    setCheckInTime("15:00")
    setCheckOutDate(parseTripDate(trip.endDate))
    setCheckOutTime("11:00")
    setPhone("")
    setMemo("")
  }

  const canSubmit = Boolean(name.trim() && checkInDate && checkOutDate)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!checkInDate || !checkOutDate) return
    addStay(trip.id, {
      name: name.trim(),
      address: address.trim(),
      checkInDate: formatDotDate(checkInDate),
      checkInTime,
      checkOutDate: formatDotDate(checkOutDate),
      checkOutTime,
      phone: phone.trim(),
      memo: memo.trim(),
      imageUrl: imageUrl.trim() || DEFAULT_STAY_IMAGE,
    })
    setOpen(false)
    reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90svh] gap-5 overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BedDouble className="size-4" />
            </span>
            숙소 등록
          </DialogTitle>
          <DialogDescription>
            체크인·체크아웃 정보를 입력하면 숙소 카드로 정리해 드려요.
          </DialogDescription>
        </DialogHeader>

        <form id="stay-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="stay-name">숙소 · 호텔 이름</FieldLabel>
              <Input
                id="stay-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="시그니엘 서울"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="stay-address">주소 · 위치</FieldLabel>
              <Input
                id="stay-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="서울 송파구 올림픽로 300"
              />
              <FieldDescription>지도 검색에 사용할 주소를 입력하세요.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="stay-image">숙소 대표 이미지 URL</FieldLabel>
              <Input
                id="stay-image"
                type="url"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder={DEFAULT_STAY_IMAGE}
              />
              {imageUrl.trim() ? (
                <div className="relative h-24 overflow-hidden rounded-xl bg-secondary ring-1 ring-border">
                  <img
                    src={imageUrl.trim()}
                    alt=""
                    className="size-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.visibility = "hidden"
                    }}
                  />
                </div>
              ) : null}
              <FieldDescription>
                카드 상단 배너로 사용됩니다. 비워 두면 기본 이미지가 적용돼요.
              </FieldDescription>
            </Field>

            <DateTimeField
              id="stay-checkin"
              label="체크인"
              date={checkInDate}
              time={checkInTime}
              onDateChange={setCheckInDate}
              onTimeChange={setCheckInTime}
            />

            <DateTimeField
              id="stay-checkout"
              label="체크아웃"
              date={checkOutDate}
              time={checkOutTime}
              onDateChange={setCheckOutDate}
              onTimeChange={setCheckOutTime}
            />

            <Field>
              <FieldLabel htmlFor="stay-phone">숙소 전화번호</FieldLabel>
              <Input
                id="stay-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="선택 입력 · 예: +81 6-1234-5678 또는 02-1234-5678"
              />
              <FieldDescription>등록하면 카드에서 바로 전화를 걸 수 있어요.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="stay-memo">메모</FieldLabel>
              <Textarea
                id="stay-memo"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="객실 타입, 조식 포함 여부 등을 적어 두세요."
                rows={3}
                className="rounded-xl"
              />
            </Field>
          </FieldGroup>
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
            form="stay-form"
            disabled={!canSubmit}
            className="rounded-full font-semibold"
          >
            <BedDouble data-icon="inline-start" />
            등록하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
