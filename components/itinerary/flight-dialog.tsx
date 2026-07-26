"use client"

import { useState, type ReactNode } from "react"
import { ArrowRight, Plane } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { airlines, findAirline, OTHER_AIRLINE_ID } from "@/lib/airlines"
import { airportOptions, guessArrivalCode, parseTripDate } from "@/lib/trip-itinerary"
import type { Trip } from "@/lib/trip-data"

const airlineItems = airlines.map((airline) => ({
  value: airline.id,
  label:
    airline.id === OTHER_AIRLINE_ID
      ? "기타 (Direct Input)"
      : `${airline.name} (${airline.nameEn})`,
}))

export function FlightDialog({ trip, trigger }: { trip: Trip; trigger: ReactNode }) {
  const { addFlight } = useTrips()
  const arrivalHint = guessArrivalCode(trip)
  const [open, setOpen] = useState(false)
  const [airlineId, setAirlineId] = useState(airlines[0].id)
  const [airlineName, setAirlineName] = useState("")
  const [flightNo, setFlightNo] = useState("")
  const [fromCode, setFromCode] = useState("")
  const [toCode, setToCode] = useState("")
  const [departDate, setDepartDate] = useState<Date | undefined>(() => parseTripDate(trip.startDate))
  const [departTime, setDepartTime] = useState("09:00")
  const [arriveDate, setArriveDate] = useState<Date | undefined>(() => parseTripDate(trip.startDate))
  const [arriveTime, setArriveTime] = useState("11:00")

  const reset = () => {
    setAirlineId(airlines[0].id)
    setAirlineName("")
    setFlightNo("")
    setFromCode("")
    setToCode("")
    setDepartDate(parseTripDate(trip.startDate))
    setDepartTime("09:00")
    setArriveDate(parseTripDate(trip.startDate))
    setArriveTime("11:00")
  }

  const isOther = airlineId === OTHER_AIRLINE_ID
  const selected = findAirline(airlineId)

  const canSubmit = Boolean(
    fromCode.trim().length === 3 &&
      toCode.trim().length === 3 &&
      departDate &&
      arriveDate &&
      departTime &&
      arriveTime &&
      (!isOther || airlineName.trim())
  )

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!departDate || !arriveDate) return
    addFlight(trip.id, {
      airlineId,
      airlineName: isOther ? airlineName.trim() : "",
      flightNo: flightNo.trim().toUpperCase(),
      fromCode: fromCode.trim().toUpperCase(),
      toCode: toCode.trim().toUpperCase(),
      departDate: formatDotDate(departDate),
      departTime,
      arriveDate: formatDotDate(arriveDate),
      arriveTime,
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
              <Plane className="size-4" />
            </span>
            비행기 일정 등록
          </DialogTitle>
          <DialogDescription>
            항공권 정보를 입력하면 티켓 카드로 정리해 드려요.
          </DialogDescription>
        </DialogHeader>

        <form id="flight-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="flight-airline">항공사 선택</FieldLabel>
              <Select
                items={airlineItems}
                value={airlineId}
                onValueChange={(value) => setAirlineId(value as string)}
              >
                <SelectTrigger id="flight-airline" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {airlineItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            {isOther ? (
              <Field>
                <FieldLabel htmlFor="flight-airline-name">항공사 이름 직접 입력</FieldLabel>
                <Input
                  id="flight-airline-name"
                  value={airlineName}
                  onChange={(event) => setAirlineName(event.target.value)}
                  placeholder="예: 피치항공"
                  required
                />
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="flight-no">편명</FieldLabel>
              <Input
                id="flight-no"
                value={flightNo}
                onChange={(event) => setFlightNo(event.target.value)}
                placeholder={selected?.code ? `${selected.code}721` : "예: MM24"}
                maxLength={8}
                className="font-mono uppercase"
              />
              <FieldDescription>
                티켓 카드에 항공사와 함께 표시됩니다. 선택 입력이에요.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="flight-from">출발 · 도착 공항</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  id="flight-from"
                  list="airport-options"
                  value={fromCode}
                  onChange={(event) => setFromCode(event.target.value)}
                  placeholder="ICN"
                  aria-label="출발 공항"
                  maxLength={3}
                  className="min-w-0 flex-1 text-center font-mono text-base uppercase"
                  required
                />
                <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  id="flight-to"
                  list="airport-options"
                  value={toCode}
                  onChange={(event) => setToCode(event.target.value)}
                  placeholder={arrivalHint}
                  aria-label="도착 공항"
                  maxLength={3}
                  className="min-w-0 flex-1 text-center font-mono text-base uppercase"
                  required
                />
              </div>
              <datalist id="airport-options">
                {airportOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code} · {option.city}
                  </option>
                ))}
              </datalist>
              <FieldDescription>IATA 공항 코드 3자리를 입력하세요.</FieldDescription>
            </Field>

            <DateTimeField
              id="flight-depart"
              label="출발 일시"
              date={departDate}
              time={departTime}
              onDateChange={setDepartDate}
              onTimeChange={setDepartTime}
            />

            <DateTimeField
              id="flight-arrive"
              label="도착 일시"
              date={arriveDate}
              time={arriveTime}
              onDateChange={setArriveDate}
              onTimeChange={setArriveTime}
            />
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
            form="flight-form"
            disabled={!canSubmit}
            className="rounded-full font-semibold"
          >
            <Plane data-icon="inline-start" />
            등록하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
