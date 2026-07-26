"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Pencil, Plane, PlaneTakeoff, Plus, Trash2 } from "lucide-react"

import { FlightRegisterModal } from "@/components/trips/FlightRegisterModal"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  deleteTripFlight,
  fetchFlightsByTripId,
  type FlightType,
  type TripFlight,
} from "@/lib/flights-api"
import { cn } from "@/lib/utils"

function airlineAccent(name: string) {
  const n = name.toLowerCase()
  if (n.includes("대한") || n.includes("korean")) return "#00256C"
  if (n.includes("아시아나") || n.includes("asiana")) return "#B3141B"
  if (n.includes("제주") || n.includes("jeju")) return "#F36F21"
  if (n.includes("진에어") || n.includes("jin")) return "#0F9B4A"
  if (n.includes("티웨이") || n.includes("t'way") || n.includes("tway")) return "#C8102E"
  return "#57534E"
}

function airlineCodeHint(flight: TripFlight) {
  if (flight.flightNo.trim().length >= 2) return flight.flightNo.trim().slice(0, 2).toUpperCase()
  return ""
}

function TypeBadge({ flightType, segmentOrder }: { flightType: FlightType; segmentOrder: number }) {
  if (flightType === "OUTBOUND") {
    return (
      <span className="inline-flex items-center rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-700 ring-1 ring-sky-500/25 dark:text-sky-300">
        🟦 가는 편 / 출국
      </span>
    )
  }
  if (flightType === "RETURN") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-300">
        🟩 오는 편 / 귀국
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-orange-500/15 px-2.5 py-1 text-[11px] font-bold text-orange-700 ring-1 ring-orange-500/25 dark:text-orange-300">
      🟧 경유 {segmentOrder}
    </span>
  )
}

