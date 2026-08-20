"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { BellOff, Loader2, Navigation, Plus, UserRoundPlus } from "lucide-react"

import { DirectionsPickerDialog, type DirTarget } from "@/components/directions-picker-dialog"
import { useNotifications } from "@/components/notifications/notifications-provider"
import { useTrips } from "@/components/trips-store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  acceptFeedNotification,
  filterNotifications,
  formatRelativeTimeKo,
  groupNotificationsByTime,
  markVisibleNotificationsSeen,
  rejectFeedNotification,
  type FeedNotification,
  type NotificationFilter,
} from "@/lib/notifications-feed"
import { cn } from "@/lib/utils"

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: "all", label: "모두" },
  { key: "trip", label: "여행 초대" },
  { key: "friend", label: "친구" },
  { key: "clip", label: "클립" },
]

function initialsFromName(name: string) {
  const cleaned = String(name ?? "").replace(/\s+/g, "")
  if (!cleaned) return "WT"
  return cleaned.slice(0, 2).toUpperCase()
}

function NotificationAvatars({ item }: { item: FeedNotification }) {
  const actors =
    item.actors && item.actors.length > 0
      ? item.actors.slice(0, 2)
      : [{ name: item.actorName, avatarUrl: item.actorAvatarUrl }]

  if (actors.length === 1) {
    const actor = actors[0]
    return (
      <Avatar className="size-11 shrink-0 ring-2 ring-white">
        {actor.avatarUrl ? <AvatarImage src={actor.avatarUrl} alt="" /> : null}
        <AvatarFallback className="bg-amber-50 text-[11px] font-bold text-amber-700">
          {actor.avatarUrl ? (
            initialsFromName(actor.name)
          ) : (
            <UserRoundPlus className="size-4" />
          )}
        </AvatarFallback>
      </Avatar>
    )
  }

  return (
    <div className="relative size-11 shrink-0">
      {actors.map((actor, index) => (
        <Avatar
          key={`${actor.name}-${index}`}
          className={cn(
            "absolute size-8 ring-2 ring-white",
            index === 0 ? "top-0 left-0 z-[1]" : "right-0 bottom-0 z-[2]"
          )}
        >
          {actor.avatarUrl ? <AvatarImage src={actor.avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-slate-100 text-[9px] font-bold text-slate-600">
            {initialsFromName(actor.name)}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  )
}

function ActionButtons({
  item,
  busy,
  onAccept,
  onReject,
  onDirections,
}: {
  item: FeedNotification
  busy: boolean
  onAccept: () => void
  onReject: () => void
  onDirections: () => void
}) {
  if (item.actionState === "accepted") {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400">
        {item.type === "place_recommendation" ? "추가됨" : "수락됨"}
      </span>
    )
  }

  if (item.actionState === "declined") {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-400">
        {item.type === "place_recommendation" ? "닫음" : "거절됨"}
      </span>
    )
  }

  // 위치 공유 → '닫기' 대신 '길찾기' 버튼 (탭하면 길찾기 피커가 열린다)
  if (item.type === "location_share") {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onDirections()
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-500"
      >
        <Navigation className="size-3" />
        길찾기
      </button>
    )
  }

  // 추천 맛집/장소 → '닫기' + '추가'(가고싶은곳에 담기)
  if (item.type === "place_recommendation") {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-200 disabled:opacity-50"
        >
          닫기
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-500 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
          추가
        </button>
      </div>
    )
  }

  const needsAcceptReject =
    item.type === "trip_invite" ||
    item.type === "clip_invite" ||
    item.type === "friend_request"

  if (!needsAcceptReject) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={onReject}
        className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-200 disabled:opacity-50"
      >
        닫기
      </button>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={onReject}
        className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-200 disabled:opacity-50"
      >
        거절
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onAccept}
        className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-500 disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : null}
        수락
      </button>
    </div>
  )
}

