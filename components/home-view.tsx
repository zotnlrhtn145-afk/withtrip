"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Bookmark,
  ChevronRight,
  Compass,
  History,
  Loader2,
  Plane,
  Plus,
  SearchX,
  Users,
  X,
} from "lucide-react"

import { CreateTripDialog } from "@/components/create-trip-dialog"
import { TripClipsTray } from "@/components/home/TripClipsTray"
import { LoginRedirectOverlay } from "@/components/login-redirect-overlay"
import { TripBannerCard } from "@/components/trip-banner-card"
import { useTrips } from "@/components/trips-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { type Trip } from "@/lib/trip-data"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

type TripPhase = "ongoing" | "upcoming" | "past"

function parseYmd(value: string): Date | null {
  const m = String(value ?? "").match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** 종료일 기준: 오늘 > 종료 → past, 오늘 < 시작 → upcoming, 그 사이 → ongoing. */
function tripPhase(trip: Trip): TripPhase {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const start = parseYmd(trip.startDate)
  const end = parseYmd(trip.endDate) ?? start
  if (!start) return "upcoming"
  if (end && today > end.getTime()) return "past"
  if (today < start.getTime()) return "upcoming"
  return "ongoing"
}

function AddTripCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="새로운 여행 떠나기"
      className={cn(
        "group flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 transition-all",
        "hover:border-amber-400 hover:bg-amber-50/30",
        "h-64 w-full sm:h-72"
      )}
    >
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-slate-100 bg-white shadow-sm transition-all group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-slate-950">
        <Plus className="size-5 text-slate-600 group-hover:text-slate-950" strokeWidth={2.5} />
      </span>
      <p className="text-sm font-bold text-slate-800">새로운 여행 떠나기</p>
      <p className="mt-1 text-xs text-slate-400">클릭하여 일정을 새로 등록하세요</p>
    </button>
  )
}