function TicketRoute({ flight }: { flight: TripFlight }) {
  return (
    <div className="relative flex items-center gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-2xl leading-none font-extrabold">{flight.fromCode}</span>
        <span className="text-base leading-none font-bold tabular-nums">{flight.departTime}</span>
        {flight.departDate ? (
          <span className="text-xs text-muted-foreground tabular-nums">{flight.departDate}</span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
        {flight.duration ? (
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
            {flight.duration}
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
        <span className="text-base leading-none font-bold tabular-nums">{flight.arriveTime}</span>
        {flight.arriveDate ? (
          <span className="text-xs text-muted-foreground tabular-nums">{flight.arriveDate}</span>
        ) : null}
      </div>
    </div>
  )
}

function TicketActions({
  deleting,
  onEdit,
  onDelete,
  editLabel = "항공권 수정",
  deleteLabel = "항공권 삭제",
}: {
  deleting: boolean
  onEdit: () => void
  onDelete: () => void
  editLabel?: string
  deleteLabel?: string
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={editLabel}
        disabled={deleting}
        onClick={onEdit}
        className="text-muted-foreground hover:text-foreground"
      >
        <Pencil />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={deleteLabel}
        disabled={deleting}
        onClick={onDelete}
        className="text-muted-foreground hover:text-destructive"
      >
        {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    </div>
  )
}

function FlightTicket({
  flight,
  onEdit,
  onDelete,
  deleting,
}: {
  flight: TripFlight
  onEdit: (flight: TripFlight) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const accent = airlineAccent(flight.airlineName)
  const code = airlineCodeHint(flight)
  const badgeLabel = [flight.airlineName, flight.flightNo].filter(Boolean).join(" · ")

  return (
    <li className="relative overflow-hidden rounded-2xl bg-secondary/70 ring-1 ring-border">
      {code ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-3 -bottom-6 scale-125 font-mono text-7xl leading-none font-black tracking-tighter text-foreground opacity-10 select-none"
        >
          {code}
        </span>
      ) : (
        <Plane
          aria-hidden="true"
          className="pointer-events-none absolute -right-5 -bottom-5 size-24 scale-125 text-foreground opacity-10"
        />
      )}

      <div className="relative flex items-start justify-between gap-2 px-5 pt-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <TypeBadge flightType={flight.flightType} segmentOrder={flight.segmentOrder} />
          {badgeLabel ? (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-card px-2.5 py-1 ring-1 ring-border">
              <Plane aria-hidden="true" className="size-3.5 shrink-0" style={{ color: accent }} />
              <span className="truncate text-xs font-bold">{badgeLabel}</span>
            </span>
          ) : null}
        </div>
        <TicketActions
          deleting={deleting}
          onEdit={() => onEdit(flight)}
          onDelete={() => onDelete(flight.id)}
        />
      </div>

      <div className="relative px-5 pt-3 pb-5">
        <TicketRoute flight={flight} />
      </div>
    </li>
  )
}

function LayoverJourney({
  flights,
  deletingId,
  onEdit,
  onDelete,
}: {
  flights: TripFlight[]
  deletingId: string | null
  onEdit: (flight: TripFlight) => void
  onDelete: (id: string) => void
}) {
  return (
    <li className="overflow-hidden rounded-2xl bg-secondary/70 ring-1 ring-border">
      <div className="flex flex-col gap-0 px-5 py-4">
        {flights.map((flight, index) => {
          const accent = airlineAccent(flight.airlineName)
          const badgeLabel = [flight.airlineName, flight.flightNo].filter(Boolean).join(" · ")
          const deleting = deletingId === flight.id

          return (
            <div key={flight.id} className="relative">
              {index > 0 ? (
                <div className="flex items-center gap-2 py-2 pl-1" aria-hidden="true">
                  <span className="w-px flex-none self-stretch border-l border-dashed border-orange-400/70" />
                  <span className="text-[11px] font-semibold tracking-wide text-orange-600/80 uppercase">
                    경유 연결
                  </span>
                  <span className="h-0 flex-1 border-t border-dashed border-orange-400/50" />
                </div>
              ) : null}

              <div className="rounded-xl bg-card/60 p-3 ring-1 ring-border/60">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <TypeBadge flightType="LAYOVER" segmentOrder={flight.segmentOrder} />
                    {badgeLabel ? (
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 ring-1 ring-border">
                        <Plane
                          aria-hidden="true"
                          className="size-3.5 shrink-0"
                          style={{ color: accent }}
                        />
                        <span className="truncate text-xs font-bold">{badgeLabel}</span>
                      </span>
                    ) : null}
                  </div>
                  <TicketActions
                    deleting={deleting}
                    editLabel={`경유 ${flight.segmentOrder} 수정`}
                    deleteLabel={`경유 ${flight.segmentOrder} 삭제`}
                    onEdit={() => onEdit(flight)}
                    onDelete={() => onDelete(flight.id)}
                  />
                </div>
                <TicketRoute flight={flight} />
              </div>
            </div>
          )
        })}
      </div>
    </li>
  )
}

/**
 * Supabase `trip_flights` 연동 비행기 일정 섹션 (좌측 5컬럼용).
 */
export function FlightSection({
  tripId,
  onFlightChange,
}: {
  tripId: string
  /** Called after a successful create/update/delete so hero (and others) can refetch. */
  onFlightChange?: () => void
}) {
  const [flights, setFlights] = useState<TripFlight[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFlight, setEditingFlight] = useState<TripFlight | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchFlightsByTripId(tripId)
      setFlights(data)
    } catch (err) {
      console.error("[FlightSection] load failed:", err)
      setFlights([])
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    void load()
  }, [load])

  const openCreateModal = () => {
    setEditingFlight(null)
    setModalOpen(true)
  }

  const openEditModal = (flight: TripFlight) => {
    setEditingFlight(flight)
    setModalOpen(true)
  }

  const handleModalOpenChange = (next: boolean) => {
    setModalOpen(next)
    if (!next) setEditingFlight(null)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const ok = await deleteTripFlight(id)
      if (ok) {
        setFlights((current) => current.filter((item) => item.id !== id))
        onFlightChange?.()
      }
    } finally {
      setDeletingId(null)
    }
  }

  const listBlocks = useMemo(() => {
    const outbound = flights.filter((flight) => flight.flightType === "OUTBOUND")
    const returnFlights = flights.filter((flight) => flight.flightType === "RETURN")
    const layover = flights.filter((flight) => flight.flightType === "LAYOVER")
    const unknown = flights.filter(
      (flight) =>
        flight.flightType !== "OUTBOUND" &&
        flight.flightType !== "RETURN" &&
        flight.flightType !== "LAYOVER"
    )

    return { outbound, returnFlights, layover, unknown }
  }, [flights])

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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openCreateModal}
              className="rounded-full font-semibold"
            >
              <Plus data-icon="inline-start" />
              항공권 추가
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">항공권을 불러오는 중…</p>
          </div>
        ) : flights.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {listBlocks.outbound.map((flight) => (
              <FlightTicket
                key={flight.id}
                flight={flight}
                deleting={deletingId === flight.id}
                onEdit={openEditModal}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}

            {listBlocks.layover.length > 0 ? (
              <LayoverJourney
                flights={listBlocks.layover}
                deletingId={deletingId}
                onEdit={openEditModal}
                onDelete={(id) => void handleDelete(id)}
              />
            ) : null}

            {listBlocks.returnFlights.map((flight) => (
              <FlightTicket
                key={flight.id}
                flight={flight}
                deleting={deletingId === flight.id}
                onEdit={openEditModal}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}

            {listBlocks.unknown.map((flight) => (
              <FlightTicket
                key={flight.id}
                flight={flight}
                deleting={deletingId === flight.id}
                onEdit={openEditModal}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}
          </ul>
        ) : (
          <div
            className={cn(
              "flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border",
              "bg-secondary/40 px-6 py-10 text-center"
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <PlaneTakeoff className="size-6" />
            </span>
            <div className="flex flex-col gap-1.5">
              <p className="text-base font-bold">아직 등록된 비행기 일정이 없어요.</p>
              <p className="text-xs text-muted-foreground">
                출국·귀국·경유를 구분해 등록하면 티켓 카드로 정리됩니다.
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              onClick={openCreateModal}
              className="w-full max-w-xs rounded-full font-semibold"
            >
              <Plus data-icon="inline-start" />
              비행기 일정 등록
            </Button>
          </div>
        )}
      </CardContent>

      <FlightRegisterModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        tripId={tripId}
        existingFlights={flights}
        editingFlight={editingFlight}
        onSaved={() => {
          void load()
          onFlightChange?.()
        }}
      />
    </Card>
  )
}
