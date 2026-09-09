"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, Copy, Link2, Loader2, MapPin, PartyPopper, Sparkles, X } from "lucide-react"

import { DirectionsMenu } from "@/components/directions-menu"
import { TripRouteMap, type RouteStop } from "@/components/trip-route-map"
import { FALLBACK_TRIP_COVER, CITY_IMAGES, withUnsplashQuality } from "@/shared/city-images"
import type { PublicTrip } from "@/lib/templates-api"
import { cn } from "@/lib/utils"

/**
 * 공개 여행 뷰어 — /templates/[slug] 와 /share/[token] 이 같이 쓴다.
 *
 * ⚠️ 편집 기능은 없다. 웹은 읽기다 — 고치고 싶으면 복제해서 앱에서.
 * ⚠️ 움직임 규칙(목업에서 확정):
 *    · 화면·판 전환은 감속만, 튀지 않는다
 *    · 목록 갈아끼우기는 줄줄이 떠오름(시차 55~70ms)
 *    · 기다림은 스피너보다 스켈레톤 — 단, 복제처럼 짧고 명확한 건 스피너
 */
export function PublicTripViewer({ trip, mode }: { trip: PublicTrip; mode: "template" | "share" }) {
  const router = useRouter()
  const [day, setDay] = useState(trip.days[0]?.day ?? 1)
  const [forking, setForking] = useState(false)
  const [forked, setForked] = useState<string | null>(null)
  const [forkError, setForkError] = useState<string | null>(null)

  const stops = useMemo(() => trip.days.find((d) => d.day === day)?.stops ?? [], [trip.days, day])

  /*
    데스크톱 반반(회의 확정: "웹에서는 지도를 오른쪽편에 절반정도").

    ⚠️ CSS 로 숨기기만 하면 안 된다 — 숨겨도 지도는 **만들어지고 과금된다.**
       화면이 넓을 때만 마운트한다. 접히면 내려서 돈을 아낀다.
  */
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const sync = () => setWide(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  /* 지도에 찍을 수 있는 일정(좌표 있는 것)과, 타임라인 줄 ↔ 핀 연결 고리 */
  const mapStops = useMemo<RouteStop[]>(
    () =>
      stops
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => ({ name: s.placeName, lat: s.lat as number, lng: s.lng as number })),
    [stops]
  )
  const [selectedStop, setSelectedStop] = useState<number | null>(null)
  useEffect(() => setSelectedStop(null), [day])
  /* 타임라인 줄 번호 → 지도 핀 번호 (좌표 없는 줄은 핀이 없다) */
  const pinIndexOf = useMemo(() => {
    const m = new Map<number, number>()
    let pin = 0
    stops.forEach((s, i) => {
      if (s.lat != null && s.lng != null) m.set(i, pin++)
    })
    return m
  }, [stops])
  const rowIndexOf = useMemo(() => {
    const m = new Map<number, number>()
    for (const [row, pin] of pinIndexOf) m.set(pin, row)
    return m
  }, [pinIndexOf])
  const cover =
    trip.coverImage || (trip.city && CITY_IMAGES[trip.city] ? withUnsplashQuality(CITY_IMAGES[trip.city]) : FALLBACK_TRIP_COVER)

  async function fork() {
    if (forking) return
    setForking(true)
    setForkError(null)
    try {
      const res = await fetch(`/api/trips/${trip.id}/fork`, { method: "POST" })
      if (res.status === 401) {
        router.push("/?view=login")
        return
      }
      const body = (await res.json().catch(() => null)) as { newTripId?: string; error?: string } | null
      if (!res.ok || !body?.newTripId) {
        setForkError(body?.error ?? "복제하지 못했어요. 잠시 후 다시 시도해 주세요.")
        return
      }
      setForked(body.newTripId)
    } finally {
      setForking(false)
    }
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-background pb-28 lg:grid lg:max-w-7xl lg:grid-cols-2 lg:gap-0 lg:pb-0">
      <div className="min-w-0 lg:max-h-dvh lg:overflow-y-auto lg:pb-28">
      {/* 표지 — 도시 사진 위에 제목. 글씨는 그림자만, 상자 배경 금지(스토리와 같은 규칙) */}
      <div className="relative h-44 w-full overflow-hidden sm:rounded-b-3xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/25" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-[11px] font-bold tracking-wide text-white/75 drop-shadow">
            {mode === "template" ? "여행 템플릿" : "공유된 일정"}
            {trip.city ? ` · ${trip.city}` : ""}
            {trip.duration ? ` · ${trip.duration}` : ""}
          </p>
          <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-tight drop-shadow-md">{trip.title}</h1>
        </div>
      </div>

      {mode === "share" ? (
        <div className="animate-in fade-in slide-in-from-top-2 mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-primary/50 bg-accent px-3.5 py-2.5 text-xs font-bold text-accent-foreground duration-500">
          <Link2 className="size-3.5 shrink-0" />
          링크로 공유된 일정이에요 — 멤버·메모·정산은 보이지 않아요
        </div>
      ) : null}

      {/* 제목 아래 — 테마·복제 수·소개 */}
      <div className="px-4 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {trip.themes.map((t) => (
            <span
              key={t.key}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-extrabold text-secondary-foreground"
            >
              {t.emoji} {t.label}
            </span>
          ))}
          {mode === "template" && trip.forkCount > 0 ? (
            <span className="ml-auto text-xs font-extrabold text-amber-600">🔥 {trip.forkCount.toLocaleString()}명이 복제했어요</span>
          ) : null}
        </div>
        {trip.description ? <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{trip.description}</p> : null}
      </div>

      {/* Day 탭 */}
      <div className="scrollbar-none mt-3 flex gap-1.5 overflow-x-auto px-4">
        {trip.days.map((d) => (
          <button
            key={d.day}
            onClick={() => setDay(d.day)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-[13px] font-extrabold transition-all active:scale-95",
              d.day === day
                ? "border-foreground bg-foreground text-primary"
                : "border-border bg-card text-muted-foreground hover:border-foreground/30"
            )}
          >
            Day {d.day}
          </button>
        ))}
      </div>

      {/* 타임라인 — Day 를 바꾸면 줄줄이 떠오른다 */}
      <div key={day} className="px-4 pt-1">
        {stops.map((s, i) => (
          <div
            key={`${s.placeName}-${i}`}
            id={`viewer-stop-${day}-${i}`}
            onClick={() => {
              const pin = pinIndexOf.get(i)
              if (pin != null) setSelectedStop(pin)
            }}
            className={cn(
              "animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex items-start gap-3 border-b border-secondary py-3 duration-500 last:border-b-0",
              pinIndexOf.has(i) ? "lg:cursor-pointer lg:rounded-xl lg:px-2 lg:transition-colors lg:hover:bg-secondary/60" : "",
              selectedStop != null && pinIndexOf.get(i) === selectedStop ? "lg:bg-accent" : ""
            )}
            style={{ animationDelay: `${Math.min(i * 60, 480)}ms` }}
          >
            <span
              className={cn(
                "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-black transition-colors",
                selectedStop != null && pinIndexOf.get(i) === selectedStop
                  ? "bg-foreground text-primary"
                  : "bg-primary/25 text-foreground"
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-bold leading-snug text-foreground">{s.placeName}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {[s.category, s.address].filter(Boolean).join(" · ")}
              </p>
            </div>
            {s.visitTime ? (
              <span className="mt-1 flex shrink-0 items-center gap-1 text-[11.5px] font-extrabold text-amber-700">
                <Clock className="size-3" />
                {s.visitTime.slice(0, 5)}
              </span>
            ) : null}
            <DirectionsMenu
              variant="icon"
              destination={s.lat != null && s.lng != null ? { name: s.placeName, lat: s.lat, lng: s.lng } : null}
              fallbackQuery={s.placeName}
            />
          </div>
        ))}
        {stops.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">이 날은 일정이 비어 있어요</p>
        ) : null}
      </div>

      {/* 하단 고정 CTA — 어느 Day 를 보다가도 한 번에 */}
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-lg bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-5 pt-8 lg:inset-x-auto lg:left-0 lg:right-1/2 lg:mx-0 lg:max-w-none lg:px-[max(1rem,calc((100vw/2)-40rem+1rem))]">
        {forkError ? <p className="mb-2 text-center text-xs font-bold text-destructive">{forkError}</p> : null}
        {mode === "template" ? (
          <button
            onClick={fork}
            disabled={forking}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-black transition-all active:scale-[0.98]",
              forking
                ? "bg-secondary text-muted-foreground"
                : "bg-primary text-primary-foreground shadow-lg shadow-primary/40 hover:brightness-105"
            )}
          >
            {forking ? (
              <>
                <Loader2 className="size-4 animate-spin" /> 내 여행으로 복제하는 중…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> 이 일정 복제하기
              </>
            )}
          </button>
        ) : (
          <div className="flex gap-2">
            <a
              href={`withtripapp://trips/${trip.id}`}
              className="flex flex-1 items-center justify-center rounded-2xl border border-border bg-card py-3.5 text-[14px] font-extrabold text-foreground transition-all active:scale-[0.98]"
            >
              앱에서 참여하기
            </a>
            <a
              href="/"
              className="flex flex-1 items-center justify-center rounded-2xl bg-primary py-3.5 text-[14px] font-black text-primary-foreground shadow-lg shadow-primary/40 transition-all active:scale-[0.98]"
            >
              나도 일정 만들기
            </a>
          </div>
        )}
      </div>

      {/* 복제 완료 — 앱으로 넘어가는 다리 */}
      {forked ? <ForkDoneModal tripTitle={trip.title} newTripId={forked} onClose={() => setForked(null)} /> : null}
      </div>

      {/*
        오른쪽 절반 — 그 날의 동선 지도 (데스크톱만).
        ⚠️ `wide` 일 때만 마운트 — CSS 숨김만으로는 지도가 만들어져 과금된다.
      */}
      {wide && mapStops.length > 0 ? (
        <div className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh">
          <TripRouteMap
            stops={mapStops}
            selectedIndex={selectedStop}
            onSelect={(pin) => {
              setSelectedStop(pin)
              const row = rowIndexOf.get(pin)
              if (row != null) {
                document.getElementById(`viewer-stop-${day}-${row}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function ForkDoneModal({ tripTitle, newTripId, onClose }: { tripTitle: string; newTripId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[2px] sm:items-center">
      <div className="animate-in fade-in slide-in-from-bottom-4 relative w-full max-w-sm rounded-t-3xl bg-card p-6 pb-8 text-center shadow-2xl duration-300 sm:rounded-3xl sm:pb-6">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground" aria-label="닫기">
          <X className="size-5" />
        </button>
        <PartyPopper className="mx-auto size-11 text-primary" />
        <h2 className="mt-3 text-lg font-black text-foreground">내 여행으로 복제했어요!</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          「{tripTitle}」이 내 여행 목록에 들어갔어요.
          <br />
          이제 앱에서 마음대로 고치세요.
        </p>
        <a
          href={`withtripapp://trips/${newTripId}`}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-black text-primary-foreground shadow-md shadow-primary/40"
        >
          위드트립 앱에서 열기
        </a>
        <button onClick={onClose} className="mt-2 w-full rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground">
          나중에 할게요
        </button>
        <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground/70">
          <Copy className="size-3" /> 복제본은 비공개로 시작해요 · 앱이 없으면 스토어로 이동해요
        </p>
      </div>
    </div>
  )
}

export function ViewerFallbackIcon() {
  return <MapPin className="size-4" />
}
