"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

import { useEffect, useRef, useState, type ComponentProps } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Check, CheckCircle2, ChevronLeft, Clock, ExternalLink, MapPin, Navigation, Phone, Plane, Star } from "lucide-react"

import { DirectionsMenu } from "@/components/directions-menu"
import { InstagramIcon } from "@/components/icon-instagram"
import { MiniMap } from "@/components/mini-map"
import { PlaceReviews } from "@/components/place-reviews"
import { curatePlaceCover } from "@/lib/place-cover-curate"
import { fetchMyRating, fetchMyVisit, linkSavedPlaceKey, setVisited } from "@/lib/place-visits"
import { supabase } from "@/lib/supabase"
import { distanceMeters, estimateWalkMinutes, formatDistance } from "@/lib/geo"
import { resizePlacePhotoUrl } from "@/lib/place-cover-image"
import { cn } from "@/lib/utils"
import { PHOTO_W } from "@/shared/photo-widths"

const NEAR_THRESHOLD_M = 40000 // 40km 이내면 내 위치도 함께

export type PlaceDetailInput = {
  /**
   * saved_places 행 id. 있으면 상세를 열 때 가게 열쇠(google_place_id)를 **공짜로** 채운다 —
   * 어차피 부르는 /api/places/details 응답에 place_id 가 들어 있어서 추가 호출이 없다.
   * (저장한 곳이 아닌 주변 추천 등에는 없다)
   */
  savedPlaceId?: string | null
  /** 어디서 보고 담았는지 — 인스타 공유로 들어온 곳만 있다 */
  sourceUrl?: string | null
  /** 이미 채워져 있는 열쇠. 같으면 다시 쓰지 않는다(열 때마다 쓸 이유가 없다) */
  googlePlaceId?: string | null
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
  /** 가게를 가리키는 열쇠 — 리뷰가 이걸로 묶인다 */
  placeId: string
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

export function PlaceDetailSheet(props: ComponentProps<typeof PlaceDetailContents>) {
  const reduced = useReducedMotion()
  const container = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const open = !!props.place
  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => container.current?.querySelector<HTMLButtonElement>("button")?.focus())
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const items = Array.from(container.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]') ?? []).filter(e => e.getClientRects().length > 0)
      const first = items[0], last = items[items.length - 1]
      if (!first) { event.preventDefault(); return }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", trap)
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", trap) }
  }, [open])
  return <AnimatePresence onExitComplete={() => returnFocus.current?.focus()}>{props.place ? <motion.div ref={container} key="place-detail" className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={`${props.place.name} 장소 상세`} initial={{ opacity: 0, x: reduced ? 0 : 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : 28 }} transition={{ duration: reduced ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}><PlaceDetailContents {...props} /></motion.div> : null}</AnimatePresence>
}

