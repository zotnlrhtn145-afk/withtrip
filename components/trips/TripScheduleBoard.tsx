"use client"

import { Card, CardContent } from "@/components/ui/card"
import { AccommodationSection } from "@/components/trips/AccommodationSection"
import { FlightSection } from "@/components/trips/FlightSection"
import { ScheduleSection } from "@/components/trips/ScheduleSection"
import { type Trip } from "@/lib/trip-data"

/**
 * 상세 페이지 상단 2컬럼 보드
 * 좌(5): 비행기 일정 + 숙소 정보
 * 우(7): Supabase 연동 여행 일정 (ScheduleSection)
 */
export function TripScheduleBoard({
  trip,
  onFlightChange,
}: {
  trip: Trip
  onFlightChange?: () => void
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="flex flex-col gap-6 lg:col-span-5">
        <FlightSection tripId={trip.id} onFlightChange={onFlightChange} />
        <AccommodationSection
          tripId={trip.id}
          tripStartDate={trip.startDate}
          tripEndDate={trip.endDate}
        />
      </div>
      <div className="min-w-0 lg:col-span-7">
        <Card className="h-full">
          <CardContent className="pt-6">
            <ScheduleSection
              tripId={trip.id}
              tripStartDate={trip.startDate}
              tripCity={trip.title.split(/[·•]/)[0]?.trim() || trip.region}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
