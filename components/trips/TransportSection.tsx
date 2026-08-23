"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { Car, Crown, Loader2, Pencil, Plane, PlaneTakeoff, TrainFront, Trash2, UserRound } from "lucide-react"

import { dayShift, formatDuration, hasTimeGap, travelMinutes } from "@/shared/flight-time"
import { loadAirportTz, tzOf } from "@/lib/airport-tz"
import { TransportRegisterModal } from "@/components/trips/TransportRegisterModal"
import { AddSectionButton } from "@/components/trips/AddSectionButton"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  deleteTripTransport,
  fetchTransportsByTripId,
  isTransportAuthor,
  type TransportRole,
  type TransportType,
  type TripTransport,
} from "@/lib/transports-api"
import {
  fetchProfilesByIds,
  fetchTripOwnerId,
  fetchTripRoster,
  type TripMember,
} from "@/lib/trip-members-api"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

const TRANSPORT_ICON: Record<TransportType, typeof Plane> = {
  FLIGHT: Plane,
  TRAIN: TrainFront,
  CAR: Car,
}

const TRANSPORT_LABEL: Record<TransportType, string> = {
  FLIGHT: "비행기",
  TRAIN: "기차",
  CAR: "자가용",
}

function carrierAccent(transportType: TransportType, name: string) {
  if (transportType === "TRAIN") return "#0F766E"
  if (transportType === "CAR") return "#57534E"
  const n = name.toLowerCase()
  if (n.includes("대한") || n.includes("korean")) return "#00256C"
  if (n.includes("아시아나") || n.includes("asiana")) return "#B3141B"
  if (n.includes("제주") || n.includes("jeju")) return "#F36F21"
  if (n.includes("진에어") || n.includes("jin")) return "#0F9B4A"
  if (n.includes("티웨이") || n.includes("t'way") || n.includes("tway")) return "#C8102E"
  return "#57534E"
}

function vehicleCodeHint(transport: TripTransport) {
  if (transport.transportType !== "FLIGHT") return ""
  if (transport.vehicleNo.trim().length >= 2) return transport.vehicleNo.trim().slice(0, 2).toUpperCase()
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
  isHost = false,
}: {
  label: string
  name: string
  avatarUrl?: string
  tone?: "neutral" | "amber"
  isHost?: boolean
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
      {isHost ? (
        <Crown className="size-3 shrink-0 fill-amber-400 text-amber-500" aria-label="방장" />
      ) : null}
    </span>
  )
}

function TransportPeople({
  transport,
  memberById,
  ownerId = "",
}: {
  transport: TripTransport
  memberById: Map<string, TripMember>
  ownerId?: string
}) {
  const authorId = transport.createdBy || transport.userId
  const author = authorId ? memberById.get(authorId) : undefined
  const authorName = authorId ? memberLabel(memberById, authorId) : ""
  const passengers = transport.passengerIds
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
          isHost={Boolean(ownerId) && authorId === ownerId}
        />
      ) : null}
      {passengers.map((passenger) => (
        <PersonChip
          key={`${transport.id}-${passenger.id}`}
          label="동승"
          name={passenger.name}
          avatarUrl={passenger.avatarUrl}
          tone="amber"
          isHost={Boolean(ownerId) && passenger.id === ownerId}
        />
      ))}
    </div>
  )
}

function RoleBadge({ role, segmentOrder }: { role: TransportRole; segmentOrder: number }) {
  if (role === "OUTBOUND") {
    return (
      <span className="inline-flex items-center rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-700 ring-1 ring-sky-500/25 dark:text-sky-300">
        🟦 가는 편
      </span>
    )
  }
  if (role === "RETURN") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-300">
        🟩 오는 편
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-orange-500/15 px-2.5 py-1 text-[11px] font-bold text-orange-700 ring-1 ring-orange-500/25 dark:text-orange-300">
      🟧 경유 {segmentOrder}
    </span>
  )
}