function PlaceDetailContents({
  place,
  userLoc,
  onClose,
  onAddToTrip,
  onVisitedChange,
  onGooglePlaceId,
}: {
  place: PlaceDetailInput | null
  userLoc?: { lat: number; lng: number } | null
  onClose: () => void
  /** 있으면 상세 안에 "여행에 담기" 버튼 노출 (저장 화면 전용). */
  onAddToTrip?: () => void
  /** 다녀옴을 켜고 끌 때 목록에도 알린다(배지가 바로 바뀌게) */
  onVisitedChange?: (googlePlaceId: string, visited: boolean) => void
  /** 가게 열쇠를 방금 채웠을 때 — 목록의 그 행도 같이 맞춘다 */
  onGooglePlaceId?: (savedPlaceId: string, googlePlaceId: string) => void
}) {
  const [photoOpen, setPhotoOpen] = useState(false)
  const [detail, setDetail] = useState<ApiDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [showHours, setShowHours] = useState(false)
  const [tab, setTab] = useState<"photos" | "reviews" | "info">("photos")

  // ── 다녀옴 ────────────────────────────────────────────────
  const [visited, setVisitedState] = useState(false)
  const [visitedAt, setVisitedAt] = useState<string | null>(null)
  /** 리뷰를 썼으면 다녀옴을 못 푼다 — 안 가본 곳의 리뷰가 남으면 안 된다 */
  const [myRating, setMyRating] = useState<number | null>(null)
  const [visitBusy, setVisitBusy] = useState(false)
  const gpid = detail?.placeId ?? null
  /**
   * 가게 열쇠를 `saved_places` 에 적어 뒀는가.
   * ⚠️ 화면을 열 때 한 번 적는데 그때 실패하면 다녀옴이 저장 목록과 안 이어진다.
   *    그래서 **다녀옴을 누르는 순간 한 번 더** 확인한다 — 그때가 실제로 필요해지는 시점이다.
   */
  const keyLinked = useRef(false)

  useEffect(() => {
    if (!gpid) {
      setVisitedState(false)
      setVisitedAt(null)
      setMyRating(null)
      return
    }
    /**
     * ⚠️ 여기서 **공짜로** 가게 열쇠를 채운다. 상세는 어차피 /api/places/details 를
     *    부르고 거기서 place_id 가 온다. 따로 부르면 호출 수만 늘고 얻는 게 없다.
     *    (앱도 같은 자리에서 같은 일을 한다 — 어느 쪽으로 들어와도 채워진다)
     */
    const savedId = place?.savedPlaceId
    if (savedId && place?.googlePlaceId !== gpid) {
      // ⚠️ 결과를 보고 넘어간다. 예전엔 흘려보내서, 실패하면 다녀옴·리뷰가
      //    저장 목록과 영영 이어지지 않았다(그런 행이 실제로 DB 에 남아 있었다).
      void linkSavedPlaceKey(savedId, gpid).then((ok) => {
        keyLinked.current = ok
        if (ok) onGooglePlaceId?.(savedId, gpid)
      })
    } else if (savedId) {
      keyLinked.current = true
    }

    /**
     * 대표 사진 손보기 — **여기가 공짜로 되는 유일한 자리다.**
     *
     * ⚠️ 구글이 주는 사진 순서는 제멋대로다(36층 중식당에 1층 빌딩 입구 사진).
     *    이 화면은 어차피 사진 후보를 캐시에 채우고, 캐러셀로 그 사진들을
     *    내려받아 저장소에 쌓는다. 서버는 **이미 받아 둔 사진만** 보고 고르므로
     *    새로 드는 비용이 없다.
     *
     * ⚠️ 캐러셀이 다 받기 전에 부르면 볼 게 모자라 서버가 그냥 물러난다
     *    (표시를 안 남기므로 다음에 열면 다시 한다). 그래서 조금 기다린다.
     */
    const timer =
      (detail?.photos?.length ?? 0) >= 2
        ? setTimeout(() => {
            void curatePlaceCover({
              googlePlaceId: gpid,
              name: place?.name ?? detail?.name ?? "",
              kind: place?.category === "숙소" ? "stay" : "restaurant",
              subCategory: place?.category ?? "",
            }).then((url) => {
              if (!url || !savedId) return
              void supabase.from("saved_places").update({ image_url: url }).eq("id", savedId)
            })
          }, 3000)
        : null

    let cancelled = false
    void Promise.all([fetchMyVisit(gpid), fetchMyRating(gpid)]).then(([v, r]) => {
      if (cancelled) return
      setVisitedState(v.visited)
      setVisitedAt(v.visitedAt)
      setMyRating(r)
    })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [gpid])

  const toggleVisited = async () => {
    if (!gpid || visitBusy) return
    if (visited && myRating != null) {
      window.alert("리뷰를 먼저 지워야 다녀옴을 풀 수 있어요. (리뷰는 앱에서 지울 수 있습니다)")
      return
    }
    const next = !visited
    setVisitBusy(true)
    setVisitedState(next)
    setVisitedAt(next ? new Date().toISOString() : null)
    // 다녀옴만 남고 열쇠가 없으면 저장 목록에서 이 가게를 못 알아본다 — 여기서 마지막으로 잡는다
    const savedId = place?.savedPlaceId
    if (next && !keyLinked.current && savedId) {
      keyLinked.current = await linkSavedPlaceKey(savedId, gpid)
    }
    const ok = await setVisited(gpid, next)
    setVisitBusy(false)
    if (!ok) {
      setVisitedState(!next)
      setVisitedAt(!next ? new Date().toISOString() : null)
      window.alert("다시 시도해 주세요.")
      return
    }
    onVisitedChange?.(gpid, next)
  }

  useEffect(() => {
    if (!place) {
      setDetail(null)
      return
    }
    setShowHours(false)
    setTab("photos")
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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !photoOpen && onClose()
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [place, onClose, photoOpen])

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
   * ⚠️ **폰에서는 앱과 똑같이 전체 화면**, 데스크톱에서만 왼쪽 슬라이드 패널이다.
   *
   *    한때 데스크톱용 패널(w-92%)을 폰에도 그대로 씌웠더니 오른쪽에 검은 띠가
   *    남아 앱과 딴판이 됐다. 폰에는 왼쪽 네비게이션이 없으니 패널로 만들 이유도 없다.
   *
   *    사진이 깨져 보이던 건 폭 때문이 아니라 **사진을 제각각 크기로 받아서**였고,
   *    그건 resizePlacePhotoUrl(PHOTO_W.card) 로 이미 잡혔다.
   *    그러니 폰을 전체 화면으로 되돌려도 다시 깨지지 않는다.
   *
   *    들어오는 방향도 맞춘다 — 폰은 앱처럼 오른쪽에서(화면을 밀고 들어옴),
   *    데스크톱은 왼쪽 네비 뒤에서. (필터는 오른쪽에서 온다)
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
      {/*
        배경 — 패널과 달리 잘리지 않게 컨테이너 밖(고정)으로 둔다.
        폰에서는 화면을 꽉 채우니 배경이 보일 자리가 없다 — 데스크톱에서만 그린다.
      */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="fixed inset-0 hidden bg-slate-900/45 animate-in fade-in-0 md:left-20 md:block"
      />
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-white md:w-[92%] md:max-w-[440px] md:shadow-2xl">
        <header className="flex min-h-16 shrink-0 items-center gap-3 px-4">
          <button type="button" onClick={onClose} aria-label="뒤로" className="grid size-11 place-items-center text-slate-900"><ChevronLeft className="size-5" /></button><span className="flex-1 text-center text-[15px] font-semibold text-slate-800">장소 상세</span><span className="size-11" />
        </header>

        {/* 본문 */}
        <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 pb-6">
          {photos.length ? <button type="button" onClick={() => setPhotoOpen(true)} aria-label="장소 사진 확대" className="-mx-2 shrink-0 overflow-hidden rounded-3xl"><img src={photos[0]} alt={name} className="h-[236px] w-full object-cover" /></button> : null}
          {category ? <p className="mt-1 text-sm text-slate-500">{category}</p> : null}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[26px] leading-9 font-semibold text-slate-900">{name}</h2>
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
                <span className="text-sm font-semibold text-slate-600">불러오는 중…</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {rating ? (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                  {rating.toFixed(1)}
                  {reviewCount ? ` · 리뷰 ${reviewCount.toLocaleString()}` : ""}
                </span>
              ) : null}
            </div>
          </div>

          {address ? <p className="text-sm leading-[22px] text-slate-500">{address}</p> : null}
          <div className="flex items-start justify-around gap-2 py-3">
            <div className="flex flex-1 flex-col items-center gap-2"><DirectionsMenu destination={lat != null && lng != null ? { name, lat, lng } : null} fallbackQuery={address || name} variant="icon" className="size-11 rounded-full border border-slate-300 bg-white text-slate-900" /><span className="text-xs">길찾기</span></div>
            {detail?.phone ? <a href={`tel:${detail.phone.replace(/[^+0-9]/g, "")}`} className="flex flex-1 flex-col items-center gap-2 text-xs"><span className="grid size-11 place-items-center rounded-full border border-slate-300"><img src="/design/place/action-2.svg" alt="" className="size-[22px]" /></span>전화</a> : null}
            {onAddToTrip ? <button type="button" onClick={onAddToTrip} className="flex flex-1 flex-col items-center gap-2 text-xs"><span className="grid size-11 place-items-center rounded-full border border-[#fbbf24]"><img src="/design/place/action-3.svg" alt="" className="size-[22px]" /></span>여행에</button> : null}
            {gpid ? <button type="button" onClick={() => void toggleVisited()} aria-pressed={visited} className="flex flex-1 flex-col items-center gap-2 text-xs"><span className={cn("grid size-11 place-items-center rounded-full border",visited ? "border-[#fbbf24]" : "border-slate-300")}><img src="/design/place/action-5.svg" alt="" className="size-[22px]" /></span>{visited ? "다녀옴 ✓" : "다녀옴"}</button> : null}
          </div>
          <Dialog open={photoOpen} onOpenChange={setPhotoOpen}><DialogContent className="border-0 bg-black p-0"><DialogTitle className="sr-only">{name} 사진</DialogTitle>{photos[0] ? <img src={photos[0]} alt={name} className="max-h-[85svh] w-full object-contain" /> : null}</DialogContent></Dialog>
          <div role="tablist" aria-label="장소 상세 보기" className="flex shrink-0 border-b border-neutral-200">
            {([{ key: "photos", label: `사진 ${photos.length}` }, { key: "reviews", label: "리뷰" }, { key: "info", label: "정보" }] as const).map(t => <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn("min-h-14 flex-1 border-b-[3px] text-[15px] font-semibold transition-colors", tab === t.key ? "border-[#fbbf24] text-slate-900" : "border-transparent text-slate-500")}>{t.label}</button>)}
          </div>
          <div key={tab} role="tabpanel" className="flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 duration-200">
          {tab === "photos" ? <><h3 className="text-lg font-bold">장소 사진</h3>{photos.length ? <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto">{photos.map((photo, i) => <img key={i} src={photo} alt={`${name} 사진 ${i + 1}`} className="aspect-[4/3] w-full shrink-0 snap-center rounded-2xl object-cover" loading="lazy" />)}</div> : <p className="py-8 text-center text-sm text-slate-500">아직 사진이 없어요</p>}</> : null}
          {tab === "info" ? <>
          {address ? (
            <div className="space-y-3 border-t border-neutral-100 pt-5">
              <h3 className="text-lg font-bold text-slate-950">주소 및 위치</h3>
              <p className="w-full select-text text-base leading-relaxed text-slate-800">{address}</p>
              <DirectionsMenu
                destination={lat != null && lng != null ? { name, lat, lng } : null}
                fallbackQuery={address || name}
                variant="pill"
                className="h-9 shrink-0 border-amber-400 bg-amber-400 px-3.5 text-sm font-bold text-slate-950 hover:border-amber-500 hover:bg-amber-500"
              />
            </div>
          ) : null}
          {/*
            어디서 보고 담았는지.
            ⚠️ 담아 놓고 "이거 어디서 봤더라" 하는 일이 잦다 — 원본으로 바로 갈 수 있게 한다.
          */}
          {place.sourceUrl ? (
            <a
              href={place.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 text-left"
            >
              <InstagramIcon className="size-5 shrink-0 text-amber-500" />
              <span className="min-w-0 flex-1 text-sm text-slate-800">인스타그램에서 담은 곳</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-slate-500">
                게시물 보기
                <ExternalLink className="size-3.5" />
              </span>
            </a>
          ) : null}

          {summary ? <p className="text-sm leading-relaxed text-slate-500">{summary}</p> : null}



          {dist != null ? (
            <div className="flex items-center gap-2 border-t border-neutral-100 py-3">
              <Navigation className="size-4 shrink-0 text-amber-500" />
              <span className="text-[13px] font-semibold text-slate-700">
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
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setShowHours((v) => !v)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <Clock className="size-5 shrink-0 text-amber-500" />
                <span className="flex-1 text-sm font-bold text-slate-800">{detail.hours[todayIdx] ?? "영업시간"}</span>
                <span className="text-sm text-slate-600">{showHours ? "접기" : "전체"}</span>
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

          </> : null}
          {tab === "reviews" ? <PlaceReviews googlePlaceId={detail?.placeId} /> : null}
          </div>

        </div>
      </div>
    </div>
  )
}
