"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CalendarDays,
  Check,
  Copy,
  CloudRain,
  CloudSun,
  Loader2,
  MapPin,
  Pencil,
  Plane,
  Share2,
  Sun,
  User,
  UserPlus,
} from "lucide-react"

import { EditTripDialog } from "@/components/edit-trip-dialog"
import { useTrips } from "@/components/trips-store"
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  fetchFriendships,
  getCurrentAuthUserId,
  resolveUsersByIds,
  type UserSummary,
} from "@/lib/friends-api"
import { fetchFlightsByTripId, type TripFlight } from "@/lib/flights-api"
import {
  addTripMember,
  fetchTripInviteCode,
  fetchTripMembers,
  fetchTripMembershipStates,
  type TripMember,
  type TripMemberStatus,
} from "@/lib/trip-members-api"
import { getTripMembers, formatTripDuration, type Trip } from "@/lib/trip-data"
import { formatMemberSummary } from "@/lib/trip-group"
import { FALLBACK_TRIP_COVER } from "@/lib/getCityImage"

const weatherIcons = {
  sun: Sun,
  "cloud-sun": CloudSun,
  rain: CloudRain,
} as const

const EMPTY_FLIGHT_LABEL = "항공편 미등록"
const actionBtnClass =
  "inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200/80 active:scale-95"
const primaryCtaClass =
  "inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-5 py-2 text-xs font-bold text-slate-950 shadow-sm shadow-amber-400/20 transition-all hover:bg-amber-500 active:scale-95"

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
  const returnPart = inbound ? `오는 편: ${routeArrow(inbound.fromCode, inbound.toCode)}` : ""
  const summary = [goingPart, returnPart].filter(Boolean).join(" · ")
  return summary || EMPTY_FLIGHT_LABEL
}

function initialsFromName(name: string) {
  const cleaned = String(name ?? "").replace(/\s+/g, "")
  if (!cleaned) return "MB"
  return cleaned.slice(0, 2).toUpperCase()
}

function toTripMember(user: UserSummary): TripMember {
  return {
    id: user.userId || user.email || Math.random().toString(16).slice(2),
    userId: user.userId,
    email: user.email,
    name: user.nickname,
    avatarUrl: user.avatarUrl,
  }
}