export function HomeView({
  onSelectTrip,
  compact = false,
}: {
  onSelectTrip: (trip: Trip) => void
  compact?: boolean
}) {
  const router = useRouter()
  const { trips, filteredTrips, query, setQuery, loading, error, refreshTrips } = useTrips()
  const isFiltered = query.trim().length > 0
  // 홈 기본은 진행 중+예정, '지난 여행'은 필터로 선택.
  const [homeFilter, setHomeFilter] = useState<"upcoming" | "past">("upcoming")

  // 진행 중(맨 위) → 예정(가까운 순).
  const upcomingList = useMemo(() => {
    const rank: Record<TripPhase, number> = { ongoing: 0, upcoming: 1, past: 9 }
    return filteredTrips
      .filter((trip) => tripPhase(trip) !== "past")
      .sort((a, b) => {
        const pa = tripPhase(a)
        const pb = tripPhase(b)
        if (rank[pa] !== rank[pb]) return rank[pa] - rank[pb]
        return (parseYmd(a.startDate)?.getTime() ?? 0) - (parseYmd(b.startDate)?.getTime() ?? 0)
      })
  }, [filteredTrips])

  // 지난 여행: 최근 끝난 순.
  const pastList = useMemo(
    () =>
      filteredTrips
        .filter((trip) => tripPhase(trip) === "past")
        .sort((a, b) => (parseYmd(b.endDate)?.getTime() ?? 0) - (parseYmd(a.endDate)?.getTime() ?? 0)),
    [filteredTrips]
  )
  // Keep SSR + first client paint identical (avoids hydration mismatch on subtitle / list).
  const [hasMounted, setHasMounted] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [isRedirectingToLogin, setIsRedirectingToLogin] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  useEffect(() => {
    if (!isRedirectingToLogin) return
    const timer = window.setTimeout(() => {
      router.push("/login")
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [isRedirectingToLogin, router])

  const handleStartTrip = async () => {
    if (isRedirectingToLogin) return
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setCreateOpen(true)
        return
      }
      setIsRedirectingToLogin(true)
    } catch {
      setIsRedirectingToLogin(true)
    }
  }

  const handleTripCreated = () => {
    void refreshTrips({ silent: true })
  }

  const showLoading = !hasMounted || loading
  const showTripList = !showLoading && filteredTrips.length > 0
  const showEmpty = !showLoading && trips.length === 0 && !isFiltered
  const showNoSearchResults = !showLoading && !showEmpty && filteredTrips.length === 0

  return (
    <div className="flex flex-col gap-5">
      <TripClipsTray trips={trips} />

      {error && hasMounted ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void refreshTrips()} className="rounded-full">
            다시 불러오기
          </Button>
        </div>
      ) : null}

      {isFiltered ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary px-3 py-2">
          <span className="text-sm font-medium">검색 필터</span>
          <Badge variant="outline" className="bg-card">
            {query}
          </Badge>
          <span className="text-sm text-muted-foreground tabular-nums">
            {filteredTrips.length}개 일치
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setQuery("")}
            className="ml-auto font-semibold"
          >
            <X data-icon="inline-start" />
            필터 해제
          </Button>
        </div>
      ) : null}

      {!showLoading && !showEmpty ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              My Trips
            </p>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">내 여행</h2>
          </div>
          <button
            type="button"
            onClick={() => void handleStartTrip()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-500 active:scale-95"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            새 여행 만들기
          </button>
        </div>
      ) : null}

      {showLoading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Supabase에서 여행을 불러오는 중…</p>
        </div>
      ) : showEmpty ? (
        <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center rounded-3xl border-2 border-dashed border-amber-300/70 bg-white/50 p-8 text-center backdrop-blur-sm transition-all md:p-12">
          <div className="rounded-full bg-gradient-to-tr from-amber-400 via-rose-400 to-amber-500 p-[2.5px] shadow-md">
            <span className="flex size-16 items-center justify-center rounded-full bg-white">
              <Compass className="size-7 text-amber-500" />
            </span>
          </div>
          <h3 className="mt-6 mb-2 text-xl font-bold tracking-tight text-gray-900 md:text-2xl">
            등록된 여행이 없습니다. 첫 번째 여행을 시작해 보세요!
          </h3>
          <p className="mx-auto mb-8 max-w-sm text-sm leading-relaxed text-gray-500">
            새 여행을 만들면 일정·숙소·정산을 친구들과 함께 관리할 수 있어요.
          </p>
          <button
            type="button"
            onClick={() => void handleStartTrip()}
            className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-7 py-3.5 text-sm font-semibold text-black shadow-lg shadow-amber-200/50 transition-all hover:scale-105 hover:bg-amber-500 active:scale-95"
          >
            <Plus className="size-4" />
            새 여행 시작하기
          </button>

          {/*
            여행부터 만들 마음이 아닌 사람에게도 갈 곳을 준다.
            버튼 하나뿐이면 거기서 막혀 되돌아 나간다.
          */}
          <div className="mt-10 w-full max-w-sm text-left">
            <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-400">
              이런 것도 할 수 있어요
            </p>
            {[
              {
                href: "/friends",
                Icon: Users,
                label: "친구 추가하기",
                desc: "친구와 여행을 함께 만들어요",
              },
              {
                href: "/saved",
                Icon: Bookmark,
                label: "가고 싶은 곳 찜해두기",
                desc: "인스타 게시물을 공유하면 장소를 찾아 담아줘요",
              },
            ].map((row) => (
              <Link
                key={row.href}
                href={row.href}
                className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50">
                  <row.Icon className="size-4 text-amber-500" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-800">{row.label}</span>
                  <span className="block text-xs text-slate-400">{row.desc}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      ) : showNoSearchResults ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-secondary">
            <SearchX className="size-5" />
          </span>
          <p className="text-sm font-semibold">{`"${query}" 와 일치하는 여행이 없어요`}</p>
          <p className="text-sm text-muted-foreground">
            다른 키워드로 검색하거나 새 여행을 만들어 보세요.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" onClick={() => setQuery("")} className="rounded-full font-semibold">
              전체 여행 보기
            </Button>
            <button
              type="button"
              onClick={() => void handleStartTrip()}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-500"
            >
              <Plus className="size-4" />
              새 여행 만들기
            </button>
          </div>
        </div>
      ) : showTripList ? (
        <div className="flex flex-col gap-4">
          {!isFiltered && pastList.length > 0 ? (
            <nav role="tablist" aria-label="여행 필터" className="flex items-stretch border-b border-slate-200/80">
              {(
                [
                  { key: "upcoming" as const, label: "다가오는", Icon: Plane, count: upcomingList.length },
                  { key: "past" as const, label: "지난 여행", Icon: History, count: pastList.length },
                ]
              ).map((tab) => {
                const isActive = homeFilter === tab.key
                const Icon = tab.Icon
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setHomeFilter(tab.key)}
                    className={cn(
                      "relative flex flex-1 flex-col items-center justify-center gap-1 py-3 transition-colors",
                      isActive ? "text-slate-900" : "text-slate-400"
                    )}
                  >
                    <Icon className="size-5" strokeWidth={isActive ? 2.1 : 1.7} />
                    <span className="text-[11px] font-semibold tracking-tight">
                      {tab.label}
                      {tab.count > 0 ? ` ${tab.count}` : ""}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-0 -bottom-px h-0.5 transition-colors",
                        isActive ? "bg-amber-400" : "bg-transparent"
                      )}
                    />
                  </button>
                )
              })}
            </nav>
          ) : null}

          {(() => {
            const list = isFiltered ? filteredTrips : homeFilter === "past" ? pastList : upcomingList
            const showAdd = !isFiltered && homeFilter === "upcoming"
            return (
              <div className={compact ? "flex flex-col gap-4" : "grid gap-5 xl:grid-cols-2"}>
                {list.length === 0 ? (
                  <p className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center text-sm text-slate-400">
                    {homeFilter === "past" ? "지난 여행이 없어요." : "다가오는 여행이 없어요."}
                  </p>
                ) : (
                  list.map((trip, index) => (
                    <TripBannerCard
                      key={trip.id}
                      trip={trip}
                      onSelect={onSelectTrip}
                      priority={index === 0 && homeFilter !== "past"}
                      muted={tripPhase(trip) === "past"}
                    />
                  ))
                )}
                {showAdd ? <AddTripCard onClick={() => void handleStartTrip()} /> : null}
              </div>
            )
          })()}
        </div>
      ) : null}

      <CreateTripDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleTripCreated}
      />

      <LoginRedirectOverlay
        open={isRedirectingToLogin}
        message="로그인이 필요한 서비스입니다"
      />
    </div>
  )
}
