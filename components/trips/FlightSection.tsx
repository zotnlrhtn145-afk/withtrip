"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { Loader2, Pencil, Plane, PlaneTakeoff, Plus, Trash2, UserRound } from "lucide-react"

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
  isFlightAuthor,
  type FlightType,
  type TripFlight,
} from "@/lib/flights-api"
import {
  fetchProfilesByIds,
  fetchTripRoster,
  type TripMember,
} from "@/lib/trip-members-api"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

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

function memberLabel(memberById: Map<string, TripMember>, userId: string) {
  const member = memberById.get(userId)
  if (member?.name) return member.name
  return "멤버"
}

function profileInitials(name: string) {
  const compact = name.replace(/\s+/g, "").trim()
  if (!compact) return "?"
  return compact.slice(0, 1).toUpperCase()
}

function PersonChip({
  label,
  name,
  avatarUrl,
  tone = "neutral",
}: {
  label: string
  name: string
  avatarUrl?: string
  tone?: "neutral" | "amber"
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = Boolean(avatarUrl) && !imgFailed

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 text-[11px] font-medium",
        tone === "amber"
          ? "bg-amber-50 text-amber-900/80"
          : "bg-zinc-100 text-zinc-700"
      )}
    >
      <span className="relative flex size-5 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-black/5">
        {showImage ? (
          // Kakao CDN / external avatar — plain img (not next/image)
          <img
            src={avatarUrl}
            alt=""
            className="size-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="flex size-full items-center justify-center bg-zinc-200 text-[9px] font-bold text-zinc-600">
            {name && name !== "멤버" ? (
              profileInitials(name)
            ) : (
              <UserRound className="size-3 text-zinc-500" aria-hidden="true" />
            )}
          </span>
        )}
      </span>
      <span className="truncate">
        {label} · {name}
      </span>
    </span>
  )
}

function FlightPeople({
  flight,
  memberById,
}: {
  flight: TripFlight
  memberById: Map<string, TripMember>
}) {
  const authorId = flight.createdBy || flight.userId
  const author = authorId ? memberById.get(authorId) : undefined
  const authorName = authorId ? memberLabel(memberById, authorId) : ""
  const passengers = flight.passengerIds
    .filter((id) => id && id !== authorId)
    .map((id) => ({
      id,
      name: memberLabel(memberById, id),
      avatarUrl: memberById.get(id)?.avatarUrl,
    }))

  if (!authorName && passengers.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {authorName ? (
        <PersonChip
          label="작성"
          name={authorName}
          avatarUrl={author?.avatarUrl}
          tone="neutral"
        />
      ) : null}
      {passengers.map((passenger) => (
        <PersonChip
          key={`${flight.id}-${passenger.id}`}
          label="동승"
          name={passenger.name}
          avatarUrl={passenger.avatarUrl}
          tone="amber"
        />
      ))}
    </div>
  )
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
  memberById,
  isAuthor,
  onEdit,
  onDelete,
  deleting,
}: {
  flight: TripFlight
  memberById: Map<string, TripMember>
  isAuthor: boolean
  onEdit: (flight: TripFlight) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const accent = airlineAccent(flight.airlineName)
  const code = airlineCodeHint(flight)
  const badgeLabel = [flight.airlineName, flight.flightNo].filter(Boolean).join(" · ")

  return (
    <li className="media-card relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm ring-0 transition-all hover:shadow-md">
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
        {isAuthor ? (
          <TicketActions
            deleting={deleting}
            onEdit={() => onEdit(flight)}
            onDelete={() => onDelete(flight.id)}
          />
        ) : null}
      </div>

      <div className="relative px-5 pt-3 pb-5">
        <TicketRoute flight={flight} />
        <FlightPeople flight={flight} memberById={memberById} />
      </div>
    </li>
  )
}

