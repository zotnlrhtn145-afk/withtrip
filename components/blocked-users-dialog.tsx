"use client"

import { useState } from "react"
import { Ban, Loader2 } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { profileToUserSummary, type UserSummary } from "@/lib/friends-api"
import { fetchMyBlockedIds, unblockUser } from "@/lib/moderation-api"
import { createClient } from "@/utils/supabase/client"

function initials(name: string) {
  const t = name.trim()
  return t ? t.slice(0, 2).toUpperCase() : "?"
}

export function BlockedUsersDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<UserSummary[]>([])
  const [pending, setPending] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const ids = await fetchMyBlockedIds()
    if (ids.length === 0) {
      setUsers([])
      setLoading(false)
      return
    }
    const supabase = createClient()
    const { data } = await supabase
      .from("profiles")
      .select("id, email, nickname, avatar_url")
      .in("id", ids)
    const list: UserSummary[] = []
    for (const row of (data as Record<string, unknown>[]) ?? []) {
      const s = profileToUserSummary(row)
      if (s) list.push(s)
    }
    setUsers(list)
    setLoading(false)
  }

  const onUnblock = async (userId: string) => {
    setPending(userId)
    const ok = await unblockUser(userId)
    setPending(null)
    if (ok) setUsers((prev) => prev.filter((u) => u.userId !== userId))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void load()
      }}
    >
      <DialogTrigger className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.99]">
        <Ban className="size-4" />
        차단한 사용자
      </DialogTrigger>
      <DialogContent className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
        <DialogHeader className="mb-2 text-left">
          <DialogTitle className="text-base font-bold text-slate-900">차단한 사용자</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-slate-400">
            차단을 해제하면 다시 서로의 프로필과 대화를 볼 수 있어요.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">차단한 사용자가 없어요.</p>
        ) : (
          <ul className="flex max-h-80 flex-col overflow-y-auto">
            {users.map((u) => (
              <li key={u.userId} className="flex items-center gap-3 py-2.5">
                <Avatar className="size-10 shrink-0">
                  {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="text-xs font-semibold">{initials(u.nickname)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{u.nickname}</p>
                  <p className="truncate text-xs text-slate-400">{u.email || u.userId}</p>
                </div>
                <button
                  type="button"
                  disabled={pending === u.userId}
                  onClick={() => void onUnblock(u.userId)}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  {pending === u.userId ? <Loader2 className="size-3.5 animate-spin" /> : "차단 해제"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