function TicketRoute({ transport }: { transport: TripTransport }) {
  /*
    공항 시간대 표. 36줄짜리라 한 번 받아 두고 계속 쓴다.
    ⚠️ 못 받아도 표는 그대로 뜬다 — 소요시간과 배지만 빠진다.
  */
  const [tzMap, setTzMap] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    void loadAirportTz().then(setTzMap)
  }, [])

  /*
    ⚠️ 시각은 **각 공항의 현지 시각**이다(항공권에 적힌 그대로). 벽시계 숫자를
       그냥 빼면 소요시간이 틀린다 — 실제로 틀려 있었다(ICN→SGN 을 "3시간 30분",
       돌아오는 같은 노선을 "7시간 30분" 으로 적고 있었다. 둘 다 약 5시간 30분이다).
       그래서 `transport.duration` 에 저장된 값 대신 **시간대를 넣어 다시 센다.**
  */
  const from = { date: transport.departDate, time: transport.departTime, tz: tzOf(tzMap, transport.fromLabel) }
  const to = { date: transport.arriveDate, time: transport.arriveTime, tz: tzOf(tzMap, transport.toLabel) }
  const recomputed = formatDuration(travelMinutes(from, to))
  // 시간대를 모르는 구간(역·자유입력)은 예전처럼 저장된 값을 쓴다
  const duration = recomputed || (from.tz && to.tz ? "" : transport.duration)
  const gap = hasTimeGap(from, to)
  const shift = dayShift(from, to)

  return (
    <div className="relative flex items-center gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-mono text-xl leading-none font-extrabold sm:text-2xl">
          {transport.fromLabel}
        </span>
        <span className="text-base leading-none font-bold tabular-nums">{transport.departTime}</span>
        {transport.departDate ? (
          <span className="text-xs text-muted-foreground tabular-nums">{transport.departDate}</span>
        ) : null}
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
          {transport.transportType === "TRAIN" ? (
            <TrainFront aria-hidden="true" className="size-4 text-foreground" />
          ) : transport.transportType === "CAR" ? (
            <Car aria-hidden="true" className="size-4 text-foreground" />
          ) : (
            <PlaneTakeoff aria-hidden="true" className="size-4 text-foreground" />
          )}
          <span
            aria-hidden="true"
            className="h-0 flex-1 border-t border-dashed border-foreground/30"
          />
          <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground/40" />
        </div>
      </div>

      <div className="flex min-w-0 flex-col items-end gap-1">
        <span className="truncate font-mono text-xl leading-none font-extrabold sm:text-2xl">
          {transport.toLabel}
        </span>
        <span className="flex items-center gap-1">
          {gap ? (
            <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-extrabold text-muted-foreground">
              현지
            </span>
          ) : null}
          {shift ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-extrabold text-primary">
              {shift > 0 ? `+${shift}일` : `${shift}일`}
            </span>
          ) : null}
          <span className="text-base leading-none font-bold tabular-nums">{transport.arriveTime}</span>
        </span>
        {transport.arriveDate ? (
          <span className="text-xs text-muted-foreground tabular-nums">{transport.arriveDate}</span>
        ) : null}
      </div>
    </div>
  )
}

function TicketActions({
  deleting,
  onEdit,
  onDelete,
  editLabel = "이동수단 수정",
  deleteLabel = "이동수단 삭제",
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

function TransportTicket({
  transport,
  memberById,
  isAuthor,
  ownerId,
  onEdit,
  onDelete,
  deleting,
}: {
  transport: TripTransport
  memberById: Map<string, TripMember>
  isAuthor: boolean
  ownerId: string
  onEdit: (transport: TripTransport) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const accent = carrierAccent(transport.transportType, transport.carrierName)
  const code = vehicleCodeHint(transport)
  const Icon = TRANSPORT_ICON[transport.transportType]
  const badgeLabel = [transport.carrierName, transport.vehicleNo].filter(Boolean).join(" · ")

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
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute -right-5 -bottom-5 size-24 scale-125 text-foreground opacity-10"
        />
      )}

      <div className="relative flex items-start justify-between gap-2 px-5 pt-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <RoleBadge role={transport.transportRole} segmentOrder={transport.segmentOrder} />
          {badgeLabel ? (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-card px-2.5 py-1 ring-1 ring-border">
              <Icon aria-hidden="true" className="size-3.5 shrink-0" style={{ color: accent }} />
              <span className="truncate text-xs font-bold">{badgeLabel}</span>
            </span>
          ) : null}
        </div>
        {isAuthor ? (
          <TicketActions
            deleting={deleting}
            onEdit={() => onEdit(transport)}
            onDelete={() => onDelete(transport.id)}
          />
        ) : null}
      </div>

      <div className="relative px-5 pt-3 pb-5">
        <TicketRoute transport={transport} />
        <TransportPeople transport={transport} memberById={memberById} ownerId={ownerId} />
      </div>
    </li>
  )
}

