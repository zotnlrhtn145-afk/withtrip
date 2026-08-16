"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, Clock, MapPin, Navigation, Phone, Plane, Star } from "lucide-react"

import { DirectionsMenu } from "@/components/directions-menu"
import { MiniMap } from "@/components/mini-map"
import { distanceMeters, estimateWalkMinutes, formatDistance } from "@/lib/geo"
import { resizePlacePhotoUrl } from "@/lib/place-cover-image"
import { cn } from "@/lib/utils"
import { PHOTO_W } from "@/shared/photo-widths"

const NEAR_THRESHOLD_M = 40000 // 40km 이내면 내 위치도 함께

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
  userLoc,
  onClose,
  onAddToTrip,
}: {
  place: PlaceDetailInput | null
  userLoc?: { lat: number; lng: number } | null
  onClose: () => void
  /** 있으면 상세 안에 "여행에 담기" 버튼 노출 (저장 화면 전용). */
  onAddToTrip?: () => void
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

  /**
   * ⚠️ 처음엔 목록에서 받은 사진 한 장으로 그리다가, 상세가 오면 여러 장으로
   *    갈아끼워진다. 그때 **크기가 제각각이라 화면이 튀고 깨져 보였다.**
   *    폭을 하나로 맞춰 받는다 — 바뀌어도 같은 자리에 같은 크기로 들어온다.
   */
  const photos = (detail?.photos?.length ? detail.photos : place.imageUrl ? [place.imageUrl] : [])
    .filter(Boolean)
    .map((u) => resizePlacePhotoUrl(u, PHOTO_W.card))
  const name = place.name || detail?.name || "장소"
  const category = place.category || detail?.types?.[0] || ""
  const address = detail?.address || place.address || ""
  const rating = detail?.rating ?? place.rating ?? null
  const reviewCount = detail?.reviewCount ?? place.reviewCount ?? null
  const summary = detail?.summary || ""
  const lat = place.lat ?? detail?.lat
  const lng = place.lng ?? detail?.lng
  const dist = userLoc && lat != null && lng != null ? distanceMeters(userLoc, { lat, lng }) : null
  const near = dist != null && dist < NEAR_THRESHOLD_M

  /**
   * ⚠️ 예전엔 모바일에서 전체화면, 데스크톱에서 가운데 상자였다.
   *    폭이 화면 따라 널뛰니 사진이 커졌다 작아졌다 하며 깨져 보였다.
   *    **왼쪽에서 밀려 들어오는 고정 폭 패널**로 바꾼다 —
   *    어느 화면에서든 같은 크기라 사진도 항상 같은 자리에 온다.
   *    (필터는 오른쪽에서 온다. 방향을 달리해 둘을 구분한다)
   */
  return (
    /*
      ⚠️ 왼쪽 네비게이션(w-20, fixed)을 **덮지 않는다.**
         inset-0 이면 left:0 이라 패널이 네비 위에 올라앉는다.
         데스크톱에서는 네비 폭만큼 밀어서 그 **옆에서** 나오게 한다.
         (모바일에는 왼쪽 네비가 없으므로 md 부터만 민다)

      ⚠️ **overflow-hidden 이 핵심이다.** 패널은 제 폭만큼 왼쪽 바깥에서
         출발하는데(translateX(-100%)), 안 잘라주면 들어오는 동안 네비 위를
         지나가며 "덮는" 느낌이 난다. 잘라 주면 네비 뒤에서 **빠져나오는**
         느낌이 된다.
    */
    <div className="fixed inset-0 z-[80] flex overflow-hidden md:left-20">
      {/* 배경 — 패널과 달리 잘리지 않게 컨테이너 밖(고정)으로 둔다 */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/45 animate-in fade-in-0 md:left-20"
      />
      <div className="relative flex h-full w-[92%] max-w-[440px] flex-col overflow-hidden bg-white shadow-2xl duration-300 animate-in slide-in-from-left">
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
            className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/55"
            aria-label="뒤로"
          >
            <ChevronLeft className="size-6" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
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

          {onAddToTrip ? (
            <button
              type="button"
              onClick={onAddToTrip}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-500 active:scale-[0.99]"
            >
              <Plane className="size-4" />
              여행에 담기
            </button>
          ) : null}

          {summary ? <p className="text-sm leading-relaxed text-slate-500">{summary}</p> : null}

          {address ? (
            <div className="flex items-center gap-3">
              <MapPin className="size-5 shrink-0 text-amber-500" />
              <span className="min-w-0 flex-1 text-sm text-slate-800">{address}</span>
              <DirectionsMenu
                destination={lat != null && lng != null ? { name, lat, lng } : null}
                fallbackQuery={address || name}
                variant="pill"
                className="h-9 shrink-0 border-amber-400 bg-amber-400 px-3.5 text-sm font-bold text-slate-950 hover:border-amber-500 hover:bg-amber-500"
              />
            </div>
          ) : null}

          {dist != null ? (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5">
              <Navigation className="size-4 shrink-0 text-amber-500" />
              <span className="text-[13px] font-bold text-amber-700">
                내 위치에서 {formatDistance(dist)} · 도보 {estimateWalkMinutes(dist)}분
              </span>
            </div>
          ) : null}

          {lat != null && lng != null ? <MiniMap lat={lat} lng={lng} user={near ? userLoc : null} /> : null}

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
