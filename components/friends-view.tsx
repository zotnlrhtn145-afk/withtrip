"use client"

import { useMemo, useState } from "react"
import { Plane, Search, UserPlus, UserRoundPlus } from "lucide-react"

import { useTrips } from "@/components/trips-store"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { friendsSeed, type Friend } from "@/lib/friends-data"
import { memberPalette } from "@/lib/trip-data"
import { cn } from "@/lib/utils"

function initialsFromName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}

export function FriendsView() {
  const { trips } = useTrips()
  const [friends, setFriends] = useState<Friend[]>(friendsSeed)
  const [addOpen, setAddOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [inviteFriendId, setInviteFriendId] = useState("")
  const [inviteTripId, setInviteTripId] = useState("")
  const [inviteToast, setInviteToast] = useState<string | null>(null)

  const accepted = useMemo(
    () => friends.filter((friend) => friend.status === "accepted"),
    [friends]
  )
  const pending = useMemo(
    () => friends.filter((friend) => friend.status === "pending"),
    [friends]
  )

  const resetAdd = () => {
    setName("")
    setEmail("")
  }

  const handleAddFriend = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    if (!trimmedName || !trimmedEmail) return

    setFriends((current) => [
      ...current,
      {
        id: `f-${Date.now()}`,
        name: trimmedName,
        initials: initialsFromName(trimmedName),
        color: memberPalette[current.length % memberPalette.length],
        email: trimmedEmail,
        status: "pending",
        sharedTrips: 0,
        lastActive: "초대 대기",
      },
    ])
    resetAdd()
    setAddOpen(false)
  }

  const handleInvite = (event: React.FormEvent) => {
    event.preventDefault()
    const friend = friends.find((item) => item.id === inviteFriendId)
    const trip = trips.find((item) => item.id === inviteTripId)
    if (!friend || !trip) return

    setInviteToast(`${friend.name} 님을 「${trip.title}」에 초대했어요.`)
    setInviteOpen(false)
    setInviteFriendId("")
    setInviteTripId("")
    window.setTimeout(() => setInviteToast(null), 3200)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">친구</h2>
          <p className="text-sm text-muted-foreground">
            함께 여행할 친구를 관리하고 초대할 수 있어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog
            open={inviteOpen}
            onOpenChange={(open) => {
              setInviteOpen(open)
              if (!open) {
                setInviteFriendId("")
                setInviteTripId("")
              }
            }}
          >
            <DialogTrigger
              render={
                <Button variant="outline" className="rounded-full font-semibold" />
              }
            >
              <Plane data-icon="inline-start" />
              여행 초대
            </DialogTrigger>
            <DialogContent className="gap-5 rounded-2xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle>여행에 친구 초대</DialogTitle>
                <DialogDescription>
                  친구와 여행을 선택하면 초대 알림을 보낼 수 있어요.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInvite} className="flex flex-col gap-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel>친구</FieldLabel>
                    <Select
                      items={accepted.map((friend) => ({
                        value: friend.id,
                        label: friend.name,
                      }))}
                      value={inviteFriendId || null}
                      onValueChange={(value) => setInviteFriendId((value as string) ?? "")}
                    >
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="초대할 친구 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {accepted.map((friend) => (
                          <SelectItem key={friend.id} value={friend.id}>
                            {friend.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>여행</FieldLabel>
                    <Select
                      items={trips.map((trip) => ({ value: trip.id, label: trip.title }))}
                      value={inviteTripId || null}
                      onValueChange={(value) => setInviteTripId((value as string) ?? "")}
                    >
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="초대할 여행 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {trips.map((trip) => (
                          <SelectItem key={trip.id} value={trip.id}>
                            {trip.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={!inviteFriendId || !inviteTripId}
                    className="rounded-full font-semibold"
                  >
                    초대 보내기
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open)
              if (!open) resetAdd()
            }}
          >
            <DialogTrigger render={<Button className="rounded-full font-semibold" />}>
              <UserPlus data-icon="inline-start" />
              친구 추가
            </DialogTrigger>
            <DialogContent className="gap-5 rounded-2xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle>친구 추가</DialogTitle>
                <DialogDescription>
                  이메일로 친구를 찾아 초대를 보낼 수 있어요.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddFriend} className="flex flex-col gap-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="friend-name">이름</FieldLabel>
                    <Input
                      id="friend-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="예: 예진"
                      className="rounded-xl"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="friend-email">이메일</FieldLabel>
                    <Input
                      id="friend-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="friend@email.com"
                      className="rounded-xl"
                      required
                    />
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <Button type="submit" className="rounded-full font-semibold">
                    초대 보내기
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {inviteToast ? (
        <div className="rounded-xl bg-primary/15 px-4 py-3 text-sm font-medium text-foreground">
          {inviteToast}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-secondary px-4 py-3">
          <p className="text-xs text-muted-foreground">전체 친구</p>
          <p className="text-lg font-bold tabular-nums">{friends.length}명</p>
        </div>
        <div className="rounded-2xl bg-secondary px-4 py-3">
          <p className="text-xs text-muted-foreground">수락됨</p>
          <p className="text-lg font-bold tabular-nums">{accepted.length}명</p>
        </div>
        <div className="rounded-2xl bg-secondary px-4 py-3">
          <p className="text-xs text-muted-foreground">대기 중</p>
          <p className="text-lg font-bold tabular-nums">{pending.length}명</p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">내 친구 목록</h3>
        {friends.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-secondary">
              <Search className="size-5" />
            </span>
            <p className="text-sm font-semibold">아직 친구가 없어요</p>
            <p className="text-sm text-muted-foreground">친구를 추가하고 여행에 초대해 보세요.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((friend) => (
              <li
                key={friend.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-11">
                    <AvatarFallback className={cn("font-bold", friend.color)}>
                      {friend.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{friend.name}</span>
                      <Badge
                        variant={friend.status === "accepted" ? "default" : "outline"}
                        className="font-semibold"
                      >
                        {friend.status === "accepted" ? "친구" : "대기"}
                      </Badge>
                    </div>
                    <span className="truncate text-xs text-muted-foreground">{friend.email}</span>
                    <span className="text-[11px] text-muted-foreground">
                      함께한 여행 {friend.sharedTrips}회 · {friend.lastActive}
                    </span>
                  </div>
                </div>
                {friend.status === "accepted" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 font-semibold"
                    onClick={() => {
                      setInviteFriendId(friend.id)
                      setInviteOpen(true)
                    }}
                  >
                    <UserRoundPlus data-icon="inline-start" />
                    초대
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-full font-semibold"
                    onClick={() =>
                      setFriends((current) =>
                        current.map((item) =>
                          item.id === friend.id
                            ? { ...item, status: "accepted", lastActive: "방금 전" }
                            : item
                        )
                      )
                    }
                  >
                    수락
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