export function NotificationList({
  onSelectTrip,
  compact = false,
}: {
  onSelectTrip?: (trip: { id: string }) => void
  compact?: boolean
}) {
  const router = useRouter()
  const { items, loading, setItems, refresh } = useNotifications()
  const { refreshTrips } = useTrips()
  const [filter, setFilter] = useState<NotificationFilter>("all")
  const [actingId, setActingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dirTarget, setDirTarget] = useState<DirTarget | null>(null)

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => {
      setNotice((current) => (current === message ? null : current))
    }, 2200)
  }, [])

  const visible = useMemo(
    () => filterNotifications(items, filter),
    [items, filter]
  )
  const sections = useMemo(() => groupNotificationsByTime(visible), [visible])

  const seenIdsRef = useRef<Set<string>>(new Set())

  // 알림 목록을 열람하면 잠시 후 안읽음 → 읽음으로 전환한다 (액션과 무관하게).
  useEffect(() => {
    const unread = visible.filter(
      (item) => !item.isRead && !seenIdsRef.current.has(item.id)
    )
    if (unread.length === 0) return
    for (const item of unread) seenIdsRef.current.add(item.id)

    const timer = window.setTimeout(() => {
      void markVisibleNotificationsSeen(unread).then((markedNotificationIds) => {
        if (markedNotificationIds.length === 0) return
        const marked = new Set(markedNotificationIds)
        setItems((current) =>
          current.map((row) =>
            row.notificationId && marked.has(row.notificationId)
              ? { ...row, isRead: true }
              : row
          )
        )
      })
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [visible, setItems])

  const handleAccept = async (item: FeedNotification) => {
    if (actingId || item.actionState !== "pending") return
    setActingId(item.id)
    try {
      const result = await acceptFeedNotification(item)
      setItems((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, actionState: "accepted", isRead: true } : row
        )
      )
      if (item.type === "trip_invite" || item.type === "clip_invite") {
        await refreshTrips({ silent: true })
        if (result.tripId) onSelectTrip?.({ id: result.tripId })
      }
      showNotice(result.toast)
      void refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : "수락에 실패했어요."
      console.error("[NotificationList] accept failed:", message)
      showNotice(message)
    } finally {
      setActingId(null)
    }
  }

  const handleReject = async (item: FeedNotification) => {
    if (actingId || item.actionState !== "pending") return
    setActingId(item.id)
    try {
      const result = await rejectFeedNotification(item)
      setItems((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, actionState: "declined", isRead: true } : row
        )
      )
      showNotice(result.toast)
      void refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : "처리에 실패했어요."
      console.error("[NotificationList] reject failed:", message)
      showNotice(message)
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className={cn("flex flex-col", compact ? "gap-3" : "gap-4")}>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((chip) => {
          const active = filter === chip.key
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                active
                  ? "bg-amber-400 text-slate-950 shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {loading && items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-sm text-slate-400">
          <Loader2 className="size-5 animate-spin text-amber-500" />
          알림을 불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-sm text-slate-400">
          <BellOff className="size-5" />
          새로운 알림이 없어요.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {sections.map((section) => (
            <section key={section.key}>
              <h3 className="mb-2 px-0.5 text-xs font-bold tracking-wide text-slate-500">
                {section.label}
              </h3>
              <ul className="flex flex-col">
                <AnimatePresence initial={false}>
                  {section.items.map((item) => {
                    const busy = actingId === item.id
                    const isLoc = item.type === "location_share" && !!item.payload
                    return (
                      <motion.li
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div
                          onClick={
                            isLoc
                              ? () =>
                                  setDirTarget({
                                    name: item.payload?.name || "목적지",
                                    lat: item.payload?.lat,
                                    lng: item.payload?.lng,
                                  })
                              : item.type === "place_recommendation"
                                ? /*
                                     ⚠️ 추천 알림은 누를 데가 없었다. "추가" 를
                                        눌러도 그게 어디로 갔는지 보려면 직접
                                        찾아가야 했다(앱에서 같은 신고를 받았다).
                                        친구 추천찜 목록으로 바로 보낸다.
                                  */
                                  () => router.push("/saved?tab=friends")
                                : undefined
                          }
                          className={cn(
                            "flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors duration-300 hover:bg-slate-100/80",
                            item.isRead ? "bg-slate-50" : "bg-white",
                            item.actionState !== "pending" && "opacity-80",
                            (isLoc || item.type === "place_recommendation") && "cursor-pointer"
                          )}
                        >
                          <NotificationAvatars item={item} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] leading-snug text-slate-800">
                              {item.message ? (
                                <span>{item.message}</span>
                              ) : (
                                <>
                                  <span className="font-bold text-slate-900">
                                    {item.actorName}
                                  </span>
                                  {item.type === "trip_invite" ||
                                  item.type === "clip_invite" ? (
                                    <>
                                      님이 &apos;
                                      <span className="font-bold text-slate-900">
                                        {item.tripTitle}
                                      </span>
                                      &apos;에 초대했습니다.
                                    </>
                                  ) : item.type === "friend_request" ? (
                                    <>님이 친구 요청을 보냈습니다.</>
                                  ) : (
                                    <>님이 클립 활동을 보냈습니다.</>
                                  )}
                                </>
                              )}{" "}
                              <span className="whitespace-nowrap text-slate-400">
                                {formatRelativeTimeKo(item.createdAt)}
                              </span>
                            </p>
                          </div>
                          <ActionButtons
                            item={item}
                            busy={busy}
                            onAccept={() => void handleAccept(item)}
                            onReject={() => void handleReject(item)}
                            onDirections={() =>
                              setDirTarget({
                                name: item.payload?.name || "목적지",
                                lat: item.payload?.lat,
                                lng: item.payload?.lng,
                              })
                            }
                          />
                        </div>
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      )}

      {notice ? (
        <div className="pointer-events-none fixed right-4 bottom-4 z-[80] rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-lg md:bottom-6">
          {notice}
        </div>
      ) : null}

      <DirectionsPickerDialog target={dirTarget} onClose={() => setDirTarget(null)} />
    </div>
  )
}
