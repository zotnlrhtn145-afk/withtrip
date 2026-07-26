"use client"

import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
import {
  CalendarDays,
  CloudRain,
  CloudSun,
  MapPin,
  Pencil,
  Share2,
  Sun,
  UserPlus,
} from "lucide-react"

import { EditTripDialog } from "@/components/edit-trip-dialog"
import { useTrips } from "@/components/trips-store"
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { fetchFlightsByTripId, type TripFlight } from "@/lib/flights-api"
import { getTripMembers, formatTripDuration, type Trip } from "@/lib/trip-data"
import { FALLBACK_TRIP_COVER } from "@/lib/getCityImage"

const weatherIcons = {
  sun: Sun,
  "cloud-sun": CloudSun,
  rain: CloudRain,
} as const

const EMPTY_FLIGHT_LABEL = "✈️ 항공편 미등록"

function routeArrow(fromCode: string, toCode: string) {
  return `${fromCode || "—"}→${toCode || "—"}`
}

function formatLayoverSuffix(layovers: TripFlight[]): string {
  if (layovers.length <= 0) return ""
  if (layovers.length === 1) {
    const code = layovers[0].toCode || layovers[0].fromCode
    return code ? ` (경유: ${code})` : " (경유 1회)"
  }
  return ` (경유 ${layovers.length}회)`
}

/** Build hero journey summary: 가는 편 / 경유 / 오는 편 */
function formatHeroFlightLabel(flights: TripFlight[]): string {
  if (flights.length === 0) return EMPTY_FLIGHT_LABEL

  const outbound = flights.find((flight) => flight.flightType === "OUTBOUND")
  const layovers = flights
    .filter((flight) => flight.flightType === "LAYOVER")
    .sort((a, b) => a.segmentOrder - b.segmentOrder)
  const inbound = flights.find((flight) => flight.flightType === "RETURN")

  let goingPart = ""

  if (outbound) {
    goingPart = `가는 편: ${routeArrow(outbound.fromCode, outbound.toCode)}${formatLayoverSuffix(layovers)}`
  } else if (layovers.length > 0) {
    const first = layovers[0]
    const last = layovers[layovers.length - 1]
    goingPart =
      layovers.length === 1
        ? `가는 편: ${routeArrow(first.fromCode, first.toCode)}`
        : `가는 편: ${routeArrow(first.fromCode, last.toCode)}${formatLayoverSuffix(layovers)}`
  }

  const returnPart = inbound
    ? `오는 편: ${routeArrow(inbound.fromCode, inbound.toCode)}`
    : ""

  const summary = [goingPart, returnPart].filter(Boolean).join(" · ")
  return summary ? `✈️ ${summary}` : EMPTY_FLIGHT_LABEL
}

export function TripHeroCard({
  trip,
  compact = false,
  flightsRevision = 0,
}: {
  trip: Trip
  compact?: boolean
  /** Bump when trip_flights change so the hero refetches. */
  flightsRevision?: number
}) {
  const { members } = useTrips()
  const [flightLabel, setFlightLabel] = useState(EMPTY_FLIGHT_LABEL)
  const tripMembers = getTripMembers(trip, members)
  const visibleMembers = tripMembers.slice(0, 3)
  const hiddenCount = tripMembers.length - visibleMembers.length
  const WeatherIcon = weatherIcons[trip.weatherIcon]
  const [coverSrc, setCoverSrc] = useState(trip.heroImage || FALLBACK_TRIP_COVER)

  const fetchHeroFlightData = useCallback(async () => {
    try {
      const flights = await fetchFlightsByTripId(trip.id)
      setFlightLabel(formatHeroFlightLabel(flights))
    } catch (err) {
      console.error("[TripHeroCard] fetchHeroFlightData failed:", err)
      setFlightLabel(EMPTY_FLIGHT_LABEL)
    }
  }, [trip.id])

  useEffect(() => {
    void fetchHeroFlightData()
  }, [fetchHeroFlightData, flightsRevision])

  useEffect(() => {
    setCoverSrc(trip.heroImage || FALLBACK_TRIP_COVER)
  }, [trip.heroImage])
  return (
    <Card className="relative border-0 p-0 ring-0">
      <div className={compact ? "relative h-44 w-full" : "relative h-56 w-full md:h-64"}>
        <Image
          src={coverSrc}
          alt={trip.heroImageAlt}
          fill
          priority
          sizes="(min-width: 1024px) 900px, 100vw"
          className="object-cover"
          onError={() => setCoverSrc(FALLBACK_TRIP_COVER)}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
        />

        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4">
          <Badge className="h-8 rounded-full px-3 text-sm font-bold tabular-nums shadow-sm">
            D-{trip.dDay}
          </Badge>
          <Badge variant="secondary" className="h-8 rounded-full px-3">
            <WeatherIcon data-icon="inline-start" />
            {trip.weather}
          </Badge>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-white/90">
            <MapPin className="size-3.5" />
            <span>
              {trip.region} · {trip.country}
            </span>
          </div>
          <h2 className="text-2xl leading-tight font-bold text-balance text-white drop-shadow-sm">
            {trip.title}
          </h2>
          <div className="flex min-w-0 max-w-full items-center gap-3 overflow-x-auto text-[11px] text-white/90 sm:text-xs">
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap tabular-nums">
              <CalendarDays className="size-3.5 shrink-0" />
              {trip.startDate} — {trip.endDate}
            </span>
            <span
              className="min-w-0 truncate whitespace-nowrap"
              title={flightLabel}
            >
              {flightLabel}
            </span>
          </div>
        </div>
      </div>

      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
        <div className="flex items-center gap-3">
          <AvatarGroup className="-space-x-1.5">
            {visibleMembers.map((member) => (
              <Avatar key={member.id}>
                <AvatarFallback className={`${member.color} text-xs font-semibold`}>
                  {member.initials}
                </AvatarFallback>
              </Avatar>
            ))}
            {hiddenCount > 0 ? (
              <AvatarGroupCount className="text-xs font-semibold">
                +{hiddenCount}
              </AvatarGroupCount>
            ) : null}
          </AvatarGroup>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">멤버 {tripMembers.length}명</span>
            <span className="text-xs text-muted-foreground">
              {formatTripDuration(trip.nights, trip.days)} 일정 함께 편집 중
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EditTripDialog
            trip={trip}
            trigger={
              <Button variant="outline" size="lg" className="rounded-full font-semibold">
                <Pencil data-icon="inline-start" />
                편집
              </Button>
            }
          />
          <Button variant="outline" size="lg" className="rounded-full font-semibold">
            <Share2 data-icon="inline-start" />
            공유
          </Button>
          <Button size="lg" className="rounded-full font-semibold">
            <UserPlus data-icon="inline-start" />
            멤버 초대하기
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
