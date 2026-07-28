"use client"

import { useCallback, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { BellOff, Loader2, UserRoundPlus } from "lucide-react"

import { useNotifications } from "@/components/notifications/notifications-provider"
import { useTrips } from "@/components/trips-store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  acceptFeedNotification,
  filterNotifications,
  formatRelativeTimeKo,
  groupNotificationsByTime,
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
}: {
  item: FeedNotification
  busy: boolean
  onAccept: () => void
  onReject: () => void
}) {
  if (item.actionState === "accepted") {
    return <span className="text-xs font-medium text-slate-400">참여 중</span>
  }

  if (item.category === "clip") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={onReject}
        className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-200 disabled:opacity-50"
      >
        삭제
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
  const { items, loading, setItems, refresh } = useNotifications()
  const { refreshTrips } = useTrips()
  const [filter, setFilter] = useState<NotificationFilter>("all")
  const [actingId, setActingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => {
      setNotice((current) => (current === message ? null : current))
    }, 2200)
  }, [])

  const visible = useMemo(
    () =>
      filterNotifications(items, filter).filter((item) => !exitingIds.has(item.id)),
    [items, filter, exitingIds]
  )
  const sections = useMemo(() => groupNotificationsByTime(visible), [visible])

  const removeWithFade = useCallback((id: string) => {
    setExitingIds((current) => new Set(current).add(id))
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
      setExitingIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }, 220)
  }, [setItems])

  const handleAccept = async (item: FeedNotification) => {
    if (actingId) return
    setActingId(item.id)
    try {
      const result = await acceptFeedNotification(item)
      if (item.category === "trip") {
        setItems((current) =>
          current.map((row) =>
            row.id === item.id ? { ...row, actionState: "accepted" } : row
          )
        )
        await refreshTrips({ silent: true })
        window.setTimeout(() => removeWithFade(item.id), 900)
        if (result.tripId) onSelectTrip?.({ id: result.tripId })
      } else if (item.category === "friend") {
        removeWithFade(item.id)
      } else {
        removeWithFade(item.id)
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
    if (actingId) return
    setActingId(item.id)
    try {
      const result = await rejectFeedNotification(item)
      removeWithFade(item.id)
      showNotice(result.toast)
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
                    const fading = exitingIds.has(item.id)
                    return (
                      <motion.li
                        key={item.id}
                        layout
                        initial={{ opacity: 1, height: "auto" }}
                        animate={{
                          opacity: fading ? 0 : 1,
                          height: fading ? 0 : "auto",
                          marginBottom: fading ? 0 : undefined,
                        }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-3 rounded-2xl px-1 py-2.5 transition-colors hover:bg-slate-50/80">
                          <NotificationAvatars item={item} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] leading-snug text-slate-800">
                              <span className="font-bold text-slate-900">
                                {item.actorName}
                              </span>
                              {item.category === "trip" ? (
                                <>
                                  님이 &apos;
                                  <span className="font-bold text-slate-900">
                                    {item.tripTitle}
                                  </span>
                                  &apos;에 초대했습니다.
                                </>
                              ) : item.category === "friend" ? (
                                <>님이 친구 요청을 보냈습니다.</>
                              ) : (
                                <>
                                  님이 &apos;
                                  <span className="font-bold text-slate-900">
                                    {item.tripTitle}
                                  </span>
                                  &apos;에 클립을 공유했습니다.
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
    </div>
  )
}
