"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react"

import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FALLBACK_TRIP_COVER } from "@/lib/getCityImage"
import { formatTripDuration, getTripMembers, members, type Trip } from "@/lib/trip-data"

export function TripDetailHero({ trip }: { trip: Trip }) {
  const router = useRouter()
  const tripMembers = getTripMembers(trip, members)
  const [coverSrc, setCoverSrc] = useState(trip.heroImage || FALLBACK_TRIP_COVER)

  useEffect(() => {
    setCoverSrc(trip.heroImage || FALLBACK_TRIP_COVER)
  }, [trip.heroImage])

  return (
    <header className="relative isolate min-h-[280px] overflow-hidden sm:min-h-[320px]">
      <Image
        src={coverSrc}
        alt={trip.heroImageAlt}
        fill
        priority
        sizes="100vw"
        className="object-cover"
        onError={() => setCoverSrc(FALLBACK_TRIP_COVER)}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-gradient-to-t from-black/85 via-black/45 to-black/20"
      />

      <div className="relative z-20 mx-auto flex h-full min-h-[280px] max-w-3xl flex-col justify-between gap-6 px-4 py-4 sm:min-h-[320px] sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => router.push("/")}
            aria-label="홈으로 돌아가기"
            className="size-10 rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md hover:bg-black/50 hover:text-white"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <Badge className="h-8 rounded-full px-3 text-sm font-bold tabular-nums shadow-sm">
            D-{trip.dDay}
          </Badge>
        </div>

        <div className="flex flex-col gap-3 pb-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90">
            <MapPin className="size-3.5" />
            {trip.region} · {trip.country}
          </span>
          <h1 className="text-3xl leading-tight font-bold text-balance text-white drop-shadow-sm sm:text-4xl">
            {trip.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/90">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <CalendarDays className="size-4" />
              {trip.startDate} — {trip.endDate}
            </span>
            <span className="font-semibold tabular-nums">
              {formatTripDuration(trip.nights, trip.days)}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <AvatarGroup className="-space-x-1.5">
              {tripMembers.map((member) => (
                <Avatar key={member.id} className="size-8 ring-2 ring-black/40">
                  <AvatarFallback className={`${member.color} text-xs font-semibold`}>
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
              ))}
            </AvatarGroup>
            <span className="text-sm text-white/90">멤버 {tripMembers.length}명</span>
          </div>
        </div>
      </div>
    </header>
  )
}
