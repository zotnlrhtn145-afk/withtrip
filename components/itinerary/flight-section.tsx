"use client"

import { Plane, PlaneTakeoff, Plus } from "lucide-react"

import { FlightDialog } from "@/components/itinerary/flight-dialog"
import { useTrips } from "@/components/trips-store"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { resolveAirline } from "@/lib/airlines"
import type { Trip } from "@/lib/trip-data"
import type { FlightEntry } from "@/lib/trip-itinerary"
import { cn } from "@/lib/utils"

function durationLabel(flight: FlightEntry) {
  const [dh, dm] = flight.departTime.split(":").map(Number)
  const [ah, am] = flight.arriveTime.split(":").map(Number)
  const depart = new Date(`${flight.departDate.replace(/\./g, "-")}T00:00:00`)
  const arrive = new Date(`${flight.arriveDate.replace(/\./g, "-")}T00:00:00`)
  const minutes =
    (arrive.getTime() - depart.getTime()) / 60000 + (ah * 60 + am) - (dh * 60 + dm)
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  return `${hours}시간 ${rest}분`
}

function FlightTicket({ flight }: { flight: FlightEntry }) {
  const duration = durationLabel(flight)
  const airline = resolveAirline(flight.airlineId, flight.airlineName, flight.flightNo)
  const badgeLabel = [airline.name, flight.flightNo].filter(Boolean).join(" · ")

  return (
    <li className="relative overflow-hidden rounded-2xl bg-secondary/70 ring-1 ring-border">
      {/* 항공사 워터마크 — 우측 배경에 IATA 코드를 크게 깔아 브랜드감을 준다. */}
      {airline.code ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-3 -bottom-6 scale-125 font-mono text-7xl leading-none font-black tracking-tighter text-foreground opacity-10 select-none"
        >
          {airline.code}
        </span>
      ) : (
        <Plane
          aria-hidden="true"
          className="pointer-events-none absolute -right-5 -bottom-5 size-24 scale-125 text-foreground opacity-10"
        />
      )}

      {badgeLabel ? (
        <div className="relative flex items-center gap-1.5 px-5 pt-4">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-card px-2.5 py-1 ring-1 ring-border">
            <Plane
              aria-hidden="true"
              className="size-3.5 shrink-0"
              style={{ color: airline.accent }}
            />
            <span className="truncate text-xs font-bold">{badgeLabel}</span>
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          "relative flex items-center gap-4 px-5 pb-5",
          badgeLabel ? "pt-3" : "pt-5"
        )}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-2xl leading-none font-extrabold">{flight.fromCode}</span>
          <span className="text-base leading-none font-bold tabular-nums">
            {flight.departTime}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">{flight.departDate}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          {duration ? (
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
              {duration}
            </span>
          ) : null}
          <div className="flex w-full items-center gap-1">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground/40" />
            <span
              aria-hidden="true"
              className="h-0 flex-1 border-t border-dashed border-foreground/30"
            />
            <PlaneTakeoff aria-hidden="true" className="size-4 text-foreground" />
            <span
              aria-hidden="true"
              className="h-0 flex-1 border-t border-dashed border-foreground/30"
            />
            <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground/40" />
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-end gap-1">
          <span className="font-mono text-2xl leading-none font-extrabold">{flight.toCode}</span>
          <span className="text-base leading-none font-bold tabular-nums">
            {flight.arriveTime}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">{flight.arriveDate}</span>
        </div>
      </div>
    </li>
  )
}

export function FlightSection({ trip }: { trip: Trip }) {
  const { flightsByTrip } = useTrips()
  const flights = flightsByTrip[trip.id] ?? []

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <PlaneTakeoff className="size-3.5" />
          항공권 · 이동 수단
        </CardDescription>
        <CardTitle className="text-lg font-bold">비행기 일정</CardTitle>
        {flights.length > 0 ? (
          <CardAction>
            <FlightDialog
              trip={trip}
              trigger={
                <Button variant="outline" size="sm" className="rounded-full font-semibold">
                  <Plus data-icon="inline-start" />
                  항공권 추가
                </Button>
              }
            />
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent>
        {flights.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {flights.map((flight) => (
              <FlightTicket key={flight.id} flight={flight} />
            ))}
          </ul>
        ) : (
          <Empty className="border border-dashed border-border bg-secondary/40 py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12 rounded-2xl bg-primary/15">
                <PlaneTakeoff className="size-6 text-foreground" />
              </EmptyMedia>
              <EmptyTitle className="text-base font-bold">
                아직 등록된 비행기 일정이 없어요.
              </EmptyTitle>
              <EmptyDescription className="text-xs">
                항공권을 등록하면 출발·도착 시간이 티켓 카드로 정리됩니다.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <FlightDialog
                trip={trip}
                trigger={
                  <Button size="lg" className="w-full rounded-full font-semibold">
                    <Plus data-icon="inline-start" />
                    비행기 일정 등록
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
