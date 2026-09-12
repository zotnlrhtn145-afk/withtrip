"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Compass,
  Loader2,
  Plus,
  SearchX,
  X,
} from "lucide-react"

import { CreateTripDialog } from "@/components/create-trip-dialog"
import { LoginRedirectOverlay } from "@/components/login-redirect-overlay"
import { TravelStartArt } from "@/components/travel-start-art"
import { JoinTripDialog } from "@/components/join-trip-dialog"
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

  // Keep SSR + first client paint identical (avoids hydration mismatch on subtitle / list).
  const [hasMounted, setHasMounted] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [isRedirectingToLogin, setIsRedirectingToLogin] = useState(false)
  const [joining, setJoining] = useState(false)

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
  const showEmpty = !showLoading && upcomingList.length === 0 && !isFiltered
  const showNoSearchResults = !showLoading && !showEmpty && filteredTrips.length === 0

  return (
    <div className="flex flex-col gap-5">
      {/*
        ⚠️ 「TRIP CLIPS」 줄을 뺐다 — 안 쓰는 기능이라 빼 달라는 요청.
           앱에서도 같이 뺐다. 부품(`TripClipsTray`)과 올려 둔 자료는 그대로
           둔다 — 되살리려면 이 줄만 도로 넣으면 된다.
      */}

      {/*
        ⚠️ 「인기 템플릿」 줄도 뺐다 — 메인에서 빼 달라는 요청(2026-09-10).
           /templates 허브 자체는 그대로 산다(SEO 입구). 되살리려면
           <TemplateStrip /> 한 줄만 도로 넣으면 된다.
      */}

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
            <h2 className="mt-5 mb-[6px] text-[34px] leading-[43px] font-medium tracking-[-1px] text-[#191919]">
              {upcomingList.some(trip => tripPhase(trip) === "ongoing") ? <>우리의 여행이<br />이어지고 있어요.</> : <>다음 여행이<br />기다리고 있어요.</>}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void handleStartTrip()}
            aria-label="새 여행 만들기"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate-950 transition-transform active:scale-95"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            <span className="sr-only">새 여행 만들기</span>
          </button>
        </div>
      ) : null}

      {!showLoading && !showEmpty && upcomingList.length > 1 ? <p className="text-sm text-slate-600">준비 중인 여행 {upcomingList.length}개</p> : null}

      {showLoading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">여행을 불러오는 중…</p>
        </div>
      ) : showEmpty ? (
        <div className={cn("flex max-w-[440px] flex-col items-center bg-white px-[22px] pt-[22px] pb-4 text-center", compact ? "-mx-[26px] -mt-6 w-[calc(100%+52px)]" : "mx-auto w-full")}>
          <TravelStartArt />
          <h3 className="mt-[13px] mb-[14px] text-[32px] leading-[1.35] font-[720] tracking-[-1.2px] text-[#182126]">어디로 떠나고<br />싶으세요?</h3>
          <p className="mb-[27px] text-[14px] leading-[1.6] tracking-[-.45px] text-[#747c80]">함께할 사람과 여행을 만들어 보세요.</p>
          <button type="button" onClick={() => void handleStartTrip()} className="flex min-h-[54px] w-full items-center justify-center gap-[9px] rounded-[29px] bg-[#fbbf24] px-5 text-[17px] font-[650] text-[#182126] transition-transform duration-150 active:scale-[.98]">
            <img src="/design/empty/CirclePlus.svg" width={22} height={22} alt="" />첫 여행 만들기
          </button>
          <p className="mt-[23px] text-[12px] text-[#788084]">초대받은 여행이 있나요?</p>
          <button type="button" onClick={() => setJoining(true)} className="flex min-h-11 items-center justify-center gap-[9px] text-sm font-semibold text-[#182126]">초대 링크로 참여<img src="/design/empty/ArrowRight.svg" width={18} height={18} alt="" /></button>
          <JoinTripDialog open={joining} onOpenChange={setJoining} />
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
          {(() => {
            const list = isFiltered ? filteredTrips : upcomingList
            const showAdd = !isFiltered
            return (
              <div className={compact ? "flex flex-col gap-4" : "flex flex-col gap-5"}>
                {list.length === 0 ? (
                  <p className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center text-sm text-slate-400">
                    다가오는 여행이 없어요.
                  </p>
                ) : (
                  list.map((trip, index) => (
                    <Fragment key={trip.id}>
                    {index === 1 ? <h3 className="mt-3 mb-0 border-t border-[#d5dadf] pt-[22px] text-lg font-semibold">그다음 여행 <span className="font-normal text-gray-500">{list.length - 1}</span></h3> : null}
                    <TripBannerCard
                      approved
                      trip={trip}
                      onSelect={onSelectTrip}
                      priority={index === 0}
                      muted={tripPhase(trip) === "past"}
                      compact={index > 0}
                    />
                    </Fragment>
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
