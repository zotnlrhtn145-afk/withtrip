"use client"

import { useCallback, useState } from "react"
import Image from "next/image"
import { Check, Loader2, MapPin, Sparkles, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { fetchAccommodationsByTripId } from "@/lib/accommodations-api"
import { suggestAttractions, type SuggestedAttraction } from "@/lib/attraction-suggestions"
import { insertSavedPlace, type SavedPlace } from "@/lib/saved-places-api"
import { WISHLIST_CATEGORY_VALUE } from "@/lib/trip-itinerary"
import { cn } from "@/lib/utils"

/**
 * 가고 싶은 곳 > 제안하는 관광지 — Gemini로 여행지의 유명 관광명소를 추천받고,
 * 숙소와 가까운 순으로 정렬해 보여준다. 마음에 드는 곳만 "담기"로 위시리스트에 추가.
 */
export function AttractionSuggestions({
  tripId,
  city,
  country,
  existingPlaces,
  onSaved,
}: {
  tripId: string
  city: string
  country?: string
  existingPlaces: SavedPlace[]
  onSaved: () => void
}) {
  const [suggestions, setSuggestions] = useState<SuggestedAttraction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKeys, setSavedKeys] = useState<Set<string>>(() => new Set())

  const handleSuggest = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const stays = await fetchAccommodationsByTripId(tripId)
      const stay = stays.find((s) => s.lat != null && s.lng != null)
      const accommodation =
        stay && stay.lat != null && stay.lng != null ? { lat: stay.lat, lng: stay.lng } : null

      const existingNames = existingPlaces
        .map((place) => place.placeName)
        .filter((name): name is string => Boolean(name))

      const { results, error: apiError } = await suggestAttractions({
        city,
        country,
        existingNames,
        accommodation,
      })

      setSuggestions(results)
      setHasSearched(true)
      if (results.length === 0) {
        setError(apiError || "추천할 만한 새로운 관광지를 찾지 못했어요.")
      }
    } catch (err) {
      console.error("[AttractionSuggestions] suggest failed:", err)
      setError("추천을 불러오는 중 문제가 생겼어요.")
    } finally {
      setLoading(false)
    }
  }, [tripId, city, country, existingPlaces])

  const handleSave = useCallback(
    async (item: SuggestedAttraction) => {
      const key = `${item.lat},${item.lng}`
      setSavingKey(key)
      try {
        await insertSavedPlace({
          tripId,
          placeName: item.name,
          category: WISHLIST_CATEGORY_VALUE.attraction,
          localName: item.localName,
          memo: item.reason,
          address: item.address,
          imageUrl: item.imageUrl,
          rating: item.rating ?? null,
          reviewCount: item.reviewCount ?? null,
          distanceKm: item.distanceKm ?? null,
          lat: item.lat,
          lng: item.lng,
        })
        setSavedKeys((prev) => new Set(prev).add(key))
        onSaved()
      } catch (err) {
        console.error("[AttractionSuggestions] save failed:", err)
        setError("장소를 저장하지 못했어요.")
      } finally {
        setSavingKey(null)
      }
    },
    [tripId, onSaved]
  )

  return (
    <div className="rounded-2xl border border-dashed border-amber-300/70 bg-gradient-to-br from-amber-50/60 to-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-slate-950">
            <Sparkles className="size-3.5" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">제안하는 관광지</p>
            <p className="text-xs text-slate-500">
              AI가 여행지의 유명 명소를 찾아 숙소와 가까운 순으로 보여줘요
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void handleSuggest()}
          disabled={loading}
          className="shrink-0 rounded-full bg-amber-400 px-4 text-xs font-bold text-slate-950 shadow-sm shadow-amber-400/20 hover:bg-amber-500"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {hasSearched ? "다시 추천받기" : "AI 추천받기"}
        </Button>
      </div>

      {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}

      {suggestions.length > 0 ? (
        <ul className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {suggestions.map((item) => {
            const key = `${item.lat},${item.lng}`
            const saved = savedKeys.has(key)
            const saving = savingKey === key
            return (
              <li
                key={key}
                className="flex w-56 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm"
              >
                <div className="relative h-28 w-full shrink-0 overflow-hidden bg-slate-100">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="224px"
                      className="object-cover"
                    />
                  ) : null}
                  {typeof item.distanceKm === "number" ? (
                    <span className="absolute right-2 bottom-2 rounded-full bg-foreground/70 px-2 py-0.5 text-[10px] font-semibold text-background backdrop-blur-sm">
                      숙소에서 {item.distanceKm}km
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
                  {item.rating ? (
                    <span className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-slate-500 tabular-nums">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      {item.rating.toFixed(1)}
                      {item.reviewCount ? ` · 리뷰 ${item.reviewCount.toLocaleString()}` : ""}
                    </span>
                  ) : null}
                  {item.reason ? (
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{item.reason}</p>
                  ) : null}
                  {item.address ? (
                    <p className="flex items-start gap-1 text-[11px] text-slate-400">
                      <MapPin className="mt-0.5 size-3 shrink-0" />
                      <span className="line-clamp-1">{item.address}</span>
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={saved || saving}
                    onClick={() => void handleSave(item)}
                    className={cn(
                      "mt-auto flex items-center justify-center gap-1 rounded-full py-1.5 text-xs font-bold transition-all active:scale-95",
                      saved
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-400 text-slate-950 hover:bg-amber-500"
                    )}
                  >
                    {saving ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : saved ? (
                      <Check className="size-3" />
                    ) : null}
                    {saved ? "담았어요" : "담기"}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
