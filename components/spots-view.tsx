"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Footprints,
  Loader2,
  MapPin,
  MapPinOff,
  Navigation,
  RefreshCw,
  Star,
} from "lucide-react"

import { PlaceDetailSheet, type PlaceDetailInput } from "@/components/place-detail-sheet"
import { useGeolocation } from "@/hooks/use-geolocation"
import { DirectionsMenu } from "@/components/directions-menu"
import { LoginRedirectOverlay } from "@/components/login-redirect-overlay"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  distanceMeters,
  estimateWalkMinutes,
  formatDistance,
} from "@/lib/geo"
import { fetchNearbySpots } from "@/lib/spots-api"
import {
  DEFAULT_SPOT_AVATAR,
  type NearbySpot,
} from "@/lib/spots-data"
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

function SpotsEmptyState({ onGoHome }: { onGoHome: () => void }) {
  return (
    <div className="h-full min-h-[400px] flex flex-col justify-center items-center text-center p-8 bg-amber-50/20 border-2 border-dashed border-amber-300/80 rounded-2xl w-full">
      <h3 className="text-lg font-bold text-gray-900 mb-2">
        가고 싶은 장소를 등록해 보세요!
      </h3>
      <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed mb-6">
        여행 카드 상세 페이지에서 라운지바, 맛집, 핫플을 추가하면 이곳에서 지도와
        거리순으로 한눈에 확인할 수 있어요.
      </p>
      <button
        type="button"
        onClick={onGoHome}
        className="bg-amber-400 hover:bg-amber-500 text-black font-semibold text-sm px-6 py-2.5 rounded-full shadow-md transition-all"
      >
        내 여행 보러가기
      </button>
    </div>
  )
}