function LayoverJourney({
  transports,
  memberById,
  currentUserId,
  ownerId,
  isHost,
  authReady,
  deletingId,
  onEdit,
  onDelete,
}: {
  transports: TripTransport[]
  memberById: Map<string, TripMember>
  currentUserId: string | null
  ownerId: string
  isHost: boolean
  authReady: boolean
  deletingId: string | null
  onEdit: (transport: TripTransport) => void
  onDelete: (id: string) => void
}) {
  return (
    <li className="media-card overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm ring-0 transition-all hover:shadow-md">
      <div className="flex flex-col gap-0 px-5 py-4">
        {transports.map((transport, index) => {
          const accent = carrierAccent(transport.transportType, transport.carrierName)
          const Icon = TRANSPORT_ICON[transport.transportType]
          const badgeLabel = [transport.carrierName, transport.vehicleNo].filter(Boolean).join(" · ")
          const deleting = deletingId === transport.id
          const isAuthor = authReady && (isHost || isTransportAuthor(transport, currentUserId))

          return (
            <div key={transport.id} className="relative">
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
                    <RoleBadge role="LAYOVER" segmentOrder={transport.segmentOrder} />
                    {badgeLabel ? (
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 ring-1 ring-border">
                        <Icon
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
                      editLabel={`경유 ${transport.segmentOrder} 수정`}
                      deleteLabel={`경유 ${transport.segmentOrder} 삭제`}
                      onEdit={() => onEdit(transport)}
                      onDelete={() => onDelete(transport.id)}
                    />
                  ) : null}
                </div>
                <TicketRoute transport={transport} />
                <TransportPeople transport={transport} memberById={memberById} ownerId={ownerId} />
              </div>
            </div>
          )
        })}
      </div>
    </li>
  )
}

/**
 * Supabase `trip_transports` 연동 이동수단(비행기/기차/자가용) 섹션 (좌측 5컬럼용).
 */
