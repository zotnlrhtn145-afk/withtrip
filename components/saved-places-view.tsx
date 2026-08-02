"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Heart, Loader2, Plane, Plus, Star, X } from "lucide-react"

import { LoginRedirectOverlay } from "@/components/login-redirect-overlay"
import { AddSavedPlaceModal } from "@/components/itinerary/AddSavedPlaceModal"
import { TripPickerModal } from "@/components/quick-register/trip-picker-modal"
import { useTrips } from "@/components/trips-store"
import {
  assignSavedPlaceToTrip,
  deleteSavedPlace,
  fetchInterestPlacesByUserId,
  getErrorMessage,
  type SavedPlace,
} from "@/lib/saved-places-api"
import { wishlistCategories } from "@/lib/trip-itinerary"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

type AuthPhase = "checking" | "guest" | "authed"

/** "저장한 장소" — 여행에 상관없이 담아둔 관심 맛집을 한곳에 모아보는 탭. */
export function SavedPlacesView() {
  const router = useRouter()
  const { trips } = useTrips()
  const [authPhase, setAuthPhase] = useState<AuthPhase>("checking")
  const [userId, setUserId] = useState<string | null>(null)
  const [places, setPlaces] = useState<SavedPlace[]>([])
  const [loading, setLoading] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [subFilter, setSubFilter] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [assigningPlace, setAssigningPlace] = useState<SavedPlace | null>(null)
  const [assigningError, setAssigningError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

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

  /** 전체 / 레스토랑 / 라운지 & 바 / 숙소 — 저장된 값 기준 카운트. */
  const categoryChips = useMemo(() => {
    return wishlistCategories.map((item) => ({
      value: item.label,
      label: item.label,
      count: places.filter((place) => place.category === item.label).length,
    }))
  }, [places])

  const categoryFiltered = useMemo(() => {
    if (!categoryFilter) return places
    return places.filter((place) => place.category === categoryFilter)
  }, [places, categoryFilter])

  /** 카테고리 필터 안에서, 실제로 존재하는 세부(음식) 카테고리만 칩으로 보여준다. */
  const subChips = useMemo(() => {
    const map = new Map<string, number>()
    for (const place of categoryFiltered) {
      const sub = place.subCategory.trim()
      if (!sub) continue
      map.set(sub, (map.get(sub) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
  }, [categoryFiltered])

  useEffect(() => {
    setSubFilter(null)
  }, [categoryFilter])

  const filteredPlaces = useMemo(() => {
    if (!subFilter) return categoryFiltered
    return categoryFiltered.filter((place) => place.subCategory.trim() === subFilter)
  }, [categoryFiltered, subFilter])

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
          <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all",
                !categoryFilter
                  ? "border-amber-400 bg-amber-400 text-slate-950 shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:bg-amber-50/60"
              )}
            >
              전체
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  !categoryFilter ? "bg-slate-950/15" : "bg-slate-100"
                )}
              >
                {places.length}
              </span>
            </button>
            {categoryChips
              .filter((chip) => chip.count > 0)
              .map((chip) => {
                const active = categoryFilter === chip.value
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() =>
                      setCategoryFilter((current) => (current === chip.value ? null : chip.value))
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

          {subChips.length > 0 ? (
            <div className="-mx-1 -mt-2 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
              <span className="shrink-0 text-[11px] font-bold text-slate-400">음식 종류</span>
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
                      "shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all",
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    )}
                  >
                    {chip.label} {chip.count}
                  </button>
                )
              })}
            </div>
          ) : null}

          {filteredPlaces.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-400">
              이 카테고리에 저장된 장소가 없어요.
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredPlaces.map((place) => (
                <li key={place.id} className="group flex flex-col gap-2">
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={place.imageUrl}
                      alt=""
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/0 to-black/0" />
                    <button
                      type="button"
                      onClick={() => void handleRemove(place.id)}
                      disabled={removingId === place.id}
                      aria-label={`${place.placeName} 삭제`}
                      className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 disabled:opacity-50"
                    >
                      {removingId === place.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                    </button>
                    {place.rating ? (
                      <span className="absolute top-2 left-2 flex items-center gap-0.5 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                        {place.rating}
                      </span>
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 p-2.5">
                      <p className="truncate text-sm font-bold text-white drop-shadow">
                        {place.placeName}
                      </p>
                      <p className="truncate text-[11px] text-white/85 drop-shadow">
                        {place.subCategory || place.category || "관심 장소"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAssigningError(null)
                      setAssigningPlace(place)
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-full bg-amber-400 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-500 active:scale-95"
                  >
                    <Plane className="size-3.5" />
                    여행에 담기
                  </button>
                </li>
              ))}
            </ul>
          )}
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