export function SpotsView() {
  const router = useRouter()
  const geo = useGeolocation()
  const [authPhase, setAuthPhase] = useState<AuthPhase>("checking")
  const [rawSpots, setRawSpots] = useState<NearbySpot[]>([])
  const [spotsLoading, setSpotsLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailPlace, setDetailPlace] = useState<PlaceDetailInput | null>(null)
  const [authorFilter, setAuthorFilter] = useState<string | null>(null)
  const [recenterKey, setRecenterKey] = useState(0)
  const didAutoCenter = useRef(false)
  const followNextFix = useRef(false)
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({})

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
    const timer = window.setTimeout(() => {
      router.push("/login")
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [authPhase, router])

  useEffect(() => {
    if (authPhase !== "authed") return
    let cancelled = false
    void (async () => {
      setSpotsLoading(true)
      const next = await fetchNearbySpots()
      if (cancelled) return
      setRawSpots(next)
      setSpotsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [authPhase])

  const spots = useMemo(() => {
    return rawSpots
      .map((spot) => {
        const meters = distanceMeters(geo.position, {
          lat: spot.lat,
          lng: spot.lng,
        })
        return {
          ...spot,
          distanceMeters: meters,
          distanceLabel: formatDistance(meters),
          walkMinutes: estimateWalkMinutes(meters),
        }
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
  }, [geo.position, rawSpots])

  /** Unique registrants among all spots — powers the "전체 / 사람별" filter chips. */
  const authors = useMemo(() => {
    const map = new Map<
      string,
      { userId: string; nickname: string; avatarUrl: string | null; count: number }
    >()
    for (const spot of spots) {
      const id = spot.userId?.trim()
      if (!id) continue
      const existing = map.get(id)
      if (existing) {
        existing.count += 1
        continue
      }
      map.set(id, {
        userId: id,
        nickname: spot.authorNickname?.trim() || "여행자",
        avatarUrl: spot.authorAvatarUrl?.trim() || null,
        count: 1,
      })
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [spots])

  const filteredSpots = useMemo(() => {
    if (!authorFilter) return spots
    return spots.filter((spot) => spot.userId === authorFilter)
  }, [spots, authorFilter])

  const selected = filteredSpots.find((spot) => spot.id === selectedId) ?? null

  useEffect(() => {
    if (authPhase !== "authed") return
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
  }, [authPhase, geo.status, geo.position.lat, geo.position.lng])

  useEffect(() => {
    if (!selectedId) return
    cardRefs.current[selectedId]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    })
  }, [selectedId])

  const handleRecenter = () => {
    followNextFix.current = true
    setRecenterKey((key) => key + 1)
    geo.locate()
  }

  // 지도 마커 클릭 → 해당 식당 상세 열기 (+ 리스트 하이라이트)
  const openSpotDetail = (id: string) => {
    setSelectedId(id)
    const s = spots.find((spot) => spot.id === id)
    if (s) {
      setDetailPlace({
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        imageUrl: s.image,
        category: s.category,
        rating: s.rating > 0 ? s.rating : null,
      })
    }
  }

  const statusLabel = (() => {
    switch (geo.status) {
      case "locating":
        return "고정밀 GPS로 위치를 확인하는 중…"
      case "ready":
        return geo.accuracy
          ? `정확도 ±${Math.round(geo.accuracy)}m · 실시간 추적`
          : "실시간 GPS 추적 중"
      case "denied":
        return "위치 권한 필요 · 오사카 우메다 기준 표시"
      case "timeout":
        return "위치 확인 시간 초과 · 다시 시도해 주세요"
      case "unavailable":
        return "위치 사용 불가 · 오사카 우메다 기준 표시"
      default:
        return "위치 준비 중"
    }
  })()

  const needsLocationRetry =
    geo.status === "denied" || geo.status === "timeout" || geo.status === "unavailable"

  const locationBanner = (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
      <span className="flex size-9 items-center justify-center rounded-full bg-amber-400 text-slate-950">
        <Navigation
          className={cn("size-4", geo.status === "locating" && "animate-pulse")}
        />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-bold text-slate-900">
          {geo.isFallback ? "오사카 · 우메다 (대체 위치)" : "내 현재 위치"}
        </span>
        <span className="text-xs text-slate-400">{statusLabel}</span>
      </div>
      {needsLocationRetry ? (
        <button
          type="button"
          onClick={handleRecenter}
          className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-50"
        >
          <RefreshCw className="size-3" />
          다시 시도
        </button>
      ) : null}
      <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-amber-700">
        {`${filteredSpots.length}곳`}
      </span>
    </div>
  )

  const permissionHelp =
    geo.status === "denied" ? (
      <div className="flex items-start gap-2.5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-500">
        <MapPinOff className="mt-0.5 size-4 shrink-0 text-slate-400" />
        <p>
          위치 권한이 거부되어 있어요. 브라우저 주소창의 자물쇠(사이트 정보) 아이콘 →
          &ldquo;위치&rdquo; 권한을 &ldquo;허용&rdquo;으로 바꾼 뒤 위의 &ldquo;다시 시도&rdquo;를
          눌러주세요. 그 전까지는 오사카 우메다 기준으로 거리·지도를 보여드려요.
        </p>
      </div>
    ) : geo.errorMessage ? (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-500">
        {geo.errorMessage}
      </div>
    ) : null

  const authorFilterRow =
    authors.length > 0 ? (
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setAuthorFilter(null)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all",
            !authorFilter
              ? "border-amber-400 bg-amber-400 text-slate-950 shadow-sm"
              : "border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:bg-amber-50/60"
          )}
        >
          전체
          <span
            className={cn(
              "rounded-full px-1.5 text-[10px] tabular-nums",
              !authorFilter ? "bg-slate-950/15" : "bg-slate-100"
            )}
          >
            {spots.length}
          </span>
        </button>
        {authors.map((author) => {
          const active = authorFilter === author.userId
          return (
            <button
              key={author.userId}
              type="button"
              onClick={() =>
                setAuthorFilter((current) => (current === author.userId ? null : author.userId))
              }
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border py-1 pr-3.5 pl-1 text-xs font-bold transition-all",
                active
                  ? "border-amber-400 bg-amber-400 text-slate-950 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:bg-amber-50/60"
              )}
            >
              <Avatar className={cn("size-5 border", active ? "border-slate-950/20" : "border-white")}>
                <AvatarImage src={author.avatarUrl || DEFAULT_SPOT_AVATAR} alt="" />
                <AvatarFallback className="bg-slate-100 text-[9px] font-bold text-slate-500">
                  {author.nickname.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[6rem] truncate">{author.nickname}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  active ? "bg-slate-950/15" : "bg-slate-100"
                )}
              >
                {author.count}
              </span>
            </button>
          )
        })}
      </div>
    ) : null

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
        <LoginRedirectOverlay
          open
          message="로그인이 필요한 화면입니다."
        />
      </div>
    )
  }

  if (spotsLoading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">주변 스팟을 불러오는 중…</p>
      </div>
    )
  }

  if (spots.length === 0) {
    return (
      <div className="flex flex-col gap-5 bg-white">
        {locationBanner}
        {permissionHelp}

        <div className="grid w-full grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          <div className="h-64 w-full md:h-full md:min-h-[400px]">
            <NearbyMap
              fill
              className="h-full rounded-2xl"
              center={geo.position}
              accuracy={geo.accuracy}
              spots={[]}
              selectedId={null}
              onSelect={() => {}}
              onRecenter={handleRecenter}
              recenterKey={recenterKey}
              locating={geo.status === "locating"}
            />
          </div>
          <SpotsEmptyState onGoHome={() => router.push("/")} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-full flex-col gap-5 overflow-x-hidden bg-white">
      {locationBanner}
      {permissionHelp}
      {authorFilterRow}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <NearbyMap
          center={geo.position}
          accuracy={geo.accuracy}
          spots={filteredSpots}
          selectedId={selectedId}
          onSelect={openSpotDetail}
          onRecenter={handleRecenter}
          recenterKey={recenterKey}
          locating={geo.status === "locating"}
          className="w-full min-w-0 max-w-full"
        />

        <section className="flex min-w-0 flex-col gap-3">
          <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">거리순</p>
          {filteredSpots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-400">
              이 멤버가 등록한 장소가 없어요.
            </div>
          ) : (
            <ul className="flex max-h-[min(70vh,640px)] flex-col gap-2 overflow-y-auto pr-0.5">
              {filteredSpots.map((spot) => {
                const isActive = spot.id === selectedId
                const author =
                  spot.authorNickname?.trim() ||
                  (spot.userId ? "여행자" : null)
                return (
                  <li
                    key={spot.id}
                    ref={(node) => {
                      cardRefs.current[spot.id] = node
                    }}
                  >
                    <div
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all",
                        isActive
                          ? "border-amber-300 bg-amber-50 shadow-sm"
                          : "border-slate-100 bg-white shadow-sm hover:bg-slate-50"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setDetailPlace({
                            name: spot.name,
                            lat: spot.lat,
                            lng: spot.lng,
                            imageUrl: spot.image,
                            category: spot.category,
                            rating: spot.rating > 0 ? spot.rating : null,
                          })
                        }
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <Avatar
                          className={cn(
                            "size-10 shrink-0 border-2",
                            isActive ? "border-amber-400" : "border-slate-100"
                          )}
                        >
                          <AvatarImage
                            src={spot.authorAvatarUrl || DEFAULT_SPOT_AVATAR}
                            alt=""
                          />
                          <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-500">
                            {(author || spot.name).slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className="size-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 bg-cover bg-center"
                          style={{ backgroundImage: `url(${spot.image})` }}
                          role="img"
                          aria-label={spot.imageAlt}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-bold text-slate-900">
                              {spot.name}
                            </span>
                            {spot.rating > 0 ? (
                              <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums text-slate-400">
                                <Star className="size-3 fill-amber-400 text-amber-400" />
                                {spot.rating}
                              </span>
                            ) : null}
                          </div>
                          <span className="truncate text-xs text-slate-400">
                            {spot.category}
                            {author ? ` · ${author}` : ` · ${spot.nameLocal}`}
                          </span>
                          <span className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span className="inline-flex items-center gap-1 font-bold text-slate-700 tabular-nums">
                              <MapPin className="size-3 text-amber-500" />
                              {spot.distanceLabel}
                            </span>
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Footprints className="size-3" />
                              도보 {spot.walkMinutes}분
                            </span>
                          </span>
                        </div>
                      </button>
                      <DirectionsMenu
                        destination={{ name: spot.name, lat: spot.lat, lng: spot.lng }}
                        variant="icon"
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {selected ? (
            <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar className="size-9 shrink-0 border border-slate-100">
                    <AvatarImage
                      src={selected.authorAvatarUrl || DEFAULT_SPOT_AVATAR}
                      alt=""
                    />
                    <AvatarFallback className="text-xs font-bold text-slate-500">
                      {(selected.authorNickname || selected.name).slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{selected.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {selected.address}
                    </p>
                    {selected.authorNickname ? (
                      <p className="mt-1 text-[11px] text-slate-400">
                        등록 · {selected.authorNickname}
                      </p>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-amber-700">
                  {selected.distanceLabel}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400 tabular-nums">
                위도 {selected.lat.toFixed(5)} · 경도 {selected.lng.toFixed(5)} ·
                도보 약 {selected.walkMinutes}분
              </p>
              <DirectionsMenu
                destination={{ name: selected.name, lat: selected.lat, lng: selected.lng }}
                variant="cta"
                className="mt-3"
              />
            </div>
          ) : null}
        </section>
      </div>

      <PlaceDetailSheet place={detailPlace} userLoc={geo.position} onClose={() => setDetailPlace(null)} />
    </div>
  )
}
