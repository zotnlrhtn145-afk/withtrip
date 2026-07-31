"use client"

import { WishlistSection } from "@/components/itinerary/wishlist-section"
import { AccommodationSection } from "@/components/trips/AccommodationSection"
import { FlightSection } from "@/components/trips/FlightSection"
import { ScheduleSection } from "@/components/trips/ScheduleSection"
import { type Trip } from "@/lib/trip-data"

/**
 * 상세 페이지 2컬럼 보드
 * 좌(5): 비행기 일정 → 숙소 정보 → 가고 싶은 곳
 * 우(7): 여행 일정 타임라인
 */
export function TripScheduleBoard({
  trip,
  onFlightChange,
  autoOpenAddPlace = false,
  onAutoOpenAddPlaceHandled,
}: {
  trip: Trip
  onFlightChange?: () => void
  autoOpenAddPlace?: boolean
  onAutoOpenAddPlaceHandled?: () => void
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="flex flex-col gap-5 lg:col-span-5">
        <FlightSection tripId={trip.id} onFlightChange={onFlightChange} />
        <AccommodationSection
          tripId={trip.id}
          tripStartDate={trip.startDate}
          tripEndDate={trip.endDate}
        />
        <WishlistSection
          trip={trip}
          autoOpenAdd={autoOpenAddPlace}
          onAutoOpenHandled={onAutoOpenAddPlaceHandled}
        />
      </div>
      <div className="min-w-0 lg:col-span-7">
        <div className="h-full rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md sm:p-6">
          <ScheduleSection
            tripId={trip.id}
            tripStartDate={trip.startDate}
            tripCity={trip.title.split(/[·•]/)[0]?.trim() || trip.region}
          />
        </div>
      </div>
    </div>
  )
}
