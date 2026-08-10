"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import {
  CalendarDays,
  ChevronRight,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Loader2,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plane,
  Sun,
  Trash2,
} from "lucide-react"

import { EditTripDialog } from "@/components/edit-trip-dialog"
import { useTrips } from "@/components/trips-store"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { FALLBACK_TRIP_COVER } from "@/lib/getCityImage"
import { getTripMembers, formatTripDuration, type Trip } from "@/lib/trip-data"
import { formatMemberSummary } from "@/lib/trip-group"
import { deleteTripFromSupabase } from "@/lib/trips-api"
import { cn } from "@/lib/utils"
import { useWeather } from "@/hooks/use-weather"
import { weatherIconKey } from "@/lib/weather"

const weatherIcons = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  "cloud-fog": CloudFog,
  "cloud-rain": CloudRain,
  "cloud-snow": CloudSnow,
  "cloud-lightning": CloudLightning,
  rain: CloudRain,
} as const

export function TripBannerCard({
  trip,
  onSelect,
  priority = false,
  muted = false,
}: {
  trip: Trip
  onSelect: (trip: Trip) => void
  priority?: boolean
  /** 지난 여행 — 흐리게+탈색 처리. */
  muted?: boolean
}) {
  const { members, refreshTrips } = useTrips()
  const { weather } = useWeather(trip.region)
  const WeatherIcon = weather ? weatherIcons[weatherIconKey(weather.code)] : weatherIcons[trip.weatherIcon]
  const tripMembers = trip.groupMembers?.length
    ? trip.groupMembers
    : getTripMembers(trip, members)
  const memberSummary = formatMemberSummary(tripMembers.map((member) => member.name))
  const [coverSrc, setCoverSrc] = useState(trip.heroImage || FALLBACK_TRIP_COVER)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCoverSrc(trip.heroImage || FALLBACK_TRIP_COVER)
  }, [trip.heroImage])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener("mousedown", onPointerDown)
    return () => window.removeEventListener("mousedown", onPointerDown)
  }, [menuOpen])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteTripFromSupabase(trip.id)
      setConfirmOpen(false)
      setMenuOpen(false)
      setNotice("여행이 삭제되었습니다.")
      await refreshTrips({ silent: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "여행 삭제에 실패했어요."
      console.error("[TripBannerCard] delete failed:", message)
      setNotice(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <article
        className={cn(
          "group media-card relative h-64 w-full overflow-hidden rounded-2xl border border-border text-left sm:h-72",
          muted && "opacity-80 saturate-0"
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(trip)}
          aria-label={`${trip.title} 상세 보기`}
          className="absolute inset-0 z-0 block size-full ring-offset-2 ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src={coverSrc}
            alt={trip.heroImageAlt}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 640px, (min-width: 768px) 50vw, 100vw"
            className="media-card-image object-cover"
            onError={() => setCoverSrc(FALLBACK_TRIP_COVER)}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
          />
        </button>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-4">
          {muted ? (
            <Badge className="pointer-events-none h-8 rounded-full bg-slate-700/85 px-3 text-sm font-bold text-white/90 shadow-sm">
              종료
            </Badge>
          ) : (
            <Badge className="pointer-events-none h-8 rounded-full px-3 text-sm font-bold tabular-nums shadow-sm">
              D-{trip.dDay}
            </Badge>
          )}

          <div className="pointer-events-auto relative flex items-center gap-1.5" ref={menuRef}>
            {weather ? (
              <Badge variant="secondary" className="h-8 rounded-full px-3">
                <WeatherIcon data-icon="inline-start" />
                {weather.label}
              </Badge>
            ) : null}
            <button
              type="button"
              aria-label="여행 더보기"
              aria-expanded={menuOpen}
              className={cn(
                "cursor-pointer rounded-full p-1.5 text-white/80 backdrop-blur-md transition-all",
                "hover:bg-black/20 hover:text-white z-10"
              )}
              onClick={(event) => {
                event.stopPropagation()
                setMenuOpen((open) => !open)
              }}
            >
              <MoreHorizontal className="size-5" />
            </button>

            {menuOpen ? (
              <div
                className={cn(
                  "absolute top-10 right-0 z-50 w-36 rounded-2xl border border-slate-100",
                  "bg-white/95 p-1.5 text-xs font-medium text-slate-800 shadow-xl backdrop-blur-md"
                )}
                onClick={(event) => event.stopPropagation()}
              >
                <EditTripDialog
                  trip={trip}
                  trigger={
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition-all hover:bg-slate-100"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Pencil className="size-3.5 text-slate-500" />
                      여행 편집
                    </button>
                  }
                />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-semibold text-red-500 transition-all hover:bg-red-50"
                  onClick={() => {
                    setMenuOpen(false)
                    setConfirmOpen(true)
                  }}
                >
                  <Trash2 className="size-3.5" />
                  여행 삭제
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 p-4 sm:p-5"
          onClick={() => onSelect(trip)}
        >
          <button
            type="button"
            className="pointer-events-auto flex flex-col gap-2 text-left"
            onClick={() => onSelect(trip)}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90">
              <MapPin className="size-3.5" />
              {trip.region} · {trip.country}
            </span>

            <div className="flex items-end justify-between gap-3">
              <h3 className="text-2xl leading-tight font-bold text-balance text-white drop-shadow-sm sm:text-[1.75rem]">
                {trip.title}
              </h3>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform group-hover:translate-x-0.5">
                <ChevronRight className="size-5" />
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/90">
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <CalendarDays className="size-3.5" />
                {trip.startDate} — {trip.endDate}
              </span>
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Plane className="size-3.5" />
                {trip.flight}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2">
              <AvatarGroup className="-space-x-1.5">
                {tripMembers.map((member) => (
                  <Avatar key={member.id} className="size-6 ring-2 ring-black/40">
                    {"avatarUrl" in member && member.avatarUrl ? (
                      <AvatarImage src={member.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback className={`${member.color} text-[10px] font-semibold`}>
                      {member.initials}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
              <span className="truncate text-xs text-white/90">
                {memberSummary}
                <span className="text-white/70">
                  {" "}
                  · {formatTripDuration(trip.nights, trip.days)}
                </span>
              </span>
            </div>
          </button>
        </div>
      </article>

      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!deleting) setConfirmOpen(false)
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-center text-sm font-bold text-slate-900">
              &apos;{trip.title}&apos; 여행을 삭제하시겠습니까?
            </p>
            <p className="mt-1.5 text-center text-xs text-slate-400">
              데이터가 완전히 삭제됩니다.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-full bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-200 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDelete()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-red-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="pointer-events-none fixed right-4 bottom-4 z-[100] rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-lg">
          {notice}
        </div>
      ) : null}
    </>
  )
}
