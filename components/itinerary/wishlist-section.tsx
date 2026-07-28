"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Heart, Loader2, Martini, Plus, BedDouble, Utensils } from "lucide-react"

import { AddSavedPlaceModal } from "@/components/itinerary/AddSavedPlaceModal"
import { SavedPlaceCard } from "@/components/itinerary/SavedPlaceCard"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  deleteSavedPlace,
  fetchSavedPlacesByTripId,
  type SavedPlace,
} from "@/lib/saved-places-api"
import type { Trip } from "@/lib/trip-data"
import {
  toWishlistKind,
  wishlistCategories,
  type WishlistKind,
} from "@/lib/trip-itinerary"
import { cn } from "@/lib/utils"

const KIND_ICON: Record<WishlistKind, typeof Utensils> = {
  restaurant: Utensils,
  bar: Martini,
  stay: BedDouble,
}

function CategorySummary({
  kind,
  label,
  count,
  active,
  onSelect,
}: {
  kind: WishlistKind
  label: string
  guide: string
  count: number
  active: boolean
  onSelect: (kind: WishlistKind) => void
}) {
  const Icon = KIND_ICON[kind]

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(kind)}
      className={cn(
        "flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-all",
        active
          ? "border-amber-400 bg-amber-50 text-slate-900 shadow-sm"
          : "border-slate-200/80 bg-slate-50 text-slate-700 hover:border-amber-400"
      )}
    >
      <Icon className={cn("size-3.5", active ? "text-amber-500" : "text-slate-500")} />
      <span>{label}</span>
      <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] text-slate-600 tabular-nums">
        {count}
      </span>
    </button>
  )
}

/**
 * Supabase `saved_places` 연동 가고 싶은 곳(Wishlist) 섹션.
 */
export function WishlistSection({ trip }: { trip: Trip }) {
  const [places, setPlaces] = useState<SavedPlace[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKind, setSelectedKind] = useState<WishlistKind>("restaurant")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchSavedPlacesByTripId(trip.id)
      setPlaces(rows)
    } catch (err) {
      console.error("[WishlistSection] load failed:", err)
      setPlaces([])
    } finally {
      setLoading(false)
    }
  }, [trip.id])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => {
    const restaurant = places.filter((place) => toWishlistKind(place.category) === "restaurant").length
    const bar = places.filter((place) => toWishlistKind(place.category) === "bar").length
    const stay = places.filter((place) => toWishlistKind(place.category) === "stay").length
    return { restaurant, bar, stay }
  }, [places])

  const visiblePlaces = useMemo(
    () => places.filter((place) => toWishlistKind(place.category) === selectedKind),
    [places, selectedKind]
  )

  const handleDelete = async (id: string) => {
    if (!window.confirm("이 장소를 삭제할까요?")) return
    setDeletingId(id)
    try {
      const ok = await deleteSavedPlace(id)
      if (ok) setPlaces((current) => current.filter((place) => place.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const addButton = (
    <AddSavedPlaceModal
      tripId={trip.id}
      defaultKind={selectedKind}
      onSaved={() => void load()}
      trigger={
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Plus data-icon="inline-start" />
          장소 추가
        </Button>
      }
    />
  )

  return (
    <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm ring-0 transition-all hover:shadow-md">
      <CardHeader>
        <CardDescription className="mb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          Wishlist
        </CardDescription>
        <CardTitle className="text-lg font-bold tracking-tight text-slate-900">
          가고 싶은 곳
        </CardTitle>
        <CardDescription className="text-pretty text-slate-500">
          멤버들이 저장한 레스토랑, 라운지 & 바, 숙소
        </CardDescription>
        <CardAction>{addButton}</CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div
          role="tablist"
          aria-label="위시리스트 카테고리"
          className="flex flex-wrap gap-2"
        >
          {wishlistCategories.map((item) => (
            <CategorySummary
              key={item.kind}
              kind={item.kind}
              label={item.label}
              guide={item.guide}
              count={counts[item.kind]}
              active={selectedKind === item.kind}
              onSelect={setSelectedKind}
            />
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
            <Loader2 className="size-6 animate-spin text-amber-500" />
            <p className="text-sm text-slate-500">저장된 장소를 불러오는 중…</p>
          </div>
        ) : visiblePlaces.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-1 xl:grid-cols-2">
            {visiblePlaces.map((place) => (
              <SavedPlaceCard
                key={place.id}
                place={place}
                deleting={deletingId === place.id}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
              <Heart className="size-5" />
            </span>
            <p className="text-sm font-bold text-slate-900">아직 저장된 장소가 없어요</p>
            <p className="mt-1 mb-5 max-w-xs text-xs leading-relaxed text-slate-500">
              레스토랑, 라운지, 숙소를 저장하면 멤버 모두가 함께 볼 수 있어요.
            </p>
            <AddSavedPlaceModal
              tripId={trip.id}
              defaultKind={selectedKind}
              onSaved={() => void load()}
              trigger={
                <button
                  type="button"
                  className="rounded-full bg-amber-400 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-sm shadow-amber-400/20 transition-all hover:bg-amber-500 active:scale-95"
                >
                  장소 추가
                </button>
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
