"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Send } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type UserSummary } from "@/lib/friends-api"
import { fetchAcceptedFriends, sendRecommendation, type RecPlace } from "@/lib/recommendations-api"

export type RecommendTarget = { place: RecPlace; sourceId?: string | null; label: string }

function initials(name: string) {
  const t = name.trim()
  return t ? t.slice(0, 2).toUpperCase() : "?"
}

/** 저장 장소를 친구에게 추천 보내는 다이얼로그. 친구를 누르면 바로 전송된다. */
export function RecommendPlaceDialog({
  target,
  onClose,
}: {
  target: RecommendTarget | null
  onClose: () => void
}) {
  const [friends, setFriends] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!target) return
    setLoading(true)
    setSentTo(new Set())
    void fetchAcceptedFriends().then((f) => {
      setFriends(f)
      setLoading(false)
    })
  }, [target])

  const send = async (f: UserSummary) => {
    if (!target || sentTo.has(f.userId)) return
    setBusy(f.userId)
    const ok = await sendRecommendation({
      recipientId: f.userId,
      place: target.place,
      sourcePlaceId: target.sourceId ?? null,
    })
    setBusy(null)
    if (ok) setSentTo((prev) => new Set(prev).add(f.userId))
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
          <DialogTitle className="text-base font-bold text-slate-900">친구에게 추천</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-slate-400">
            {target ? `"${target.label}"을(를) 보낼 친구를 선택하세요.` : ""}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : friends.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">추천을 보낼 친구가 없어요.</p>
        ) : (
          <ul className="flex max-h-96 flex-col overflow-y-auto">
            {friends.map((f) => {
              const sent = sentTo.has(f.userId)
              return (
                <li key={f.userId} className="flex items-center gap-3 py-2.5">
                  <Avatar className="size-10 shrink-0">
                    {f.avatarUrl ? <AvatarImage src={f.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="text-xs font-semibold">{initials(f.nickname)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{f.nickname}</p>
                    <p className="truncate text-xs text-slate-400">{f.email || f.userId}</p>
                  </div>
                  <button
                    type="button"
                    disabled={sent || busy === f.userId}
                    onClick={() => void send(f)}
                    className={
                      sent
                        ? "flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500"
                        : "flex shrink-0 items-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-500 disabled:opacity-60"
                    }
                  >
                    {busy === f.userId ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : sent ? (
                      <>
                        <Check className="size-3.5" /> 보냄
                      </>
                    ) : (
                      <>
                        <Send className="size-3.5" /> 보내기
                      </>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
