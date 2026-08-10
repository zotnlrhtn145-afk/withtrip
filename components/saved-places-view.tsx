"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bookmark, Check, Heart, Info, Loader2, Map as MapIcon, MapPin, Plus, Send, SlidersHorizontal, Star } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DirectionsMenu } from "@/components/directions-menu"
import { PlaceDetailSheet, type PlaceDetailInput } from "@/components/place-detail-sheet"
import { RecommendPlaceDialog, type RecommendTarget } from "@/components/recommend-place-dialog"
import { SwipeToDelete } from "@/components/swipe-to-delete"
import { fetchNearbySpots } from "@/lib/spots-api"
import { type NearbySpot } from "@/lib/spots-data"
import {
  dismissRecommendation,
  fetchIncomingRecommendations,
  saveRecommendation,
  type IncomingRec,
} from "@/lib/recommendations-api"
import { useGeolocation } from "@/hooks/use-geolocation"
import { LoginRedirectOverlay } from "@/components/login-redirect-overlay"
import { AddSavedPlaceModal } from "@/components/itinerary/AddSavedPlaceModal"
import { type MapSpot } from "@/components/nearby-map"
import { TripPickerModal } from "@/components/quick-register/trip-picker-modal"
import { useTrips } from "@/components/trips-store"
import { distanceMeters, formatDistance } from "@/lib/geo"
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
type SortMode = "distance" | "name" | "rating"
const SORT_LABELS: Record<SortMode, string> = {
  distance: "가까운 순",
  name: "이름순",
  rating: "평점 높은순",
}

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null)
  const [detailPlace, setDetailPlace] = useState<PlaceDetailInput | null>(null)
  const [detailAssign, setDetailAssign] = useState<SavedPlace | null>(null) // 상세에서 "담기" 대상
  const [tab, setTab] = useState<"mine" | "friends">("mine")
  const [subTab, setSubTab] = useState<"wish" | "trip">("wish")
  const [sort, setSort] = useState<"distance" | "name" | "rating">("distance")
  const [filterOpen, setFilterOpen] = useState(false)
  const [tripSpots, setTripSpots] = useState<NearbySpot[]>([])
  const [recs, setRecs] = useState<IncomingRec[]>([])
  const [recTarget, setRecTarget] = useState<RecommendTarget | null>(null)
  const [savingRecId, setSavingRecId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const [recenterKey, setRecenterKey] = useState(0)
  const didAutoCenter = useRef(false)
  const followNextFix = useRef(false)
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({})
  const geo = useGeolocation()

  // 지도 마커 클릭 등으로 선택되면 그 리스트 카드로 스크롤 이동
  useEffect(() => {
    if (!selectedMapId) return
    cardRefs.current[selectedMapId]?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [selectedMapId])

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
    void fetchIncomingRecommendations().then(setRecs)
    void fetchNearbySpots().then((s) => setTripSpots(s.filter((x) => x.tripId)))
  }, [authPhase, userId])

  const handleSaveRec = async (rec: IncomingRec) => {
    setSavingRecId(rec.id)
    const ok = await saveRecommendation(rec)
    setSavingRecId(null)
    if (ok) {
      // 담아도 카드는 유지 — 상태만 saved 로 표시
      setRecs((prev) => prev.map((r) => (r.id === rec.id ? { ...r, status: "saved" } : r)))
      if (userId) void loadPlaces(userId)
    }
  }

  const handleDismissRec = async (rec: IncomingRec) => {
    setRecs((prev) => prev.filter((r) => r.id !== rec.id))
    void dismissRecommendation(rec.id)
  }

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
    const base = subFilter ? places.filter((place) => place.subCategory.trim() === subFilter) : places
    const arr = [...base]
    if (sort === "name") return arr.sort((a, b) => a.placeName.localeCompare(b.placeName, "ko"))
    if (sort === "rating") return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    // 내 위치에서 가까운 순 (좌표 없는 곳은 뒤로)
    return arr.sort((a, b) => {
      const da = a.lat != null && a.lng != null ? distanceMeters(geo.position, { lat: a.lat, lng: a.lng }) : Infinity
      const db = b.lat != null && b.lng != null ? distanceMeters(geo.position, { lat: b.lat, lng: b.lng }) : Infinity
      return da - db
    })
  }, [places, subFilter, geo.position, sort])

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

  /** 지도 마커 — 현재 카테고리 필터가 그대로 적용되고, 좌표가 없는 곳은 제외된다. */
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

  // ── 여행클립 찜 (여행별 멤버 기여) ──────────────────────
  const tripChips = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of tripSpots) {
      const c = (s.category ?? "").trim()
      if (!c) continue
      map.set(c, (map.get(c) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
  }, [tripSpots])

  const filteredTripSpots = useMemo(() => {
    const base = subFilter ? tripSpots.filter((s) => (s.category ?? "").trim() === subFilter) : tripSpots
    const arr = [...base]
    if (sort === "name") return arr.sort((a, b) => a.name.localeCompare(b.name, "ko"))
    if (sort === "rating") return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    return arr.sort((a, b) => {
      const da = a.lat != null && a.lng != null ? distanceMeters(geo.position, { lat: a.lat, lng: a.lng }) : Infinity
      const db = b.lat != null && b.lng != null ? distanceMeters(geo.position, { lat: b.lat, lng: b.lng }) : Infinity
      return da - db
    })
  }, [tripSpots, subFilter, geo.position, sort])

  const tripDistanceLabels = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of filteredTripSpots) {
      if (typeof s.lat !== "number" || typeof s.lng !== "number") continue
      map.set(s.id, formatDistance(distanceMeters(geo.position, { lat: s.lat, lng: s.lng })))
    }
    return map
  }, [filteredTripSpots, geo.position])

  const tripMapSpots: MapSpot[] = useMemo(() => {
    return filteredTripSpots
      .filter((s): s is NearbySpot & { lat: number; lng: number } => typeof s.lat === "number" && typeof s.lng === "number")
      .map((s) => {
        const meters = distanceMeters(geo.position, { lat: s.lat, lng: s.lng })
        return {
          id: s.id,
          name: s.name,
          nameLocal: s.nameLocal || s.name,
          category: s.category || "여행 장소",
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          rating: s.rating ?? 0,
          image: s.image,
          imageAlt: s.imageAlt || s.name,
          userId: s.userId ?? null,
          authorNickname: s.authorNickname ?? null,
          authorAvatarUrl: s.authorAvatarUrl ?? null,
          isInterest: false,
          distanceMeters: meters,
          distanceLabel: formatDistance(meters),
        }
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
  }, [filteredTripSpots, geo.position])

  const activeChips = subTab === "wish" ? subChips : tripChips
  const activeMapSpots = subTab === "wish" ? mapSpots : tripMapSpots

  useEffect(() => {
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
  }, [geo.status, geo.position.lat, geo.position.lng])

  const handleRecenter = () => {
    followNextFix.current = true
    setRecenterKey((key) => key + 1)
    geo.locate()
  }

  // 리스트 클릭 → 지도가 그 위치로 이동(하이라이트) + 스티키 지도 보이게 맨 위로
  const showOnMap = (id: string) => {
    setSelectedMapId(id)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // 상세 열기 (+ 담기 대상 기억)
  const openDetail = (place: SavedPlace) => {
    setDetailAssign(place)
    setDetailPlace({
      name: place.placeName,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      imageUrl: place.imageUrl,
      category: place.subCategory || place.category,
      rating: place.rating ?? null,
      reviewCount: place.reviewCount ?? null,
    })
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

  const filterChipsNode = (
    <>
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
          {subTab === "wish" ? places.length : tripSpots.length}
        </span>
      </button>
      {activeChips.map((chip) => {
        const active = subFilter === chip.label
        return (
          <button
            key={chip.label}
            type="button"
            onClick={() => setSubFilter((current) => (current === chip.label ? null : chip.label))}
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
    </>
  )

  const renderPlaceCard = (place: SavedPlace) => (
    <li
      key={place.id}
      ref={(node) => {
        cardRefs.current[place.id] = node
      }}
      className="list-none"
    >
      <SwipeToDelete onDelete={() => setDeleteConfirm({ id: place.id, name: place.placeName })}>
        <div
          onClick={() => showOnMap(place.id)}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-2.5 shadow-sm transition-colors",
            selectedMapId === place.id
              ? "border-amber-300 bg-amber-50/60"
              : "border-slate-100 hover:bg-slate-50"
          )}
        >
          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={place.imageUrl} alt="" className="size-full object-cover" />
            {/* 친구 추천 흔적 — 보낸 사람 카카오 프로필 */}
            {place.recommendedBy && place.recommender ? (
              <span className="absolute -right-1 -bottom-1 z-10">
                <Avatar className="size-6 border-2 border-white">
                  {place.recommender.avatarUrl ? (
                    <AvatarImage src={place.recommender.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="bg-amber-400 text-[9px] font-bold text-slate-950">
                    {(place.recommender.nickname ?? "친구").slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold text-slate-900">{place.placeName}</p>
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
            {place.recommendedBy && place.recommender ? (
              <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                {place.recommender.nickname ?? "친구"}님의 추천
              </span>
            ) : null}
          </div>
          <div className="flex w-[74px] shrink-0 flex-col gap-1.5">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                openDetail(place)
              }}
              aria-label="상세 보기"
              className="flex h-7 w-full items-center justify-center gap-1 rounded-full bg-amber-400 text-[11px] font-bold text-slate-950 transition-colors hover:bg-amber-500 active:scale-95"
            >
              <Info className="size-3.5" />
              상세
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setRecTarget({
                  label: place.placeName,
                  sourceId: place.id,
                  place: {
                    place_name: place.placeName,
                    category: place.category,
                    sub_category: place.subCategory,
                    local_name: place.localName,
                    address: place.address,
                    phone_number: place.phoneNumber,
                    image_url: place.imageUrl,
                    rating: place.rating,
                    review_count: place.reviewCount,
                    lat: place.lat,
                    lng: place.lng,
                  },
                })
              }}
              aria-label={`${place.placeName} 친구에게 추천`}
              className="flex h-7 w-full items-center justify-center gap-1 rounded-full border border-amber-300 bg-white text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-50 active:scale-95"
            >
              <Send className="size-3.5" />
              추천
            </button>
            <div onClick={(event) => event.stopPropagation()}>
              <DirectionsMenu
                destination={{ name: place.placeName, lat: place.lat, lng: place.lng }}
                fallbackQuery={place.address || place.placeName}
                variant="pill"
                label="길찾기"
                icon={MapIcon}
                className="h-7 w-full justify-center gap-1 border-slate-200 text-[11px] text-slate-700"
              />
            </div>
          </div>
        </div>
      </SwipeToDelete>
    </li>
  )

  const renderTripSpotCard = (spot: NearbySpot) => (
    <li key={spot.id} className="list-none">
      <div
        onClick={() => setSelectedMapId(spot.id)}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-2.5 shadow-sm transition-colors",
          selectedMapId === spot.id ? "border-amber-300 bg-amber-50/60" : "border-slate-100 hover:bg-slate-50"
        )}
      >
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={spot.image} alt="" className="size-full object-cover" />
          {/* 담은 멤버 프로필 */}
          <span className="absolute -right-1 -bottom-1 z-10">
            <Avatar className="size-6 border-2 border-white">
              {spot.authorAvatarUrl ? <AvatarImage src={spot.authorAvatarUrl} alt="" /> : null}
              <AvatarFallback className="bg-amber-400 text-[9px] font-bold text-slate-950">
                {(spot.authorNickname ?? "친구").slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold text-slate-900">{spot.name}</p>
            {spot.rating ? (
              <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums text-slate-400">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                {spot.rating}
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-slate-400">
            {spot.category || "여행 장소"}
            {spot.address ? ` · ${spot.address}` : ""}
          </p>
          <p className="truncate text-[11px] text-slate-400">
            {spot.tripTitle || "여행"}
            {spot.authorNickname ? ` · ${spot.authorNickname}` : ""}
          </p>
          {tripDistanceLabels.has(spot.id) ? (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
              <MapPin className="size-3" />
              {tripDistanceLabels.get(spot.id)}
            </span>
          ) : null}
        </div>
        <div className="flex w-[74px] shrink-0 flex-col gap-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setDetailAssign(null)
              setDetailPlace({
                name: spot.name,
                address: spot.address,
                lat: spot.lat,
                lng: spot.lng,
                imageUrl: spot.image,
                category: spot.category,
                rating: spot.rating ?? null,
                reviewCount: null,
              })
            }}
            className="flex h-7 w-full items-center justify-center gap-1 rounded-full bg-amber-400 text-[11px] font-bold text-slate-950 transition-colors hover:bg-amber-500 active:scale-95"
          >
            <Info className="size-3.5" />
            상세
          </button>
          <div onClick={(event) => event.stopPropagation()}>
            <DirectionsMenu
              destination={{ name: spot.name, lat: spot.lat, lng: spot.lng }}
              fallbackQuery={spot.address || spot.name}
              variant="pill"
              label="길찾기"
              icon={MapIcon}
              className="h-7 w-full justify-center gap-1 border-slate-200 text-[11px] text-slate-700"
            />
          </div>
        </div>
      </div>
    </li>
  )

  return (
    <div className="flex w-full flex-col gap-5 bg-white">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Saved</p>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            저장한 장소
          </h2>
        </div>
        {tab === "mine" ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-500 active:scale-95"
          >
            <Plus className="size-3.5" />
            장소 추가
          </button>
        ) : null}
      </div>

      {/* 탭: 내 저장 / 친구 추천 */}
      <div className="flex border-b border-slate-100">
        {(
          [
            { k: "mine", label: "저장" },
            { k: "friends", label: recs.length > 0 ? `친구 추천찜 ${recs.length}` : "친구 추천찜" },
          ] as const
        ).map((it) => (
          <button
            key={it.k}
            type="button"
            onClick={() => setTab(it.k)}
            className={cn(
              "relative flex-1 py-3 text-sm font-bold transition-colors",
              tab === it.k ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
            )}
          >
            {it.label}
            {tab === it.k ? (
              <span className="absolute -bottom-px left-1/2 h-0.5 w-10 -translate-x-1/2 rounded bg-slate-900" />
            ) : null}
          </button>
        ))}
      </div>

      {tab === "friends" ? (
        <FriendRecsList
          recs={recs}
          savingId={savingRecId}
          onSave={handleSaveRec}
          onDismiss={handleDismissRec}
        />
      ) : loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-7 animate-spin text-amber-500" />
        </div>
      ) : places.length === 0 && tripSpots.length === 0 ? (
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
        <div className="relative -mx-4 md:-mx-6">
          {/*
            지도는 sticky로 화면에 고정되고, 리스트 카드는 지도 아래를 살짝 겹치도록
            음수 마진으로 끌어올려 둔다. 페이지를 아래로 스크롤하면 리스트가 지도를
            덮으며 올라오고, 맨 위로 스크롤하면 다시 지도 전체 + 타이틀이 보인다 —
            모바일/데스크톱 둘 다 동일하게, 핸들 없이 일반 스크롤만으로 동작한다.
            데스크톱은 헤더(40px)·좌우 여백(24px)만 다르고 나머지는 동일하다.
          */}
          <div
            className="sticky z-0 top-[62px] h-[calc(100dvh-258px)] md:top-[40px] md:h-[calc(100dvh-190px)]"
          >
            <NearbyMap
              center={geo.position}
              accuracy={geo.accuracy}
              spots={activeMapSpots}
              selectedId={selectedMapId}
              onSelect={setSelectedMapId}
              onRecenter={handleRecenter}
              recenterKey={recenterKey}
              locating={geo.status === "locating"}
              className="h-full rounded-none border-x-0"
              gestureHandling="cooperative"
              recenterBottomClass="bottom-28 md:bottom-24"
              fill
            />
          </div>

          <div className="relative z-10 -mt-[104px] min-h-[130vh] rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.14)] md:-mt-[88px]">
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="h-1.5 w-10 rounded-full bg-slate-300" />
            </div>

            {/* 소탭: 나의 찜 / 여행클립 찜 */}
            <div className="px-4 pb-1 md:px-6">
              <div className="flex rounded-full bg-slate-100 p-1">
                {(
                  [
                    { k: "wish", label: `나의 찜 ${places.length}` },
                    { k: "trip", label: `여행클립 찜 ${tripSpots.length}` },
                  ] as const
                ).map((it) => (
                  <button
                    key={it.k}
                    type="button"
                    onClick={() => {
                      setSubTab(it.k)
                      setSubFilter(null)
                    }}
                    className={cn(
                      "flex-1 rounded-full py-2 text-sm font-bold transition-colors",
                      subTab === it.k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    )}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sticky z-10 top-[62px] flex items-center justify-between gap-2 bg-white/95 px-4 pb-2.5 backdrop-blur md:top-[40px] md:px-6">
              <p className="truncate text-xs font-bold text-slate-400">
                {(subTab === "wish" ? "나의 찜 " : "여행클립 찜 ") +
                  (subTab === "wish" ? filteredPlaces.length : filteredTripSpots.length)}
                {subFilter ? ` · ${subFilter}` : ""} · {SORT_LABELS[sort]}
              </p>
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                  subFilter || sort !== "distance"
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                )}
              >
                <SlidersHorizontal className="size-3.5" />
                필터
              </button>
            </div>

            <div className="px-4 pt-3 pb-6 md:px-6">
              {subTab === "wish" ? (
                filteredPlaces.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-400">
                    이 카테고리에 저장된 장소가 없어요.
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2.5 md:grid md:grid-cols-2 xl:grid-cols-3">
                    {filteredPlaces.map((place) => renderPlaceCard(place))}
                  </ul>
                )
              ) : filteredTripSpots.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-400">
                  여행에 담은 장소가 없어요. 여행에서 가고 싶은 곳을 담으면 멤버들과 함께 여기에 모여요.
                </div>
              ) : (
                <ul className="flex flex-col gap-2.5 md:grid md:grid-cols-2 xl:grid-cols-3">
                  {filteredTripSpots.map((spot) => renderTripSpotCard(spot))}
                </ul>
              )}
            </div>
          </div>
        </div>
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

      <PlaceDetailSheet
        place={detailPlace}
        userLoc={geo.position}
        onClose={() => {
          setDetailPlace(null)
          setDetailAssign(null)
        }}
        onAddToTrip={
          detailAssign
            ? () => {
                const target = detailAssign
                setDetailPlace(null)
                setDetailAssign(null)
                setAssigningError(null)
                setAssigningPlace(target)
              }
            : undefined
        }
      />

      <RecommendPlaceDialog target={recTarget} onClose={() => setRecTarget(null)} />

      {/* 필터 · 정렬 */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
          <DialogHeader className="mb-1 text-left">
            <DialogTitle className="text-base font-bold text-slate-900">필터 · 정렬</DialogTitle>
          </DialogHeader>
          <p className="mb-2 text-xs font-bold text-slate-500">카테고리</p>
          <div className="mb-5 flex flex-wrap gap-2">{filterChipsNode}</div>
          <p className="mb-2 text-xs font-bold text-slate-500">정렬</p>
          <div className="flex flex-col gap-1">
            {(["distance", "name", "rating"] as SortMode[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                  sort === s ? "bg-amber-50 text-slate-900" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                {SORT_LABELS[s]}
                {sort === s ? <Check className="size-4 text-amber-600" /> : null}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen(false)}
            className="mt-5 w-full rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-500"
          >
            완료
          </button>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <Dialog open={Boolean(deleteConfirm)} onOpenChange={(next) => { if (!next) setDeleteConfirm(null) }}>
        <DialogContent className="rounded-3xl border-slate-100 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>장소 삭제</DialogTitle>
            <DialogDescription>
              {deleteConfirm ? `"${deleteConfirm.name}"을(를) 삭제하시겠습니까?` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDeleteConfirm(null)}>
              취소
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (deleteConfirm) void handleRemove(deleteConfirm.id)
                setDeleteConfirm(null)
              }}
              className="bg-destructive font-bold text-white hover:bg-destructive/90"
            >
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 친구가 보낸 추천 목록 — 보낸 사람 프로필 + "내 저장에 담기" */
function FriendRecsList({
  recs,
  savingId,
  onSave,
  onDismiss,
}: {
  recs: IncomingRec[]
  savingId: string | null
  onSave: (rec: IncomingRec) => void
  onDismiss: (rec: IncomingRec) => void
}) {
  if (recs.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-amber-300/70 bg-amber-50/20 p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-amber-400 text-slate-950">
          <Send className="size-5" />
        </span>
        <h3 className="text-lg font-bold text-slate-900">받은 추천이 없어요</h3>
        <p className="max-w-xs text-sm text-slate-500">
          친구가 맛집을 추천하면 여기에 모여요. 저장한 장소의 “추천” 버튼으로 친구에게 보낼 수 있어요.
        </p>
      </div>
    )
  }
  return (
    <ul className="flex flex-col gap-3 md:grid md:grid-cols-2">
      {recs.map((rec) => (
        <li key={rec.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          {/* 보낸 사람 */}
          <div className="flex items-center gap-2">
            <Avatar className="size-7 shrink-0">
              {rec.sender.avatarUrl ? <AvatarImage src={rec.sender.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-[10px] font-semibold">
                {rec.sender.nickname.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="text-xs text-slate-500">
              <span className="font-bold text-slate-900">{rec.sender.nickname}</span>님의 추천
            </p>
          </div>
          {/* 장소 */}
          <div className="flex items-center gap-3">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={rec.imageUrl ?? ""} alt="" className="size-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{rec.placeName}</p>
              <p className="truncate text-xs text-slate-400">
                {rec.subCategory || rec.category || "추천 장소"}
                {rec.address ? ` · ${rec.address}` : ""}
              </p>
              {rec.rating ? (
                <span className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-medium tabular-nums text-slate-400">
                  <Star className="size-3 fill-amber-400 text-amber-400" />
                  {rec.rating}
                </span>
              ) : null}
            </div>
          </div>
          {/* 액션 */}
          <div className="flex gap-2">
            {rec.status === "saved" ? (
              <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-sm font-bold text-slate-500">
                <Check className="size-4 text-emerald-600" />
                내 저장에 담김
              </span>
            ) : (
              <button
                type="button"
                disabled={savingId === rec.id}
                onClick={() => onSave(rec)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-500 disabled:opacity-60"
              >
                {savingId === rec.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Bookmark className="size-4" />
                    내 저장에 담기
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDismiss(rec)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
            >
              숨기기
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
