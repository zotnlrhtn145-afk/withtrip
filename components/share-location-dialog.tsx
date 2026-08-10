"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Plane, Send } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type UserSummary } from "@/lib/friends-api"
import {
  fetchMyTrips,
  shareLocationToFriend,
  shareLocationToTrip,
  type ShareLocation,
  type ShareTrip,
} from "@/lib/location-share-api"
import { fetchAcceptedFriends } from "@/lib/recommendations-api"
import { cn } from "@/lib/utils"

type Mode = "friends" | "trips"

/** 목적지를 친구 또는 여행에 공유하는 다이얼로그. */
export function ShareLocationDialog({
  target,
  onClose,
}: {
  target: ShareLocation | null
  onClose: () => void
}) {
  const [mode, setMode] = useState<Mode>("friends")
  const [friends, setFriends] = useState<UserSummary[]>([])
  const [trips, setTrips] = useState<ShareTrip[]>([])
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!target) return
    setLoading(true)
    setSent(new Set())
    setMode("friends")
    void Promise.all([fetchAcceptedFriends(), fetchMyTrips()]).then(([f, t]) => {
      setFriends(f)
      setTrips(t)
      setLoading(false)
    })
  }, [target])

  const sendFriend = async (f: UserSummary) => {
    if (!target || sent.has(f.userId)) return
    setBusy(f.userId)
    const ok = await shareLocationToFriend(f.userId, target)
    setBusy(null)
    if (ok) setSent((p) => new Set(p).add(f.userId))
  }
  const sendTrip = async (t: ShareTrip) => {
    if (!target || sent.has(t.id)) return
    setBusy(t.id)
    const ok = await shareLocationToTrip(t.id, target)
    setBusy(null)
    if (ok) setSent((p) => new Set(p).add(t.id))
  }

  const SendBtn = ({ id, onClick }: { id: string; onClick: () => void }) => {
    const done = sent.has(id)
    return (
      <button
        type="button"
        disabled={done || busy === id}
        onClick={onClick}
        className={
          done
            ? "flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500"
            : "flex shrink-0 items-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-500 disabled:opacity-60"
        }
      >
        {busy === id ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : done ? (
          <>
            <Check className="size-3.5" /> 보냄
          </>
        ) : (
          <>
            <Send className="size-3.5" /> 보내기
          </>
        )}
      </button>
    )
  }

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
        <DialogHeader className="mb-2 text-left">
          <DialogTitle className="text-base font-bold text-slate-900">위치 공유</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-slate-400">
            {target ? `"${target.name}"을(를) 보낼 대상을 선택하세요.` : ""}
          </DialogDescription>
        </DialogHeader>

        {/* 친구 / 여행 세그먼트 */}
        <div className="mb-3 flex rounded-full bg-slate-100 p-1">
          {(
            [
              { k: "friends", label: "친구에게" },
              { k: "trips", label: "여행에" },
            ] as const
          ).map((it) => (
            <button
              key={it.k}
              type="button"
              onClick={() => setMode(it.k)}
              className={cn(
                "flex-1 rounded-full py-2 text-sm font-bold transition-colors",
                mode === it.k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              )}
            >
              {it.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : mode === "friends" ? (
          friends.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">공유할 친구가 없어요.</p>
          ) : (
            <ul className="flex max-h-80 flex-col overflow-y-auto">
              {friends.map((f) => (
                <li key={f.userId} className="flex items-center gap-3 py-2.5">
                  <Avatar className="size-10 shrink-0">
                    {f.avatarUrl ? <AvatarImage src={f.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="text-xs font-semibold">
                      {f.nickname.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{f.nickname}</p>
                    <p className="truncate text-xs text-slate-400">{f.email || f.userId}</p>
                  </div>
                  <SendBtn id={f.userId} onClick={() => void sendFriend(f)} />
                </li>
              ))}
            </ul>
          )
        ) : trips.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">참여 중인 여행이 없어요.</p>
        ) : (
          <ul className="flex max-h-80 flex-col overflow-y-auto">
            {trips.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Plane className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{t.title}</p>
                  <p className="truncate text-xs text-slate-400">여행 멤버 전체에게</p>
                </div>
                <SendBtn id={t.id} onClick={() => void sendTrip(t)} />
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
