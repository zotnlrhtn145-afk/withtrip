"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Heart,
  List,
  Loader2,
  Map as MapIcon,
  MapPin,
  Navigation,
  Plane,
  Plus,
  Star,
  X,
} from "lucide-react"

import { useGeolocation } from "@/hooks/use-geolocation"
import { LoginRedirectOverlay } from "@/components/login-redirect-overlay"
import { AddSavedPlaceModal } from "@/components/itinerary/AddSavedPlaceModal"
import { type MapSpot } from "@/components/nearby-map"
import { TripPickerModal } from "@/components/quick-register/trip-picker-modal"
import { useTrips } from "@/components/trips-store"
import { distanceMeters, estimateWalkMinutes, formatDistance } from "@/lib/geo"
import {
  assignSavedPlaceToTrip,
  deleteSavedPlace,
  fetchInterestPlacesByUserId,
  getErrorMessage,
  type SavedPlace,
} from "@/lib/saved-places-api"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

const NearbyMap = dynamic(
  () => import("@/components/nearby-map").then((mod) => mod.NearbyMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl border border-border bg-secondary sm:aspect-[16/11]">
        <p className="text-sm text-muted-foreground">Google 지도를 불러오는 중…</p>
      </div>
    ),
  }
)

type AuthPhase = "checking" | "guest" | "authed"
type ViewMode = "list" | "map"

