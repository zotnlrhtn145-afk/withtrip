"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, Search, Wallet } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { FALLBACK_TRIP_COVER } from "@/lib/getCityImage"
import { type Trip } from "@/lib/trip-data"
import { cn } from "@/lib/utils"

/** Settled when trip data from DB/store says so (not localStorage-only). */
export function isTripSettled(trip: Trip): boolean {
  if (trip.isSettled === true || trip.isCompleted === true) return true
  const status = String(trip.settlementStatus ?? trip.status ?? "").toUpperCase()
  return status === "SETTLED" || status === "COMPLETED"
}

/** In-progress settlements for the quick-access strip / picker. */
export function isSettlementInProgress(trip: Trip): boolean {
  return !isTripSettled(trip)
}

function matchesQuery(trip: Trip, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    trip.title.toLowerCase().includes(q) ||
    trip.region.toLowerCase().includes(q) ||
    trip.country.toLowerCase().includes(q)
  )
}

export function SettlementSubPanel({
  trips,
  selectedTripId,
  onSelectTrip,
}: {
  trips: Trip[]
  selectedTripId?: string | null
  onSelectTrip: (trip: Trip) => void
}) {
  const [query, setQuery] = useState("")
  /** Short-lived optimistic overlay until trips store / refresh catches up. */
  const [optimisticSettled, setOptimisticSettled] = useState<
    Record<string, boolean>
  >({})

  useEffect(() => {
    // Drop optimistic entries once store trips reflect the same value.
    setOptimisticSettled((prev) => {
      let changed = false
      const next = { ...prev }
      for (const [id, settled] of Object.entries(prev)) {
        const trip = trips.find((item) => item.id === id)
        if (trip && isTripSettled(trip) === settled) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })

    const onSettled = (event: Event) => {
      const detail = (event as CustomEvent<{ tripId?: string; settled?: boolean }>).detail
      const id = String(detail?.tripId ?? "").trim()
      if (!id) return
      setOptimisticSettled((prev) => ({ ...prev, [id]: Boolean(detail?.settled) }))
    }
    window.addEventListener("withtrip:trip-settled", onSettled)
    return () => window.removeEventListener("withtrip:trip-settled", onSettled)
  }, [trips])

  const resolvedSettled = (trip: Trip) => {
    if (typeof optimisticSettled[trip.id] === "boolean") {
      return optimisticSettled[trip.id]
    }
    return isTripSettled(trip)
  }

  const inProgressTrips = useMemo(
    () =>
      trips.filter(
        (trip) => !resolvedSettled(trip) && matchesQuery(trip, query)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trips, query, optimisticSettled]
  )

  const completedTrips = useMemo(
    () =>
      trips.filter(
        (trip) => resolvedSettled(trip) && matchesQuery(trip, query)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trips, query, optimisticSettled]
  )

  return (
    <motion.aside
      aria-label="참여 여행"
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 34, mass: 0.85 }}
      className="sticky top-0 z-40 flex h-screen w-[19.5rem] shrink-0 flex-col border-r border-border bg-card"
    >
      <div className="flex flex-col gap-3 border-b border-border px-3 pb-3 pt-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[15px] font-extrabold tracking-tight">정산</h2>
          <Wallet className="size-4 text-muted-foreground" />
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="여행 검색"
            className="h-9 rounded-xl border-border/80 bg-secondary/60 pl-8 text-sm"
          />
        </div>

        <p className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          정산 진행 중인 여행
        </p>

        <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
          {inProgressTrips.length === 0 ? (
            <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">
              진행 중인 정산이 없어요
            </p>
          ) : (
            <ul className="flex gap-3">
              {inProgressTrips.map((trip) => {
                const selected = trip.id === selectedTripId
                return (
                  <li key={trip.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectTrip(trip)}
                      className="flex w-[4.25rem] flex-col items-center gap-1.5"
                      aria-label={`${trip.title} 정산으로 이동`}
                    >
                      <span
                        className={cn(
                          "relative flex size-14 items-center justify-center rounded-full p-[2.5px] transition-colors duration-200",
                          selected
                            ? "bg-gradient-to-br from-yellow-300 via-primary to-amber-500"
                            : "bg-border"
                        )}
                      >
                        <span className="relative size-full overflow-hidden rounded-full bg-card ring-2 ring-card">
                          <Image
                            src={trip.heroImage || FALLBACK_TRIP_COVER}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        </span>
                      </span>
                      <span
                        className={cn(
                          "w-full truncate text-center text-[10px] font-semibold transition-colors duration-200",
                          selected ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {trip.title}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <p className="px-4 pt-3 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          정산 완료된 여행
        </p>
        <ul className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {completedTrips.length === 0 ? (
            <li className="rounded-xl bg-secondary/70 px-3 py-4 text-center text-xs text-muted-foreground">
              {query.trim()
                ? "검색 결과가 없어요."
                : "정산 완료된 여행이 아직 없어요."}
            </li>
          ) : (
            completedTrips.map((trip) => {
              const selected = trip.id === selectedTripId
              return (
                <li key={trip.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTrip(trip)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-2.5 py-2.5 text-left transition-[background-color,border-color,box-shadow,opacity] duration-200",
                      "opacity-80",
                      selected
                        ? "border-yellow-300/90 bg-yellow-100/80 shadow-sm opacity-100"
                        : "border-transparent bg-[#EFEBE3]/90 hover:bg-[#E8E2D6]"
                    )}
                  >
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-secondary grayscale-[40%]">
                      <Image
                        src={trip.heroImage || FALLBACK_TRIP_COVER}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <CheckCircle2 className="size-5 text-emerald-300 drop-shadow" />
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm font-semibold",
                            !selected && "text-muted-foreground"
                          )}
                        >
                          {trip.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="h-5 shrink-0 border-emerald-300/80 bg-emerald-50 px-1.5 text-[10px] text-emerald-800"
                        >
                          정산 완료
                        </Badge>
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {trip.startDate} — {trip.endDate}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700/90">
                        <CheckCircle2 className="size-3 shrink-0" />
                        정산 완료
                      </span>
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </motion.aside>
  )
}
