"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import {
  CalendarDays,
  ChevronRight,
  CloudRain,
  CloudSun,
  MapPin,
  Plane,
  Sun,
} from "lucide-react"

import { useTrips } from "@/components/trips-store"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { FALLBACK_TRIP_COVER } from "@/lib/getCityImage"
import { getTripMembers, formatTripDuration, type Trip } from "@/lib/trip-data"
import { formatMemberSummary } from "@/lib/trip-group"

const weatherIcons = {
  sun: Sun,
  "cloud-sun": CloudSun,
  rain: CloudRain,
} as const

export function TripBannerCard({
  trip,
  onSelect,
  priority = false,
}: {
  trip: Trip
  onSelect: (trip: Trip) => void
  priority?: boolean
}) {
  const { members } = useTrips()
  const WeatherIcon = weatherIcons[trip.weatherIcon]
  const tripMembers = trip.groupMembers?.length
    ? trip.groupMembers
    : getTripMembers(trip, members)
  const memberSummary = formatMemberSummary(tripMembers.map((member) => member.name))
  const [coverSrc, setCoverSrc] = useState(trip.heroImage || FALLBACK_TRIP_COVER)

  useEffect(() => {
    setCoverSrc(trip.heroImage || FALLBACK_TRIP_COVER)
  }, [trip.heroImage])

  return (
    <button
      type="button"
      onClick={() => onSelect(trip)}
      aria-label={`${trip.title} 상세 보기`}
      className="group media-card relative block h-64 w-full overflow-hidden rounded-2xl border border-border text-left ring-offset-2 ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-72"
    >
      <Image
        src={coverSrc}
        alt={trip.heroImageAlt}
        fill
        priority={priority}
        sizes="(min-width: 1280px) 640px, (min-width: 768px) 50vw, 100vw"
        className="media-card-image object-cover"
        onError={() => setCoverSrc(FALLBACK_TRIP_COVER)}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
      />

      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-4">
        <Badge className="h-8 rounded-full px-3 text-sm font-bold tabular-nums shadow-sm">
          D-{trip.dDay}
        </Badge>
        <Badge variant="secondary" className="h-8 rounded-full px-3">
          <WeatherIcon data-icon="inline-start" />
          {trip.weather}
        </Badge>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 p-4 sm:p-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90">
          <MapPin className="size-3.5" />
          {trip.region} · {trip.country}
        </span>

        <div className="flex items-end justify-between gap-3">
          <h3 className="text-2xl leading-tight font-bold text-balance text-white drop-shadow-sm sm:text-[1.75rem]">
            {trip.title}
          </h3>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:translate-x-0.5">
            <ChevronRight className="size-5" />
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/90">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <CalendarDays className="size-3.5" />
            {trip.startDate} — {trip.endDate}
          </span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Plane className="size-3.5" />
            {trip.flight}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <AvatarGroup className="-space-x-1.5">
            {tripMembers.map((member) => (
              <Avatar key={member.id} className="size-6 ring-2 ring-black/40">
                {"avatarUrl" in member && member.avatarUrl ? (
                  <AvatarImage src={member.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback className={`${member.color} text-[10px] font-semibold`}>
                  {member.initials}
                </AvatarFallback>
              </Avatar>
            ))}
          </AvatarGroup>
          <span className="truncate text-xs text-white/90">
            {memberSummary}
            <span className="text-white/70">
              {" "}
              · {formatTripDuration(trip.nights, trip.days)}
            </span>
          </span>
        </div>
      </div>
    </button>
  )
}