/** "저장한 장소" — 여행에 상관없이 담아둔 관심 맛집을 한곳에 모아보는 탭. */
export function SavedPlacesView() {
  const router = useRouter()
  const { trips } = useTrips()
  const [authPhase, setAuthPhase] = useState<AuthPhase>("checking")
  const [userId, setUserId] = useState<string | null>(null)
  const [places, setPlaces] = useState<SavedPlace[]>([])
  const [loading, setLoading] = useState(false)
  const [subFilter, setSubFilter] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [assigningPlace, setAssigningPlace] = useState<SavedPlace | null>(null)
  const [assigningError, setAssigningError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null)
  const [recenterKey, setRecenterKey] = useState(0)
  const didAutoCenter = useRef(false)
  const followNextFix = useRef(false)
  const geo = useGeolocation()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (cancelled) return
        setAuthPhase(user ? "authed" : "guest")
        setUserId(user?.id ?? null)
      } catch {
        if (!cancelled) setAuthPhase("guest")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (authPhase !== "guest") return
    const timer = window.setTimeout(() => router.push("/login"), 1200)
    return () => window.clearTimeout(timer)
  }, [authPhase, router])

  const loadPlaces = async (uid: string) => {
    setLoading(true)
    const next = await fetchInterestPlacesByUserId(uid)
    setLoading(false)
    setPlaces(next)
  }

  useEffect(() => {
    if (authPhase !== "authed" || !userId) return
    void loadPlaces(userId)
  }, [authPhase, userId])

  // 마커 아바타용 — 저장한 장소는 전부 내 소유라 프로필 사진 하나만 있으면 된다.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle()
      if (!cancelled) setAvatarUrl((data?.avatar_url as string | null) ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  // AI가 대표 이미지를 실내/음식 사진으로 골라 교체하면 조용히 목록만 갱신한다.
  useEffect(() => {
    if (authPhase !== "authed" || !userId) return
    const onCoverReady = () => {
      void fetchInterestPlacesByUserId(userId).then(setPlaces)
    }
    window.addEventListener("withtrip:saved-place-cover-ready", onCoverReady)
    return () => window.removeEventListener("withtrip:saved-place-cover-ready", onCoverReady)
  }, [authPhase, userId])

  /** 저장된 장소에 실제로 존재하는 세부(음식) 카테고리만 칩으로 보여준다 — 일식/한식/스시/국수… */
  const subChips = useMemo(() => {
    const map = new Map<string, number>()
    for (const place of places) {
      const sub = place.subCategory.trim()
      if (!sub) continue
      map.set(sub, (map.get(sub) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
  }, [places])

  const filteredPlaces = useMemo(() => {
    if (!subFilter) return places
    return places.filter((place) => place.subCategory.trim() === subFilter)
  }, [places, subFilter])

  /** 리스트 카드에도 거리를 보여준다 — 좌표 없는 곳은 null. */
  const placeDistanceLabels = useMemo(() => {
    const map = new Map<string, string>()
    for (const place of filteredPlaces) {
      if (typeof place.lat !== "number" || typeof place.lng !== "number") continue
      const meters = distanceMeters(geo.position, { lat: place.lat, lng: place.lng })
      map.set(place.id, formatDistance(meters))
    }
    return map
  }, [filteredPlaces, geo.position])

  /** 지도 모드 마커 — 현재 카테고리 필터가 그대로 적용되고, 좌표가 없는 곳은 제외된다. */
  const mapSpots: MapSpot[] = useMemo(() => {
    return filteredPlaces
      .filter(
        (place): place is SavedPlace & { lat: number; lng: number } =>
          typeof place.lat === "number" && typeof place.lng === "number"
      )
      .map((place) => {
        const meters = distanceMeters(geo.position, { lat: place.lat, lng: place.lng })
        return {
          id: place.id,
          name: place.placeName,
          nameLocal: place.localName || place.placeName,
          category: place.subCategory || place.category || "저장한 장소",
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          rating: place.rating ?? 0,
          image: place.imageUrl,
          imageAlt: place.placeName,
          userId,
          authorNickname: null,
          authorAvatarUrl: avatarUrl,
          isInterest: true,
          distanceMeters: meters,
          distanceLabel: formatDistance(meters),
        }
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
  }, [filteredPlaces, geo.position, avatarUrl, userId])

  const selectedMapSpot = mapSpots.find((spot) => spot.id === selectedMapId) ?? null

  useEffect(() => {
    if (viewMode !== "map") return
    if (geo.status !== "ready") return
    if (!didAutoCenter.current) {
      didAutoCenter.current = true
      setRecenterKey((key) => key + 1)
      return
    }
    if (followNextFix.current) {
      followNextFix.current = false
      setRecenterKey((key) => key + 1)
    }
  }, [viewMode, geo.status, geo.position.lat, geo.position.lng])

  const handleRecenter = () => {
    followNextFix.current = true
    setRecenterKey((key) => key + 1)
    geo.locate()
  }

  const handleOpenDirections = (spot: { lat: number; lng: number }) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${geo.position.lat},${geo.position.lng}&destination=${spot.lat},${spot.lng}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const handleAssignTrip = async (tripId: string) => {
    if (!assigningPlace) return
    const place = assigningPlace
    setAssigningError(null)
    try {
      await assignSavedPlaceToTrip(place.id, tripId)
      setPlaces((current) => current.filter((item) => item.id !== place.id))
      setAssigningPlace(null)
    } catch (err) {
      setAssigningError(getErrorMessage(err) || "여행에 담지 못했어요.")
    }
  }

  const handleRemove = async (placeId: string) => {
    setRemovingId(placeId)
    const ok = await deleteSavedPlace(placeId)
    setRemovingId(null)
    if (ok) {
      setPlaces((current) => current.filter((item) => item.id !== placeId))
    }
  }

  if (authPhase === "checking") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      </div>
    )
  }

  if (authPhase === "guest") {
    return (
      <div className="min-h-[70vh] bg-white">
        <LoginRedirectOverlay open message="로그인이 필요한 화면입니다." />
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-5 bg-white">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Saved</p>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            저장한 장소
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-500 active:scale-95"
        >
          <Plus className="size-3.5" />
          장소 추가
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-7 animate-spin text-amber-500" />
        </div>
      ) : places.length === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-amber-300/80 bg-amber-50/20 p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-amber-400 text-slate-950">
            <Heart className="size-5" />
          </span>
          <h3 className="text-lg font-bold text-slate-900">아직 담아둔 장소가 없어요</h3>
          <p className="max-w-xs text-sm text-slate-500">
            여행과 상관없이 가고 싶은 곳을 먼저 저장해 두세요. 나중에 원하는 여행에 바로 옮길 수
            있어요.
          </p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-full bg-amber-400 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-md transition-all hover:bg-amber-500"
          >
            첫 장소 저장하기
          </button>
        </div>
      ) : (
        <>
          {/* 캐치테이블 "내주변"처럼 필터 칩은 스크롤 중에도 상단에 고정된다. */}
          <div
            className="sticky z-20 -mx-4 flex items-center gap-2 overflow-x-auto bg-white/95 px-4 py-2 backdrop-blur"
            style={{ top: 62 }}
          >
            <button
              type="button"
              onClick={() => setSubFilter(null)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all",
                !subFilter
                  ? "border-amber-400 bg-amber-400 text-slate-950 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:bg-amber-50/60"
              )}
            >
              전체
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  !subFilter ? "bg-slate-950/15" : "bg-slate-100"
                )}
              >
                {places.length}
              </span>
            </button>
            {subChips.map((chip) => {
              const active = subFilter === chip.label
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() =>
                    setSubFilter((current) => (current === chip.label ? null : chip.label))
                  }
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all",
                    active
                      ? "border-amber-400 bg-amber-400 text-slate-950 shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:bg-amber-50/60"
                  )}
                >
                  {chip.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] tabular-nums",
                      active ? "bg-slate-950/15" : "bg-slate-100"
                    )}
                  >
                    {chip.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="relative -mx-4">
            {viewMode === "map" ? (
              mapSpots.length === 0 ? (
                <div className="mx-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-400">
                  이 카테고리엔 위치 정보가 있는 장소가 없어요.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <NearbyMap
                    center={geo.position}
                    accuracy={geo.accuracy}
                    spots={mapSpots}
                    selectedId={selectedMapId}
                    onSelect={setSelectedMapId}
                    onRecenter={handleRecenter}
                    recenterKey={recenterKey}
                    locating={geo.status === "locating"}
                    className="h-[60vh] rounded-none border-x-0"
                    fill
                  />
                  {selectedMapSpot ? (
                    <div className="mx-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900">
                            {selectedMapSpot.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">{selectedMapSpot.address}</p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {selectedMapSpot.category}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-amber-700">
                          {selectedMapSpot.distanceLabel}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400 tabular-nums">
                        도보 약 {estimateWalkMinutes(selectedMapSpot.distanceMeters)}분
                      </p>
                      <button
                        type="button"
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-400 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-500 active:scale-[0.99]"
                        onClick={() => handleOpenDirections(selectedMapSpot)}
                      >
                        <Navigation className="size-4" />
                        길찾기
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            ) : filteredPlaces.length === 0 ? (
              <div className="mx-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-400">
                이 카테고리에 저장된 장소가 없어요.
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5 px-4">
                {filteredPlaces.map((place) => (
                  <li
                    key={place.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm"
                  >
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={place.imageUrl} alt="" className="size-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {place.placeName}
                        </p>
                        {place.rating ? (
                          <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums text-slate-400">
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                            {place.rating}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-slate-400">
                        {place.subCategory || place.category || "관심 장소"}
                        {place.address ? ` · ${place.address}` : ""}
                      </p>
                      {placeDistanceLabels.has(place.id) ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                          <MapPin className="size-3" />
                          {placeDistanceLabels.get(place.id)}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAssigningError(null)
                          setAssigningPlace(place)
                        }}
                        className="flex items-center justify-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-bold text-slate-950 transition-colors hover:bg-amber-500 active:scale-95"
                      >
                        <Plane className="size-3" />
                        담기
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemove(place.id)}
                        disabled={removingId === place.id}
                        aria-label={`${place.placeName} 삭제`}
                        className="flex items-center justify-center rounded-full border border-slate-200 p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 disabled:opacity-50"
                      >
                        {removingId === place.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <X className="size-3" />
                        )}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 캐치테이블처럼 지도/리스트를 오가는 버튼 하나만 화면에 고정해 둔다. */}
          <button
            type="button"
            onClick={() => setViewMode((current) => (current === "map" ? "list" : "map"))}
            className="fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-slate-900/20 transition-transform active:scale-95"
          >
            {viewMode === "map" ? (
              <>
                <List className="size-3.5" />
                목록 보기
              </>
            ) : (
              <>
                <MapIcon className="size-3.5" />
                지도 보기
              </>
            )}
          </button>
        </>
      )}

      <AddSavedPlaceModal
        tripId={null}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={(saved) => setPlaces((current) => [saved, ...current])}
        title="관심 장소 추가"
        description="여행과 상관없이 가고 싶은 곳을 먼저 담아둬요. 나중에 원하는 여행에 옮길 수 있어요."
      />
      <TripPickerModal
        open={assigningPlace !== null}
        onOpenChange={(next) => {
          if (!next) {
            setAssigningPlace(null)
            setAssigningError(null)
          }
        }}
        trips={trips.map((trip) => ({ id: trip.id, title: trip.title }))}
        title={assigningPlace ? `「${assigningPlace.placeName}」을 어느 여행에 담을까요?` : "여행 선택"}
        description={assigningError ?? "선택한 여행의 가고 싶은 곳에 바로 등록돼요."}
        onSelect={(trip) => void handleAssignTrip(trip.id)}
      />
    </div>
  )
}
