"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, BellOff, Loader2, UserRoundPlus } from "lucide-react"

import { useTrips } from "@/components/trips-store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  acceptTripInvitation,
  fetchPendingInvitations,
  rejectTripInvitation,
  type TripInvitation,
} from "@/lib/trip-members-api"
import { cn } from "@/lib/utils"

function initialsFromName(name: string) {
  const cleaned = String(name ?? "").replace(/\s+/g, "")
  if (!cleaned) return "WT"
  return cleaned.slice(0, 2).toUpperCase()
}

/**
 * GNB notification bell — pending trip invitations with accept / decline.
 */
export function NotificationMenu({
  onSelectTrip,
}: {
  onSelectTrip?: (trip: { id: string }) => void
}) {
  const { refreshTrips } = useTrips()
  const [open, setOpen] = useState(false)
  const [invites, setInvites] = useState<TripInvitation[]>([])
  const [loading, setLoading] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => {
      setNotice((current) => (current === message ? null : current))
    }, 2200)
  }, [])

  const loadInvites = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchPendingInvitations()
      setInvites(rows)
    } catch (err) {
      console.error(
        "[NotificationMenu] load failed:",
        err instanceof Error ? err.message : err
      )
      setInvites([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  useEffect(() => {
    if (open) void loadInvites()
  }, [open, loadInvites])

  // Refresh badge when invites may change (focus / session events)
  useEffect(() => {
    const onFocus = () => void loadInvites()
    const onCleared = () => setInvites([])
    window.addEventListener("focus", onFocus)
    window.addEventListener("withtrip:session-cleared", onCleared)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("withtrip:session-cleared", onCleared)
    }
  }, [loadInvites])

  const handleAccept = async (invite: TripInvitation) => {
    if (actingId) return
    setActingId(invite.id)
    try {
      const { tripTitle } = await acceptTripInvitation(invite.id)
      setInvites((current) => current.filter((item) => item.id !== invite.id))
      await refreshTrips({ silent: true })
      showNotice(`'${tripTitle}' 여행에 참여했습니다!`)
      onSelectTrip?.({ id: invite.tripId })
    } catch (err) {
      const message = err instanceof Error ? err.message : "수락에 실패했어요."
      console.error("[NotificationMenu] accept failed:", message)
      showNotice(message)
    } finally {
      setActingId(null)
    }
  }

  const handleReject = async (invite: TripInvitation) => {
    if (actingId) return
    setActingId(invite.id)
    try {
      await rejectTripInvitation(invite.id)
      setInvites((current) => current.filter((item) => item.id !== invite.id))
      showNotice("초대를 거절했어요.")
    } catch (err) {
      const message = err instanceof Error ? err.message : "거절에 실패했어요."
      console.error("[NotificationMenu] reject failed:", message)
      showNotice(message)
    } finally {
      setActingId(null)
    }
  }

  const pendingCount = invites.length

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={
                pendingCount > 0 ? `알림 ${pendingCount}개` : "알림"
              }
              className="relative flex size-9 items-center justify-center rounded-full text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900"
            />
          }
        >
          <Bell className="size-5" />
          {pendingCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white"
            />
          ) : null}
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className={cn(
            "w-80 gap-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-xl",
            "ring-0"
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">알림</p>
            {pendingCount > 0 ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 tabular-nums">
                {pendingCount}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-400">
              <Loader2 className="size-5 animate-spin text-amber-500" />
              알림을 불러오는 중…
            </div>
          ) : invites.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-400">
              <BellOff className="size-5" />
              새로운 초대 알림이 없어요.
            </div>
          ) : (
            <ul className="flex max-h-80 flex-col gap-3 overflow-y-auto">
              {invites.map((invite) => {
                const busy = actingId === invite.id
                return (
                  <li
                    key={invite.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <Avatar className="size-9 shrink-0 ring-2 ring-white">
                        {invite.inviterAvatarUrl ? (
                          <AvatarImage src={invite.inviterAvatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback className="bg-amber-50 text-[10px] font-bold text-amber-700">
                          {invite.inviterAvatarUrl ? (
                            initialsFromName(invite.inviterName)
                          ) : (
                            <UserRoundPlus className="size-3.5" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-700">
                        <span className="font-bold text-slate-900">
                          {invite.inviterName}
                        </span>
                        님이{" "}
                        <span className="font-bold text-slate-900">
                          &apos;{invite.tripTitle}&apos;
                        </span>{" "}
                        여행에 초대했습니다.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleReject(invite)}
                        className="rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-200 disabled:opacity-50"
                      >
                        거절
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleAccept(invite)}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-500 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="size-3 animate-spin" /> : null}
                        수락
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </PopoverContent>
      </Popover>

      {notice ? (
        <div className="pointer-events-none fixed right-4 bottom-4 z-[70] rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-lg">
          {notice}
        </div>
      ) : null}
    </>
  )
}

/** Alias matching the product naming in the design brief. */
export const NotificationPopover = NotificationMenu
