"use client"

import { useEffect, useState } from "react"
import { Compass, Loader2, Plane, Plus, SearchX, X } from "lucide-react"

import { CreateTripDialog } from "@/components/create-trip-dialog"
import { TripBannerCard } from "@/components/trip-banner-card"
import { useTrips } from "@/components/trips-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { type Trip } from "@/lib/trip-data"

export function HomeView({
  onSelectTrip,
  compact = false,
}: {
  onSelectTrip: (trip: Trip) => void
  compact?: boolean
}) {
  const { trips, filteredTrips, query, setQuery, loading, error, refreshTrips } = useTrips()
  const isFiltered = query.trim().length > 0
  // Keep SSR + first client paint identical (avoids hydration mismatch on subtitle / list).
  const [hasMounted, setHasMounted] = useState(false)
  useEffect(() => {
    setHasMounted(true)
  }, [])

  const showLoading = !hasMounted || loading

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">계획한 여행</h2>
          <p className="text-sm text-muted-foreground">
            {showLoading
              ? "여행 목록을 불러오는 중이에요…"
              : `총 ${trips.length}개의 여행이 준비되어 있어요. 카드를 눌러 상세 일정을 확인하세요.`}
          </p>
        </div>
        <CreateTripDialog
          trigger={
            <Button className="hidden rounded-full font-semibold md:inline-flex">
              <Plus data-icon="inline-start" />
              새 여행 만들기
            </Button>
          }
        />
      </div>

      {error && hasMounted ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void refreshTrips()} className="rounded-full">
            다시 불러오기
          </Button>
        </div>
      ) : null}

      {isFiltered ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary px-3 py-2">
          <span className="text-sm font-medium">검색 필터</span>
          <Badge variant="outline" className="bg-card">
            {query}
          </Badge>
          <span className="text-sm text-muted-foreground tabular-nums">
            {filteredTrips.length}개 일치
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setQuery("")}
            className="ml-auto font-semibold"
          >
            <X data-icon="inline-start" />
            필터 해제
          </Button>
        </div>
      ) : null}

      {showLoading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Supabase에서 여행을 불러오는 중…</p>
        </div>
      ) : trips.length === 0 && !isFiltered ? (
        <div className="w-full max-w-2xl mx-auto p-8 md:p-12 rounded-3xl border-2 border-dashed border-amber-300/70 bg-white/50 backdrop-blur-sm flex flex-col items-center justify-center text-center transition-all min-h-[70vh]">
          <div className="rounded-full bg-gradient-to-tr from-amber-400 via-rose-400 to-amber-500 p-[2.5px] shadow-md">
            <span className="flex size-16 items-center justify-center rounded-full bg-white">
              <Compass className="size-7 text-amber-500" />
            </span>
          </div>
          <h3 className="mt-6 mb-2 text-xl font-bold tracking-tight text-gray-900 md:text-2xl">
            첫 번째 여행을 기록해 보세요
          </h3>
          <p className="mx-auto mb-8 max-w-sm text-sm leading-relaxed text-gray-500">
            친구들과 함께 일정을 계획하고 정산까지 한곳에서 스마트하게 관리할 수
            있어요.
          </p>
          <CreateTripDialog
            trigger={
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-7 py-3.5 text-sm font-semibold text-black shadow-lg shadow-amber-200/50 transition-all hover:scale-105 hover:bg-amber-500 active:scale-95"
              >
                <Plus className="size-4" />
                새 여행 시작하기
              </button>
            }
          />
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-secondary">
            <SearchX className="size-5" />
          </span>
          <p className="text-sm font-semibold">{`"${query}" 와 일치하는 여행이 없어요`}</p>
          <p className="text-sm text-muted-foreground">
            다른 키워드로 검색하거나 새 여행을 만들어 보세요.
          </p>
          <Button variant="outline" onClick={() => setQuery("")} className="rounded-full font-semibold">
            전체 여행 보기
          </Button>
        </div>
      ) : (
        <div className={compact ? "flex flex-col gap-4" : "grid gap-5 xl:grid-cols-2"}>
          {filteredTrips.map((trip, index) => (
            <TripBannerCard
              key={trip.id}
              trip={trip}
              onSelect={onSelectTrip}
              priority={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