function LayoverJourney({
  flights,
  memberById,
  currentUserId,
  authReady,
  deletingId,
  onEdit,
  onDelete,
}: {
  flights: TripFlight[]
  memberById: Map<string, TripMember>
  currentUserId: string | null
  authReady: boolean
  deletingId: string | null
  onEdit: (flight: TripFlight) => void
  onDelete: (id: string) => void
}) {
  return (
    <li className="media-card overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm ring-0 transition-all hover:shadow-md">
      <div className="flex flex-col gap-0 px-5 py-4">
        {flights.map((flight, index) => {
          const accent = airlineAccent(flight.airlineName)
          const badgeLabel = [flight.airlineName, flight.flightNo].filter(Boolean).join(" · ")
          const deleting = deletingId === flight.id
          const isAuthor = authReady && isFlightAuthor(flight, currentUserId)

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
                  {isAuthor ? (
                    <TicketActions
                      deleting={deleting}
                      editLabel={`경유 ${flight.segmentOrder} 수정`}
                      deleteLabel={`경유 ${flight.segmentOrder} 삭제`}
                      onEdit={() => onEdit(flight)}
                      onDelete={() => onDelete(flight.id)}
                    />
                  ) : null}
                </div>
                <TicketRoute flight={flight} />
                <FlightPeople flight={flight} memberById={memberById} />
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
  const [roster, setRoster] = useState<TripMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFlight, setEditingFlight] = useState<TripFlight | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)

  const memberById = useMemo(() => {
    const map = new Map<string, TripMember>()
    for (const member of roster) map.set(member.userId, member)
    return map
  }, [roster])

  const currentUserId = user?.id ?? null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, members] = await Promise.all([
        fetchFlightsByTripId(tripId),
        fetchTripRoster(tripId),
      ])

      const profileIds = new Set<string>()
      for (const flight of data) {
        const authorId = String(flight.createdBy || flight.userId || "").trim()
        if (authorId) profileIds.add(authorId)
        for (const passengerId of flight.passengerIds) {
          const id = String(passengerId ?? "").trim()
          if (id) profileIds.add(id)
        }
      }
      for (const member of members) {
        if (member.userId) profileIds.add(member.userId)
      }

      const profiles = await fetchProfilesByIds([...profileIds])
      const byId = new Map<string, TripMember>()
      for (const member of members) byId.set(member.userId, member)
      for (const profile of profiles) {
        const prev = byId.get(profile.userId)
        byId.set(profile.userId, {
          ...prev,
          ...profile,
          // Prefer freshly loaded profile nickname/avatar over roster email fallbacks.
          name: profile.name || prev?.name || "멤버",
          avatarUrl: profile.avatarUrl || prev?.avatarUrl,
          email: profile.email || prev?.email || "",
          id: prev?.id || profile.id,
          userId: profile.userId,
          status: prev?.status ?? "accepted",
          role: prev?.role,
        })
      }

      // Enrich current session user (Kakao user_metadata) when profiles row is thin.
      try {
        const supabase = createClient()
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()
        if (authUser?.id && byId.has(authUser.id)) {
          const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>
          const metaName = [
            meta.full_name,
            meta.name,
            meta.nickname,
            meta.preferred_username,
          ]
            .map((value) => String(value ?? "").trim())
            .find((value) => Boolean(value) && !value.includes("@"))
          const metaAvatar = [meta.avatar_url, meta.picture, meta.profile_image]
            .map((value) => String(value ?? "").trim())
            .find(Boolean)
          const current = byId.get(authUser.id)!
          const looksLikeEmailLocal =
            Boolean(authUser.email) &&
            current.name === String(authUser.email).split("@")[0]
          byId.set(authUser.id, {
            ...current,
            name:
              metaName ||
              (!looksLikeEmailLocal && current.name !== "멤버" ? current.name : "") ||
              current.name,
            avatarUrl: metaAvatar || current.avatarUrl,
          })
        }
      } catch {
        // ignore auth metadata enrichment failures
      }

      setFlights(data)
      setRoster(Array.from(byId.values()))
    } catch (err) {
      console.error("[FlightSection] load failed:", err)
      setFlights([])
      setRoster([])
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    void (async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()
        if (!cancelled) {
          setUser(authUser ?? null)
          setAuthReady(true)
        }
      } catch {
        if (!cancelled) {
          setUser(null)
          setAuthReady(true)
        }
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      setUser(session?.user ?? null)
      setAuthReady(true)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const openCreateModal = () => {
    setEditingFlight(null)
    setModalOpen(true)
  }

  const openEditModal = (flight: TripFlight) => {
    if (!authReady || !isFlightAuthor(flight, currentUserId)) return
    setEditingFlight(flight)
    setModalOpen(true)
  }

  const handleModalOpenChange = (next: boolean) => {
    setModalOpen(next)
    if (!next) setEditingFlight(null)
  }

  const handleDelete = async (id: string) => {
    const target = flights.find((flight) => flight.id === id)
    if (!target || !authReady || !isFlightAuthor(target, currentUserId)) return
    if (!window.confirm("이 항공권을 삭제할까요?")) return

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
    <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm ring-0 transition-all hover:shadow-md">
      <CardHeader>
        <CardDescription className="mb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          Flight
        </CardDescription>
        <CardTitle className="text-lg font-bold tracking-tight text-slate-900">
          비행기 일정
        </CardTitle>
        {flights.length > 0 ? (
          <CardAction>
            <Button
              type="button"
              size="sm"
              onClick={openCreateModal}
              className="rounded-full bg-amber-400 px-4 text-xs font-bold text-slate-950 shadow-sm shadow-amber-400/20 hover:bg-amber-500"
            >
              <Plus data-icon="inline-start" />
              항공권 추가
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-10 text-center">
            <Loader2 className="size-6 animate-spin text-amber-500" />
            <p className="text-sm text-slate-500">항공권을 불러오는 중…</p>
          </div>
        ) : flights.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {listBlocks.outbound.map((flight) => (
              <FlightTicket
                key={flight.id}
                flight={flight}
                memberById={memberById}
                isAuthor={authReady && isFlightAuthor(flight, currentUserId)}
                deleting={deletingId === flight.id}
                onEdit={openEditModal}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}

            {listBlocks.layover.length > 0 ? (
              <LayoverJourney
                flights={listBlocks.layover}
                memberById={memberById}
                currentUserId={currentUserId}
                authReady={authReady}
                deletingId={deletingId}
                onEdit={openEditModal}
                onDelete={(id) => void handleDelete(id)}
              />
            ) : null}

            {listBlocks.returnFlights.map((flight) => (
              <FlightTicket
                key={flight.id}
                flight={flight}
                memberById={memberById}
                isAuthor={authReady && isFlightAuthor(flight, currentUserId)}
                deleting={deletingId === flight.id}
                onEdit={openEditModal}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}

            {listBlocks.unknown.map((flight) => (
              <FlightTicket
                key={flight.id}
                flight={flight}
                memberById={memberById}
                isAuthor={authReady && isFlightAuthor(flight, currentUserId)}
                deleting={deletingId === flight.id}
                onEdit={openEditModal}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
              <PlaneTakeoff className="size-5" />
            </span>
            <p className="text-sm font-bold text-slate-900">아직 등록된 비행기 일정이 없어요</p>
            <p className="mt-1 mb-5 max-w-xs text-xs leading-relaxed text-slate-500">
              출국·귀국·경유를 구분해 등록하면 티켓 카드로 정리됩니다.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-full bg-amber-400 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-sm shadow-amber-400/20 transition-all hover:bg-amber-500 active:scale-95"
            >
              비행기 일정 등록
            </button>
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
