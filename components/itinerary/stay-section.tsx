"use client"

import { ContactLine } from "@/components/contact-line"
import { BedDouble, LogIn, LogOut, Moon, Navigation, Phone, Plus } from "lucide-react"

import { StayDialog } from "@/components/itinerary/stay-dialog"
import { useTrips } from "@/components/trips-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import type { Trip } from "@/lib/trip-data"
import { DEFAULT_STAY_IMAGE, parseTripDate, type StayEntry } from "@/lib/trip-itinerary"

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

function stampLabel(date: string, time: string) {
  const parsed = parseTripDate(date)
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0")
  const day = `${parsed.getDate()}`.padStart(2, "0")
  return `${month}.${day} (${WEEKDAYS[parsed.getDay()]}) ${time}`
}

function nightsBetween(stay: StayEntry) {
  const start = parseTripDate(stay.checkInDate).getTime()
  const end = parseTripDate(stay.checkOutDate).getTime()
  return Math.max(1, Math.round((end - start) / DAY_MS))
}

function StayItem({ stay }: { stay: StayEntry }) {
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    stay.address || stay.name
  )}`

  return (
    <li className="group media-card overflow-hidden rounded-2xl bg-card ring-1 ring-border">
      {/* 히어로 배너 — 숙소 사진 위에 이름과 숙박일수를 얹는다. */}
      <div className="relative h-[120px] w-full overflow-hidden bg-secondary">
        <img
          src={stay.imageUrl || DEFAULT_STAY_IMAGE}
          alt={`${stay.name} 숙소 사진`}
          className="media-card-image absolute inset-0 size-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <p className="min-w-0 flex-1 truncate text-lg font-extrabold text-white drop-shadow-sm">
            {stay.name}
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm tabular-nums">
            <Moon aria-hidden="true" className="size-3" />
            {nightsBetween(stay)}박
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1 rounded-xl bg-secondary p-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <LogIn className="size-3.5" />
              체크인
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {stampLabel(stay.checkInDate, stay.checkInTime)}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-secondary p-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <LogOut className="size-3.5" />
              체크아웃
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {stampLabel(stay.checkOutDate, stay.checkOutTime)}
            </span>
          </div>
        </div>

        {stay.address ? (
          <ContactLine kind="address" value={stay.address} className="text-sm" textClassName="text-pretty" />
        ) : null}

        {stay.phone ? (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="size-4 shrink-0 text-muted-foreground" />
            <a
              href={`tel:${stay.phone.replace(/[^\d+]/g, "")}`}
              className="font-semibold tabular-nums underline-offset-4 hover:underline"
            >
              {stay.phone}
            </a>
          </div>
        ) : null}

        {stay.memo ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {stay.memo
                .split(/[·\/]/)
                .map((part) => part.trim())
                .filter(Boolean)
                .map((tag) => (
                  <Badge key={tag} variant="secondary" className="rounded-full font-medium">
                    {tag}
                  </Badge>
                ))}
            </div>
          </div>
        ) : null}

        <Button
          render={<a href={mapHref} target="_blank" rel="noreferrer" />}
          nativeButton={false}
          size="sm"
          className="w-fit rounded-full font-semibold"
        >
          <Navigation data-icon="inline-start" />
          길찾기
        </Button>
      </div>
    </li>
  )
}

export function StaySection({ trip }: { trip: Trip }) {
  const { staysByTrip } = useTrips()
  const stays = staysByTrip[trip.id] ?? []

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <BedDouble className="size-3.5" />
          숙소 · 호텔
        </CardDescription>
        <CardTitle className="text-lg font-bold">숙소 정보</CardTitle>
        {stays.length > 0 ? (
          <CardAction>
            <StayDialog
              trip={trip}
              trigger={
                <Button variant="outline" size="sm" className="rounded-full font-semibold">
                  <Plus data-icon="inline-start" />
                  숙소 추가
                </Button>
              }
            />
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent>
        {stays.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {stays.map((stay) => (
              <StayItem key={stay.id} stay={stay} />
            ))}
          </ul>
        ) : (
          <Empty className="border border-dashed border-border bg-secondary/40 py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12 rounded-2xl bg-primary/15">
                <BedDouble className="size-6 text-foreground" />
              </EmptyMedia>
              <EmptyTitle className="text-base font-bold">
                아직 등록된 숙소 정보가 없어요.
              </EmptyTitle>
              <EmptyDescription className="text-xs">
                체크인·체크아웃만 입력하면 멤버 모두가 함께 확인할 수 있어요.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <StayDialog
                trip={trip}
                trigger={
                  <Button size="lg" className="w-full rounded-full font-semibold">
                    <Plus data-icon="inline-start" />
                    숙소 등록
                  </Button>
                }
              />
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
