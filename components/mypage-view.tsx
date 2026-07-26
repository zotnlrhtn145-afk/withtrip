"use client"

import { useState } from "react"
import {
  ChevronRight,
  Crown,
  KeyRound,
  LogOut,
  Mail,
  Pencil,
  Plane,
  UserRoundX,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useTrips } from "@/components/trips-store"
import { demoUser } from "@/lib/auth-data"
import { getTripMembers, type Trip } from "@/lib/trip-data"

export function MyPageView({
  onSelectTrip,
  onLogout,
}: {
  onSelectTrip: (trip: Trip) => void
  onLogout: () => void
}) {
  const { trips, members } = useTrips()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(demoUser.name)

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">마이페이지</h2>
        <p className="text-sm text-muted-foreground">
          프로필과 내 여행을 관리하고 계정 설정을 변경할 수 있어요.
        </p>
      </div>

      <Card className="overflow-hidden rounded-2xl">
        <div className="h-20 bg-primary" aria-hidden="true" />
        <CardContent className="-mt-10 flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar className="size-20 border-4 border-card">
                <AvatarFallback className="bg-secondary text-xl font-bold text-secondary-foreground">
                  {demoUser.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1.5 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold">{name} 님</span>
                  <Badge className="gap-1 font-semibold">
                    <Crown className="size-3" />
                    {demoUser.membership}
                  </Badge>
                </div>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="size-3.5" />
                  {demoUser.email}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setEditing((current) => !current)}
              className="rounded-full font-semibold"
            >
              <Pencil data-icon="inline-start" />
              {editing ? "편집 취소" : "프로필 수정"}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-secondary px-4 py-3">
              <p className="text-xs text-muted-foreground">가입일</p>
              <p className="text-sm font-semibold tabular-nums">{demoUser.joinedAt}</p>
            </div>
            <div className="rounded-xl bg-secondary px-4 py-3">
              <p className="text-xs text-muted-foreground">함께한 여행</p>
              <p className="text-sm font-semibold tabular-nums">{trips.length}개</p>
            </div>
            <div className="rounded-xl bg-secondary px-4 py-3">
              <p className="text-xs text-muted-foreground">다음 출발</p>
              <p className="text-sm font-semibold tabular-nums">
                {trips.length > 0 ? `D-${Math.min(...trips.map((trip) => trip.dDay))}` : "예정 없음"}
              </p>
            </div>
          </div>

          {editing ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                setEditing(false)
              }}
              className="flex flex-col gap-5 rounded-xl border border-border p-4"
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="profile-name">이름</FieldLabel>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="profile-password">새 비밀번호</FieldLabel>
                  <Input
                    id="profile-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="변경할 비밀번호를 입력하세요"
                  />
                </Field>
              </FieldGroup>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" className="rounded-full font-semibold">
                  <KeyRound data-icon="inline-start" />
                  변경 저장
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setName(demoUser.name)
                    setEditing(false)
                  }}
                  className="rounded-full font-semibold"
                >
                  되돌리기
                </Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">내 여행 관리</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {trips.map((trip) => {
            const tripMembers = getTripMembers(trip, members)
            const isOwner = trip.memberIds[0] === "m1"
            return (
              <button
                key={trip.id}
                type="button"
                onClick={() => onSelectTrip(trip)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-secondary"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                    <Plane className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-semibold">{trip.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Badge variant="outline" className="shrink-0 text-[11px]">
                        {isOwner ? "내가 만든 여행" : "공유받은 여행"}
                      </Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {trip.startDate} — {trip.endDate} · 멤버 {tripMembers.length}명
                      </span>
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge className="tabular-nums">D-{trip.dDay}</Badge>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </span>
              </button>
            )
          })}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">계정 설정</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={onLogout}
            className="w-full justify-center rounded-xl font-semibold"
          >
            <LogOut data-icon="inline-start" />
            로그아웃
          </Button>
          <Separator />
          <Button
            variant="ghost"
            size="sm"
            className="self-center font-medium text-muted-foreground"
          >
            <UserRoundX data-icon="inline-start" />
            회원 탈퇴
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
