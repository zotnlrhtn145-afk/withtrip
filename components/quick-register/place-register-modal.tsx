"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, MapPin, MapPinPlus, Search, Star, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { clearDocumentScrollLock } from "@/lib/clear-scroll-lock"
import { getCurrentUserId } from "@/lib/auth-session"
import { fetchAccommodationsByTripId } from "@/lib/accommodations-api"
import { distanceMeters } from "@/lib/geo"
import { searchGooglePlaces, type PlaceSearchResult } from "@/lib/places-search"
import { getErrorMessage, insertSavedPlace, type SavedPlace } from "@/lib/saved-places-api"
import { cn } from "@/lib/utils"

const PLACE_CATEGORIES = ["맛집", "카페", "바", "관광", "쇼핑", "기타"] as const

export type PlaceDraft = {
  name: string
  category: string
  address: string
  note: string
}

export type QuickTripOption = { id: string; title: string }

export function PlaceRegisterModal({
  open,
  onOpenChange,
  tripId = null,
  trips = [],
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tripId?: string | null
  trips?: QuickTripOption[]
  onSaved?: (place: SavedPlace) => void
}) {
  const [activeTripId, setActiveTripId] = useState<string>(tripId ?? "")
  const [searchQuery, setSearchQuery] = useState("")
  const [name, setName] = useState("")
  const [category, setCategory] = useState<string>("맛집")
  const [address, setAddress] = useState("")
  const [note, setNote] = useState("")
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [imageUrl, setImageUrl] = useState("")
  const [rating, setRating] = useState<number | null>(null)
  const [reviewCount, setReviewCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [googleResults, setGoogleResults] = useState<PlaceSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchWarning, setSearchWarning] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(true)

  useEffect(() => {
    if (!open) return
    setActiveTripId(tripId ?? "")
    setSearchQuery("")
    setName("")
    setCategory("맛집")
    setAddress("")
    setNote("")
    setLat(null)
    setLng(null)
    setImageUrl("")
    setRating(null)
    setReviewCount(null)
    setSaving(false)
    setError(null)
    setGoogleResults([])
    setSearching(false)
    setSearchWarning(null)
    setDropdownOpen(true)
  }, [open, tripId])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      clearDocumentScrollLock()
    }
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) return
    const q = searchQuery.trim()
    if (q.length < 1) {
      setGoogleResults([])
      setSearching(false)
      setSearchWarning(null)
      return
    }

    let cancelled = false
    setSearching(true)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { results, warning } = await searchGooglePlaces(q, null)
          if (cancelled) return
          setGoogleResults(results)
          setSearchWarning(warning ?? null)
        } catch (err) {
          console.error("[PlaceRegisterModal] search failed:", err)
          if (!cancelled) {
            setGoogleResults([])
            setSearchWarning("장소 검색에 실패했어요.")
          }
        } finally {
          if (!cancelled) setSearching(false)
        }
      })()
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchQuery, open])

  const handleSelectPlace = (place: PlaceSearchResult) => {
    const placeName = String(place.placeName ?? "").trim()
    setSearchQuery(placeName)
    setName(placeName)
    setAddress(String(place.address ?? "").trim())
    setLat(typeof place.lat === "number" ? place.lat : null)
    setLng(typeof place.lng === "number" ? place.lng : null)
    setImageUrl(String(place.imageUrl ?? place.image ?? "").trim())
    setRating(typeof place.rating === "number" ? place.rating : null)
    setReviewCount(typeof place.reviewCount === "number" ? place.reviewCount : null)
    setDropdownOpen(false)
    setError(null)
  }

  const canSubmit = name.trim().length > 0 && Boolean(activeTripId) && !saving

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault()
      const placeName = name.trim()
      if (!placeName) {
        setError("장소 이름을 입력해 주세요.")
        return
      }
      if (!activeTripId) {
        setError("여행을 선택해 주세요.")
        return
      }

      setSaving(true)
      setError(null)
      try {
        const userId = (await getCurrentUserId()) || undefined

        let distanceKm: number | null = null
        if (typeof lat === "number" && typeof lng === "number") {
          const stays = await fetchAccommodationsByTripId(activeTripId)
          const stay = stays.find((item) => item.lat != null && item.lng != null)
          if (stay && stay.lat != null && stay.lng != null) {
            const meters = distanceMeters({ lat, lng }, { lat: stay.lat, lng: stay.lng })
            distanceKm = Math.round((meters / 1000) * 10) / 10
          }
        }

        const saved = await insertSavedPlace({
          tripId: activeTripId,
          ...(userId ? { userId } : {}),
          placeName,
          category,
          address: address.trim(),
          memo: note.trim(),
          imageUrl: imageUrl.trim(),
          rating,
          reviewCount,
          lat,
          lng,
          distanceKm,
        })

        onSaved?.(saved)
        onOpenChange(false)
      } catch (err) {
        console.error("[PlaceRegisterModal] save failed:", err)
        setError(getErrorMessage(err) || "장소 저장에 실패했어요.")
      } finally {
        setSaving(false)
      }
    },
    [name, activeTripId, lat, lng, category, address, note, imageUrl, rating, reviewCount, onSaved, onOpenChange]
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex w-full max-w-md items-end sm:items-center">
      <button
        type="button"
        aria-label="모달 닫기"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ease-out animate-in fade-in-0"
        data-no-press
        onClick={() => onOpenChange(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-modal-title"
        className="relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-border bg-card shadow-2xl transform-gpu animate-in fade-in zoom-in-95 duration-200 ease-out sm:mx-4 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <MapPinPlus className="size-4.5" />
            </span>
            <div>
              <h2 id="place-modal-title" className="text-base font-bold">
                장소 저장
              </h2>
              <p className="text-xs text-muted-foreground">위시리스트에 스팟을 추가해요</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="닫기"
            className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <FieldGroup className="gap-4">
              {!tripId ? (
                <Field>
                  <FieldLabel>여행</FieldLabel>
                  <Select
                    items={trips.map((t) => ({ value: t.id, label: t.title }))}
                    value={activeTripId}
                    onValueChange={(value) => setActiveTripId(value as string)}
                  >
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue placeholder="여행을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {trips.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {trips.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      먼저 여행을 등록해야 장소를 저장할 수 있어요.
                    </p>
                  ) : null}
                </Field>
              ) : null}

              <Field>
                <FieldLabel htmlFor="place-search">장소 검색</FieldLabel>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="place-search"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value)
                      setName(event.target.value)
                      setDropdownOpen(true)
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    placeholder="예: 후시미이나리 신사"
                    className="rounded-xl pl-9"
                    autoComplete="off"
                    required
                  />
                  {searching ? (
                    <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  ) : null}
                </div>

                {searchWarning ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">{searchWarning}</p>
                ) : null}

                {dropdownOpen && googleResults.length > 0 ? (
                  <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                    {googleResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectPlace(item)}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-secondary/40 p-2.5 text-left transition-colors hover:bg-secondary/70"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                          <MapPin className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">{item.placeName}</span>
                            {typeof item.rating === "number" ? (
                              <span className="inline-flex shrink-0 items-center text-xs font-medium text-amber-500">
                                <Star className="mr-0.5 size-3 fill-amber-400 stroke-none" />
                                {item.rating}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {item.address || "검색 결과"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </Field>

              <Field>
                <FieldLabel>카테고리</FieldLabel>
                <Select
                  items={PLACE_CATEGORIES.map((item) => ({ value: item, label: item }))}
                  value={category}
                  onValueChange={(value) => setCategory(value as string)}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACE_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="place-address">주소 / 위치</FieldLabel>
                <Input
                  id="place-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="예: Kyoto, Fushimi"
                  className="rounded-xl"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="place-note">메모</FieldLabel>
                <Textarea
                  id="place-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="가고 싶은 이유나 팁을 적어 주세요"
                  className="min-h-24 rounded-xl"
                />
              </Field>
            </FieldGroup>

            {error ? (
              <p className={cn("mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive")}>
                {error}
              </p>
            ) : null}
          </div>

          <div className="border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="submit" disabled={!canSubmit} className="w-full rounded-full font-semibold">
              {saving ? (
                <>
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                  저장 중…
                </>
              ) : (
                "장소 저장하기"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