export function TripHeroCard({
  trip,
  compact = false,
  flightsRevision = 0,
}: {
  trip: Trip
  compact?: boolean
  flightsRevision?: number
}) {
  const { members } = useTrips()
  const fallbackMembers = trip.groupMembers?.length
    ? trip.groupMembers
    : getTripMembers(trip, members)
  const [flightLabel, setFlightLabel] = useState(EMPTY_FLIGHT_LABEL)
  const [coverSrc, setCoverSrc] = useState(trip.heroImage || FALLBACK_TRIP_COVER)
  const [joinedMembers, setJoinedMembers] = useState<TripMember[]>([])
  const [membershipStates, setMembershipStates] = useState<Record<string, TripMemberStatus>>(
    {}
  )
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(trip.inviteCode ?? null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [acceptedFriends, setAcceptedFriends] = useState<UserSummary[]>([])
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const activeMembers =
    joinedMembers.length > 0
      ? joinedMembers
      : fallbackMembers.map((member) => ({
          id: member.id,
          userId: "userId" in member ? String((member as { userId?: string }).userId ?? "") : "",
          email: "",
          name: member.name,
          avatarUrl:
            "avatarUrl" in member ? (member as { avatarUrl?: string }).avatarUrl : undefined,
        }))
  const visibleMembers = activeMembers.slice(0, 4)
  const memberCount = activeMembers.length
  const hiddenCount = Math.max(0, memberCount - visibleMembers.length)
  const memberSummary = formatMemberSummary(activeMembers.map((member) => member.name))
  const joinedUserIds = useMemo(
    () => new Set(joinedMembers.map((member) => String(member.userId ?? "").trim()).filter(Boolean)),
    [joinedMembers]
  )

  const WeatherIcon = weatherIcons[trip.weatherIcon]
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/trips/${trip.id}` : `/trips/${trip.id}`
  const inviteUrl =
    typeof window !== "undefined" && inviteCode
      ? `${window.location.origin}/join?code=${inviteCode}`
      : inviteCode
        ? `/join?code=${inviteCode}`
        : ""

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => {
      setNotice((current) => (current === message ? null : current))
    }, 1800)
  }, [])

  const handleCopyText = useCallback(
    async (text: string, successMessage: string) => {
      const value = String(text ?? "").trim()
      if (!value) {
        showNotice("복사할 링크를 준비하지 못했어요.")
        return
      }
      try {
        await navigator.clipboard.writeText(value)
        showNotice(successMessage)
      } catch (err) {
        console.error("[TripHeroCard] clipboard copy failed:", err)
        showNotice("클립보드 복사에 실패했어요.")
      }
    },
    [showNotice]
  )

  const reloadJoinedMembers = useCallback(async () => {
    const [loaded, states] = await Promise.all([
      fetchTripMembers(trip.id),
      fetchTripMembershipStates(trip.id),
    ])
    setJoinedMembers(loaded)
    setMembershipStates(states)
  }, [trip.id])

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

  useEffect(() => {
    void reloadJoinedMembers()
  }, [reloadJoinedMembers])

  useEffect(() => {
    if (!inviteOpen) return
    let cancelled = false
    setInviteLoading(true)

    void (async () => {
      const [code, joined, currentUserId] = await Promise.all([
        fetchTripInviteCode(trip.id),
        fetchTripMembers(trip.id),
        getCurrentAuthUserId(),
      ])

      let friends: UserSummary[] = []
      if (currentUserId) {
        try {
          const friendships = await fetchFriendships(currentUserId)
          const acceptedIds = friendships
            .filter((row) => row.status === "accepted")
            .map((row) => (row.user_id === currentUserId ? row.friend_id : row.user_id))
            .filter((id) => Boolean(id) && id !== currentUserId)
          const profiles = await resolveUsersByIds(acceptedIds)
          friends = acceptedIds
            .map((id) => profiles[id])
            .filter((profile): profile is UserSummary => Boolean(profile))
        } catch (err) {
          console.error("[TripHeroCard] load friends failed:", err)
        }
      }

      if (cancelled) return
      setInviteCode(code ?? trip.inviteCode ?? null)
      setJoinedMembers(joined)
      setAcceptedFriends(friends)
      setInviteLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [inviteOpen, trip.id, trip.inviteCode])

  const handleInviteFriend = useCallback(
    async (friend: UserSummary) => {
      const userId = String(friend.userId ?? "").trim()
      if (!userId) {
        showNotice("초대할 친구 정보가 없어요.")
        return
      }
      setInvitingUserId(userId)
      try {
        await addTripMember({
          tripId: trip.id,
          userId,
          email: friend.email,
          name: friend.nickname,
          avatarUrl: friend.avatarUrl,
        })
        await reloadJoinedMembers()
        showNotice(`${friend.nickname || "친구"}님에게 초대를 보냈어요`)
      } catch (err) {
        const message =
          err && typeof err === "object"
            ? String(
                (err as { message?: unknown }).message ||
                  (err as { details?: unknown }).details ||
                  ""
              ).trim()
            : ""
        console.error(
          "[TripHeroCard] invite friend failed:",
          message || (err instanceof Error ? err.message : err)
        )
        if (err && typeof err === "object") {
          const row = err as { details?: unknown; hint?: unknown; code?: unknown }
          if (row.details || row.hint || row.code) {
            console.error("[TripHeroCard] invite error details:", {
              details: row.details,
              hint: row.hint,
              code: row.code,
            })
          }
        }
        showNotice(message || "초대 처리에 실패했어요. 잠시 후 다시 시도해 주세요.")
      } finally {
        setInvitingUserId(null)
      }
    },
    [reloadJoinedMembers, showNotice, trip.id]
  )

  const durationLabel = formatTripDuration(trip.nights, trip.days)
  const memberHeadline =
    memberCount > 0 ? memberSummary : "함께할 멤버를 초대해 보세요"

  return (
    <section className="relative mb-8 border-b border-slate-200/70 pb-2">
      <div
        className={cn(
          "relative h-52 w-full overflow-hidden rounded-3xl shadow-sm sm:h-72",
          compact && "sm:h-64"
        )}
      >
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
          className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"
        />

        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-4 sm:p-5">
          <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950 shadow-sm tabular-nums">
            D-{trip.dDay}
          </span>
          <span className="flex items-center gap-1 rounded-full border border-white/20 bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
            <WeatherIcon className="size-3.5" />
            {trip.weather}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col p-4 sm:p-5">
          <p className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-200/90">
            <MapPin className="size-3.5 shrink-0" />
            <span>
              {trip.region} · {trip.country}
            </span>
          </p>
          <h2 className="text-xl font-extrabold tracking-tight text-balance text-white drop-shadow-sm sm:text-3xl">
            {trip.title}
          </h2>
          <div className="mt-1.5 flex min-w-0 max-w-full items-center gap-3 overflow-x-auto text-xs font-medium text-slate-200/80">
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap tabular-nums">
              <CalendarDays className="size-3.5 shrink-0" />
              {trip.startDate} — {trip.endDate}
            </span>
            <span
              className="inline-flex min-w-0 items-center gap-1.5 truncate whitespace-nowrap"
              title={flightLabel}
            >
              <Plane className="size-3.5 shrink-0" />
              <span className="truncate">{flightLabel}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-4 pt-5 pb-6 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <AvatarGroup className="-space-x-2">
            {memberCount > 0 ? (
              <>
                {visibleMembers.map((member) => (
                  <Avatar key={member.id} className="size-9 ring-2 ring-white">
                    {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="bg-slate-100 text-[11px] font-semibold text-slate-600">
                      {initialsFromName(member.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {hiddenCount > 0 ? (
                  <AvatarGroupCount className="size-9 text-[11px] font-semibold ring-2 ring-white">
                    +{hiddenCount}
                  </AvatarGroupCount>
                ) : null}
              </>
            ) : (
              <>
                <Avatar className="size-9 ring-2 ring-white">
                  <AvatarFallback className="bg-slate-100 text-slate-400">
                    <User className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <Avatar className="size-9 ring-2 ring-white">
                  <AvatarFallback className="bg-slate-50 text-slate-300">
                    <User className="size-4" />
                  </AvatarFallback>
                </Avatar>
              </>
            )}
          </AvatarGroup>
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-sm font-bold text-slate-900">
              {memberHeadline}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-400">
              {durationLabel} · 실시간 편집 가능
            </p>
          </div>
        </div>

        <div className="no-scrollbar flex w-full max-w-full items-center gap-2 overflow-x-auto sm:w-auto sm:justify-end">
          <EditTripDialog
            trip={trip}
            trigger={
              <button type="button" className={cn(actionBtnClass, "shrink-0")}>
                <Pencil className="size-3.5" />
                편집
              </button>
            }
          />
          <button
            type="button"
            className={cn(actionBtnClass, "shrink-0")}
            onClick={() => void handleCopyText(shareUrl, "링크가 복사되었습니다")}
          >
            <Share2 className="size-3.5" />
            공유
          </button>
          <button
            type="button"
            className={cn(primaryCtaClass, "shrink-0")}
            onClick={() => setInviteOpen(true)}
          >
            <UserPlus className="size-3.5" />
            멤버 초대하기
          </button>
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>멤버 초대하기</DialogTitle>
            <DialogDescription>
              친구에게 초대를 보내면, 상대가 알림에서 수락한 뒤 멤버로 합류해요.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground">내 친구 목록</p>
            {inviteLoading ? (
              <p className="text-sm text-muted-foreground">친구 목록을 불러오는 중…</p>
            ) : acceptedFriends.length === 0 ? (
              <p className="text-sm text-muted-foreground">수락된 친구가 아직 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {acceptedFriends.map((friend) => {
                  const member = toTripMember(friend)
                  const inviteState = membershipStates[member.userId]
                  const isJoined = inviteState === "accepted" || joinedUserIds.has(member.userId)
                  const isPending = inviteState === "pending"
                  const isInviting = invitingUserId === member.userId

                  return (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="size-8">
                          {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
                          <AvatarFallback className="text-xs font-semibold">
                            {initialsFromName(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{member.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {member.email || member.userId}
                          </p>
                        </div>
                      </div>
                      {isJoined ? (
                        <Badge variant="secondary">참여 중</Badge>
                      ) : isPending ? (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                          초대됨
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full font-semibold"
                          onClick={() => void handleInviteFriend(friend)}
                          disabled={isInviting}
                        >
                          {isInviting ? <Loader2 className="animate-spin" /> : <UserPlus />}
                          {isInviting ? "초대 중…" : "초대하기"}
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-muted-foreground">초대 링크</p>
            <Input readOnly value={inviteUrl || "초대 코드를 불러오는 중..."} />
            {inviteCode ? (
              <p className="text-xs text-muted-foreground">
                초대 코드: <span className="font-mono">{inviteCode}</span>
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleCopyText(inviteUrl, "초대 링크가 복사되었습니다")}
              disabled={!inviteUrl}
            >
              <Copy data-icon="inline-start" />
              초대 링크 복사
            </Button>
            <Button type="button" onClick={() => setInviteOpen(false)}>
              <Check data-icon="inline-start" />
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {notice ? (
        <div className="pointer-events-none fixed right-4 bottom-4 z-[70] rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-lg">
          {notice}
        </div>
      ) : null}
    </section>
  )
}
