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
  Share2,
  Sun,
  UserPlus,
} from "lucide-react"

import { EditTripDialog } from "@/components/edit-trip-dialog"
import { useTrips } from "@/components/trips-store"
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  type TripMember,
} from "@/lib/trip-members-api"
import { getTripMembers, formatTripDuration, type Trip } from "@/lib/trip-data"
import { formatMemberSummary } from "@/lib/trip-group"
import { FALLBACK_TRIP_COVER } from "@/lib/getCityImage"

const weatherIcons = {
  sun: Sun,
  "cloud-sun": CloudSun,
  rain: CloudRain,
} as const

const EMPTY_FLIGHT_LABEL = "✈️ 항공편 미등록"

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
  return summary ? `✈️ ${summary}` : EMPTY_FLIGHT_LABEL
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
    const loaded = await fetchTripMembers(trip.id)
    setJoinedMembers(loaded)
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
      if (!userId) return
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
        showNotice("초대 완료")
      } catch (err) {
        console.error("[TripHeroCard] invite friend failed:", err)
        showNotice("초대 처리에 실패했어요.")
      } finally {
        setInvitingUserId(null)
      }
    },
    [reloadJoinedMembers, showNotice, trip.id]
  )

  return (
    <Card className="relative border-0 p-0 ring-0">
      <div className={compact ? "relative h-44 w-full" : "relative h-56 w-full md:h-64"}>
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
          className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none"
        />

        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4">
          <Badge className="h-8 rounded-full px-3 text-sm font-bold tabular-nums shadow-sm">
            D-{trip.dDay}
          </Badge>
          <Badge variant="secondary" className="h-8 rounded-full px-3">
            <WeatherIcon data-icon="inline-start" />
            {trip.weather}
          </Badge>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-white/90">
            <MapPin className="size-3.5" />
            <span>
              {trip.region} · {trip.country}
            </span>
          </div>
          <h2 className="text-2xl leading-tight font-bold text-balance text-white drop-shadow-sm">
            {trip.title}
          </h2>
          <div className="flex min-w-0 max-w-full items-center gap-3 overflow-x-auto text-[11px] text-white/90 sm:text-xs">
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap tabular-nums">
              <CalendarDays className="size-3.5 shrink-0" />
              {trip.startDate} — {trip.endDate}
            </span>
            <span className="min-w-0 truncate whitespace-nowrap" title={flightLabel}>
              {flightLabel}
            </span>
          </div>
        </div>
      </div>

      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
        <div className="flex items-center gap-3">
          <AvatarGroup className="-space-x-1.5">
            {visibleMembers.map((member) => (
              <Avatar key={member.id}>
                {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-xs font-semibold">
                  {initialsFromName(member.name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {hiddenCount > 0 ? (
              <AvatarGroupCount className="text-xs font-semibold">+{hiddenCount}</AvatarGroupCount>
            ) : null}
          </AvatarGroup>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{memberSummary}</span>
            <span className="text-xs text-muted-foreground">
              멤버 {memberCount}명 · {formatTripDuration(trip.nights, trip.days)} 함께 편집 중
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <EditTripDialog
            trip={trip}
            trigger={
              <Button variant="outline" size="lg" className="rounded-full font-semibold">
                <Pencil data-icon="inline-start" />
                편집
              </Button>
            }
          />
          <Button
            variant="outline"
            size="lg"
            className="rounded-full font-semibold"
            onClick={() => void handleCopyText(shareUrl, "링크가 복사되었습니다")}
          >
            <Share2 data-icon="inline-start" />
            공유
          </Button>
          <Button
            size="lg"
            className="rounded-full font-semibold"
            onClick={() => setInviteOpen(true)}
          >
            <UserPlus data-icon="inline-start" />
            멤버 초대하기
          </Button>
        </div>
      </CardContent>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>멤버 초대하기</DialogTitle>
            <DialogDescription>
              수락된 친구를 여행 멤버로 초대할 수 있어요.
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
                  const isJoined = joinedUserIds.has(member.userId)
                  const isInviting = invitingUserId === member.userId

                  return (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"
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
        <div className="pointer-events-none fixed right-4 bottom-4 z-[70] rounded-xl bg-foreground px-3 py-2 text-sm font-semibold text-background shadow-lg">
          {notice}
        </div>
      ) : null}
    </Card>
  )
}
