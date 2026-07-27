"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Heart, Loader2, Martini, Plus, BedDouble, Utensils } from "lucide-react"

import { AddSavedPlaceModal } from "@/components/itinerary/AddSavedPlaceModal"
import { SavedPlaceCard } from "@/components/itinerary/SavedPlaceCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
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
  guide,
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
        "touch-press flex flex-1 items-center gap-3 rounded-2xl p-3.5 text-left transition-colors ring-1",
        active
          ? "bg-amber-50 ring-amber-300 shadow-sm"
          : "bg-secondary/60 ring-border hover:bg-secondary/80"
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          active ? "bg-amber-400 text-foreground" : "bg-primary text-primary-foreground"
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-sm font-bold">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{guide}</p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "ml-auto shrink-0 font-semibold tabular-nums",
          active ? "border-amber-300 bg-white" : "bg-card"
        )}
      >
        {count}곳
      </Badge>
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
    return { restaurant, bar, stay } as Record<WishlistKind, number>
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
        <Button variant="outline" size="sm" className="rounded-full font-semibold">
          <Plus data-icon="inline-start" />
          장소 추가
        </Button>
      }
    />
  )

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <Heart className="size-3.5" />
          Wishlist
        </CardDescription>
        <CardTitle className="text-lg font-bold">가고 싶은 곳</CardTitle>
        <CardDescription className="text-pretty">
          멤버들이 저장한 레스토랑, 라운지 & 바, 숙소
        </CardDescription>
        <CardAction>{addButton}</CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div role="tablist" aria-label="위시리스트 카테고리" className="flex flex-col gap-2.5 sm:flex-row">
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
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14">
            <Loader2 className="size-6 animate-spin text-amber-500" />
            <p className="text-sm text-muted-foreground">저장된 장소를 불러오는 중…</p>
          </div>
        ) : visiblePlaces.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2">
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
          <Empty className="border border-dashed border-border bg-secondary/40 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12 rounded-2xl bg-primary/15">
                <Heart className="size-6 text-foreground" />
              </EmptyMedia>
              <EmptyTitle className="text-base font-bold">아직 저장된 장소가 없어요.</EmptyTitle>
              <EmptyDescription className="text-xs">
                레스토랑, 라운지, 숙소를 저장하면 멤버 모두가 함께 볼 수 있어요.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <AddSavedPlaceModal
                tripId={trip.id}
                defaultKind={selectedKind}
                onSaved={() => void load()}
                trigger={
                  <Button size="lg" className="w-full rounded-full font-semibold">
                    <Plus data-icon="inline-start" />
                    장소 추가
                  </Button>
                }
              />
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