export function TransportSection({
  tripId,
  onTransportChange,
}: {
  tripId: string
  /** Called after a successful create/update/delete so hero (and others) can refetch. */
  onTransportChange?: () => void
}) {
  const [transports, setTransports] = useState<TripTransport[]>([])
  const [roster, setRoster] = useState<TripMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTransport, setEditingTransport] = useState<TripTransport | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [ownerId, setOwnerId] = useState<string>("")

  const memberById = useMemo(() => {
    const map = new Map<string, TripMember>()
    for (const member of roster) map.set(member.userId, member)
    return map
  }, [roster])

  const currentUserId = user?.id ?? null
  // 호스트(방장)는 모든 이동수단을 수정·삭제할 수 있다.
  const isHost = Boolean(currentUserId && ownerId && currentUserId === ownerId)

  useEffect(() => {
    let cancelled = false
    void fetchTripOwnerId(tripId).then((id) => {
      if (!cancelled) setOwnerId(id)
    })
    return () => {
      cancelled = true
    }
  }, [tripId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, members] = await Promise.all([
        fetchTransportsByTripId(tripId),
        fetchTripRoster(tripId),
      ])

      const profileIds = new Set<string>()
      for (const transport of data) {
        const authorId = String(transport.createdBy || transport.userId || "").trim()
        if (authorId) profileIds.add(authorId)
        for (const passengerId of transport.passengerIds) {
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

      setTransports(data)
      setRoster(Array.from(byId.values()))
    } catch (err) {
      console.error("[TransportSection] load failed:", err)
      setTransports([])
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
    setEditingTransport(null)
    setModalOpen(true)
  }

  const openEditModal = (transport: TripTransport) => {
    if (!authReady || !(isHost || isTransportAuthor(transport, currentUserId))) return
    setEditingTransport(transport)
    setModalOpen(true)
  }

  const handleModalOpenChange = (next: boolean) => {
    setModalOpen(next)
    if (!next) setEditingTransport(null)
  }

  const handleDelete = async (id: string) => {
    const target = transports.find((transport) => transport.id === id)
    if (!target || !authReady || !(isHost || isTransportAuthor(target, currentUserId))) return
    if (!window.confirm("이 이동수단을 삭제할까요?")) return

    setDeletingId(id)
    try {
      const ok = await deleteTripTransport(id)
      if (ok) {
        setTransports((current) => current.filter((item) => item.id !== id))
        onTransportChange?.()
      }
    } finally {
      setDeletingId(null)
    }
  }

  const groupedByType = useMemo(() => {
    const groups = new Map<
      TransportType,
      { outbound: TripTransport[]; returnLeg: TripTransport[]; layover: TripTransport[] }
    >()
    for (const transport of transports) {
      const bucket = groups.get(transport.transportType) ?? {
        outbound: [],
        returnLeg: [],
        layover: [],
      }
      if (transport.transportRole === "RETURN") bucket.returnLeg.push(transport)
      else if (transport.transportRole === "LAYOVER") bucket.layover.push(transport)
      else bucket.outbound.push(transport)
      groups.set(transport.transportType, bucket)
    }
    return groups
  }, [transports])

  return (
    <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm ring-0 transition-all hover:shadow-md">
      <CardHeader>
        <CardDescription className="mb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          Transport
        </CardDescription>
        <CardTitle className="text-lg font-bold tracking-tight text-slate-900">
          이동수단
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <AddSectionButton label="이동수단 추가" onClick={openCreateModal} />

        {loading ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-10 text-center">
            <Loader2 className="size-6 animate-spin text-amber-500" />
            <p className="text-sm text-slate-500">이동수단을 불러오는 중…</p>
          </div>
        ) : transports.length > 0 ? (
          <div className="flex flex-col gap-5">
            {([...groupedByType.keys()] as TransportType[]).map((type) => {
              const bucket = groupedByType.get(type)!
              const Icon = TRANSPORT_ICON[type]
              return (
                <div key={type} className="flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 px-0.5 text-xs font-bold text-slate-500">
                    <Icon className="size-3.5" />
                    {TRANSPORT_LABEL[type]}
                  </div>
                  <ul className="flex flex-col gap-3">
                    {bucket.outbound.map((transport) => (
                      <TransportTicket
                        key={transport.id}
                        transport={transport}
                        memberById={memberById}
                        isAuthor={authReady && (isHost || isTransportAuthor(transport, currentUserId))}
                        ownerId={ownerId}
                        deleting={deletingId === transport.id}
                        onEdit={openEditModal}
                        onDelete={(id) => void handleDelete(id)}
                      />
                    ))}

                    {bucket.layover.length > 0 ? (
                      <LayoverJourney
                        transports={bucket.layover}
                        memberById={memberById}
                        currentUserId={currentUserId}
                        ownerId={ownerId}
                        isHost={isHost}
                        authReady={authReady}
                        deletingId={deletingId}
                        onEdit={openEditModal}
                        onDelete={(id) => void handleDelete(id)}
                      />
                    ) : null}

                    {bucket.returnLeg.map((transport) => (
                      <TransportTicket
                        key={transport.id}
                        transport={transport}
                        memberById={memberById}
                        isAuthor={authReady && (isHost || isTransportAuthor(transport, currentUserId))}
                        ownerId={ownerId}
                        deleting={deletingId === transport.id}
                        onEdit={openEditModal}
                        onDelete={(id) => void handleDelete(id)}
                      />
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
              <PlaneTakeoff className="size-5" />
            </span>
            <p className="text-sm font-bold text-slate-900">아직 등록된 이동수단이 없어요</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
              비행기·기차·자가용을 선택하고 가는 편·오는 편·경유를 구분해 등록하면 티켓 카드로 정리됩니다.
            </p>
          </div>
        )}
      </CardContent>

      <TransportRegisterModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        tripId={tripId}
        existingTransports={transports}
        editingTransport={editingTransport}
        onSaved={() => {
          void load()
          onTransportChange?.()
        }}
      />
    </Card>
  )
}
