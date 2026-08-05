"use client"

import { useEffect, useState } from "react"
import { Clock, MapPin, Phone, Star, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type PlaceDetailInput = {
  name: string
  address?: string | null
  lat?: number | null
  lng?: number | null
  imageUrl?: string | null
  category?: string | null
  rating?: number | null
  reviewCount?: number | null
}

type ApiDetail = {
  name: string
  address: string
  phone: string
  rating: number | null
  reviewCount: number | null
  types: string[]
  summary: string
  openNow: boolean | null
  hours: string[]
  lat: number | null
  lng: number | null
  photos: string[]
}

const todayIdx = (() => {
  const js = new Date().getDay() // 0=일
  return js === 0 ? 6 : js - 1 // google weekday_text: 월~일
})()

export function PlaceDetailSheet({
  place,
  onClose,
}: {
  place: PlaceDetailInput | null
  onClose: () => void
}) {
  const [detail, setDetail] = useState<ApiDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [showHours, setShowHours] = useState(false)

  useEffect(() => {
    if (!place) {
      setDetail(null)
      return
    }
    setShowHours(false)
    setDetail(null)
    setLoading(true)
    const params = new URLSearchParams({ q: place.name })
    if (place.lat != null && place.lng != null) {
      params.set("lat", String(place.lat))
      params.set("lng", String(place.lng))
    }
    let cancelled = false
    fetch(`/api/places/details?${params.toString()}`)
      .then((r) => r.json())
      .then((d: { detail?: ApiDetail | null }) => {
        if (!cancelled) setDetail(d.detail ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [place])

  useEffect(() => {
    if (!place) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [place, onClose])

  if (!place) return null

  const photos = (detail?.photos?.length ? detail.photos : place.imageUrl ? [place.imageUrl] : []).filter(Boolean)
  const name = place.name || detail?.name || "장소"
  const category = place.category || detail?.types?.[0] || ""
  const address = detail?.address || place.address || ""
  const rating = detail?.rating ?? place.rating ?? null
  const reviewCount = detail?.reviewCount ?? place.reviewCount ?? null
  const summary = detail?.summary || ""
  const lat = place.lat ?? detail?.lat
  const lng = place.lng ?? detail?.lng
  const directionsHref =
    lat != null && lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        {/* 사진 캐러셀 */}
        <div className="relative aspect-[4/3] w-full shrink-0 bg-slate-100">
          {photos.length > 0 ? (
            <div className="flex h-full w-full snap-x snap-mandatory overflow-x-auto">
              {photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p} alt="" className="h-full w-full shrink-0 snap-center object-cover" draggable={false} />
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-300">
              <MapPin className="size-12" />
            </div>
          )}
          {photos.length > 1 ? (
            <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center gap-1">
              {photos.map((_, i) => (
                <span key={i} className="size-1.5 rounded-full bg-white/70 shadow" />
              ))}
            </div>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/55"
            aria-label="닫기"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900">{name}</h2>
              {detail?.openNow != null ? (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                    detail.openNow ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"
                  )}
                >
                  {detail.openNow ? "영업 중" : "영업 종료"}
                </span>
              ) : loading ? (
                <span className="text-[11px] font-semibold text-slate-400">불러오는 중…</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {category ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{category}</span>
              ) : null}
              {rating ? (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  {rating.toFixed(1)}
                  {reviewCount ? ` · 리뷰 ${reviewCount.toLocaleString()}` : ""}
                </span>
              ) : null}
            </div>
          </div>

          {summary ? <p className="text-sm leading-relaxed text-slate-500">{summary}</p> : null}

          {address ? (
            <div className="flex items-center gap-3">
              <MapPin className="size-5 shrink-0 text-amber-500" />
              <span className="min-w-0 flex-1 text-sm text-slate-800">{address}</span>
              <a
                href={directionsHref}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-50"
              >
                길찾기
              </a>
            </div>
          ) : null}

          {detail?.phone ? (
            <div className="flex items-center gap-3">
              <Phone className="size-5 shrink-0 text-amber-500" />
              <a href={`tel:${detail.phone}`} className="text-sm text-slate-800">
                {detail.phone}
              </a>
            </div>
          ) : null}

          {detail?.hours && detail.hours.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <button
                type="button"
                onClick={() => setShowHours((v) => !v)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <Clock className="size-5 shrink-0 text-amber-500" />
                <span className="flex-1 text-sm font-bold text-slate-800">{detail.hours[todayIdx] ?? "영업시간"}</span>
                <span className="text-xs text-slate-400">{showHours ? "접기" : "전체"}</span>
              </button>
              {showHours ? (
                <div className="flex flex-col gap-1.5 px-4 pb-3">
                  {detail.hours.map((h, i) => (
                    <span key={i} className={cn("text-[13px]", i === todayIdx ? "font-bold text-slate-900" : "text-slate-500")}>
                      {h}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
