"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Loader2, MapPin, Search, Star, X } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  getErrorMessage,
  insertSavedPlace,
  type SavedPlace,
} from "@/lib/saved-places-api"
import { getCurrentUserId } from "@/lib/auth-session"
import { fetchAccommodationsByTripId } from "@/lib/accommodations-api"
import { distanceMeters } from "@/lib/geo"
import {
  searchGooglePlaces,
  type PlaceSearchResult,
} from "@/lib/places-search"
import {
  wishlistCategories,
  WISHLIST_CATEGORY_VALUE,
  type WishlistKind,
} from "@/lib/trip-itinerary"
import { cn } from "@/lib/utils"

const inputClassName =
  "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition-all focus:border-black focus:outline-none focus:ring-1 focus:ring-black"

/**
 * '가고 싶은 곳 추가' 모달 — Instagram-minimal UI + Google Places 검색.
 */
export function AddSavedPlaceModal({
  tripId,
  trigger,
  defaultKind = "restaurant",
  onSaved,
  open: openProp,
  onOpenChange,
}: {
  tripId: string
  trigger?: ReactNode
  defaultKind?: WishlistKind
  onSaved?: (place: SavedPlace) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  const [kind, setKind] = useState<WishlistKind>(defaultKind)
  const [searchQuery, setSearchQuery] = useState("")
  const [placeName, setPlaceName] = useState("")
  const [localName, setLocalName] = useState("")
  const [subCategory, setSubCategory] = useState("")
  const [guideBadge, setGuideBadge] = useState("")
  const [address, setAddress] = useState("")
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [memo, setMemo] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [rating, setRating] = useState<number | null>(null)
  const [reviewCount, setReviewCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [googleResults, setGoogleResults] = useState<PlaceSearchResult[]>([])
  const [searchingGoogle, setSearchingGoogle] = useState(false)
  const [searchWarning, setSearchWarning] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(true)

  const suggestions = googleResults

  const reset = useCallback(() => {
    setKind(defaultKind)
    setSearchQuery("")
    setPlaceName("")
    setLocalName("")
    setSubCategory("")
    setGuideBadge("")
    setAddress("")
    setLat(null)
    setLng(null)
    setPhoneNumber("")
    setMemo("")
    setImageUrl("")
    setRating(null)
    setReviewCount(null)
    setSaving(false)
    setError(null)
    setGoogleResults([])
    setSearchingGoogle(false)
    setSearchWarning(null)
    setDropdownOpen(true)
  }, [defaultKind])

  useEffect(() => {
    if (!open) return
    reset()
  }, [open, reset])

  useEffect(() => {
    if (!open) return
    const q = searchQuery.trim()
    if (q.length < 1) {
      setGoogleResults([])
      setSearchingGoogle(false)
      setSearchWarning(null)
      return
    }

    let cancelled = false
    setSearchingGoogle(true)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { results, warning } = await searchGooglePlaces(q, kind)
          if (cancelled) return
          setGoogleResults(results)
          setSearchWarning(warning ?? null)
        } catch (err) {
          console.error("[AddSavedPlaceModal] search failed:", err)
          if (!cancelled) {
            setGoogleResults([])
            setSearchWarning("장소 검색에 실패했어요.")
          }
        } finally {
          if (!cancelled) setSearchingGoogle(false)
        }
      })()
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchQuery, kind, open])

  const handleSelectPlace = (place: PlaceSearchResult) => {
    const name = String(place.placeName ?? "").trim()
    setSearchQuery(name)
    setPlaceName(name)
    setLocalName(String(place.localName ?? "").trim() || name)
    setSubCategory(String(place.subCategory ?? "").trim())
    setGuideBadge(String(place.guideBadge ?? "").trim())
    setAddress(String(place.address ?? "").trim())
    setLat(typeof place.lat === "number" ? place.lat : null)
    setLng(typeof place.lng === "number" ? place.lng : null)
    setPhoneNumber(String(place.phoneNumber ?? "").trim())
    setImageUrl(String(place.imageUrl ?? place.image ?? "").trim())
    setRating(typeof place.rating === "number" ? place.rating : null)
    setReviewCount(typeof place.reviewCount === "number" ? place.reviewCount : null)
    if (place.kind === "restaurant" || place.kind === "bar" || place.kind === "stay") {
      setKind(place.kind)
    }
    setDropdownOpen(false)
    setError(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    const name = (placeName || searchQuery).trim()
    if (!name) {
      setError("장소명을 입력해 주세요.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const userId = (await getCurrentUserId()) || undefined

      // Distance to the trip's (first) accommodation — only when both sides have coordinates.
      let distanceKm: number | null = null
      if (typeof lat === "number" && typeof lng === "number") {
        const stays = await fetchAccommodationsByTripId(tripId)
        const stay = stays.find((item) => item.lat != null && item.lng != null)
        if (stay && stay.lat != null && stay.lng != null) {
          const meters = distanceMeters({ lat, lng }, { lat: stay.lat, lng: stay.lng })
          distanceKm = Math.round((meters / 1000) * 10) / 10
        }
      }

      const saved = await insertSavedPlace({
        tripId,
        ...(userId ? { userId } : {}),
        placeName: name,
        category: WISHLIST_CATEGORY_VALUE[kind],
        localName: localName.trim(),
        subCategory: subCategory.trim(),
        guideBadge: guideBadge.trim(),
        priceRange: "",
        address: address.trim(),
        phoneNumber: phoneNumber.trim(),
        memo: memo.trim(),
        imageUrl: imageUrl.trim(),
        rating,
        reviewCount,
        lat,
        lng,
        distanceKm,
      })
      onSaved?.(saved)
      setOpen(false)
      reset()
    } catch (err) {
      console.error("[AddSavedPlaceModal] save failed:", err)
      setError(getErrorMessage(err) || "장소 저장에 실패했어요.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      {trigger ? <DialogTrigger render={trigger as React.ReactElement} /> : null}
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90svh] max-w-lg flex-col gap-0 overflow-hidden rounded-3xl border-zinc-100 bg-white p-0 shadow-2xl sm:max-w-lg"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 px-6 pt-6 pb-4">
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900">
              가고 싶은 곳 추가
            </DialogTitle>
            <p className="mt-0.5 text-xs text-zinc-400">
              멤버들과 공유할 미식·라운지 스폿을 저장해 두세요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="닫기"
            className="rounded-full p-2 text-zinc-400 transition-all hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="size-5" />
          </button>
        </div>

        <form
          id="wishlist-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {/* Category */}
            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                카테고리
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {wishlistCategories.map((item) => {
                  const active = kind === item.kind
                  return (
                    <button
                      key={item.kind}
                      type="button"
                      onClick={() => {
                        setKind(item.kind)
                        setDropdownOpen(true)
                      }}
                      className={cn(
                        "rounded-full px-4 py-2 text-xs font-medium transition-all",
                        active
                          ? "bg-zinc-900 text-white shadow-sm"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      )}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Search */}
            <div>
              <label
                htmlFor="wishlist-search"
                className="mb-2 block text-xs font-semibold tracking-wider text-zinc-400 uppercase"
              >
                장소 검색
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400" />
                <input
                  id="wishlist-search"
                  type="text"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setPlaceName(event.target.value)
                    setDropdownOpen(true)
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="레스토랑, 바 또는 숙소 이름 (예: 파크 하얏트)"
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-3 pr-10 pl-10 text-sm text-zinc-900 placeholder:text-zinc-400 transition-all focus:border-zinc-900 focus:bg-white focus:outline-none"
                  required
                  autoComplete="off"
                />
                {searchingGoogle ? (
                  <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-zinc-400" />
                ) : null}
              </div>

              {searchWarning ? (
                <p className="mt-1.5 text-xs text-zinc-500">{searchWarning}</p>
              ) : null}

              {dropdownOpen && searchingGoogle && suggestions.length === 0 ? (
                <div className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-200 px-3 py-4 text-sm text-zinc-400">
                  <Loader2 className="size-4 animate-spin" />
                  Google에서 장소를 찾는 중…
                </div>
              ) : null}

              {dropdownOpen && suggestions.length > 0 ? (
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                  {suggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectPlace(item)}
                      className="group flex w-full items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/50 p-3.5 text-left transition-all hover:border-zinc-200 hover:bg-zinc-100/80"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 transition-all group-hover:bg-zinc-900 group-hover:text-white">
                          <MapPin className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-zinc-900">
                              {item.placeName}
                            </span>
                            {typeof item.rating === "number" ? (
                              <span className="inline-flex shrink-0 items-center text-xs font-medium text-amber-500">
                                <Star className="mr-0.5 size-3 fill-amber-400 stroke-none" />
                                {item.rating}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-zinc-400">
                            {item.address || item.subCategory || "검색 결과"}
                          </p>
                        </div>
                      </div>
                      <span className="ml-2 shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-zinc-500">
                        {item.guideBadge || (item.source === "google" ? "Google" : "추천")}
                      </span>
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim() && !searchingGoogle ? (
                <p className="mt-1.5 text-xs text-zinc-400">
                  검색 결과가 없어요. 다른 키워드를 입력하거나 아래 항목을 직접 작성해 주세요.
                </p>
              ) : !searchQuery.trim() ? (
                <p className="mt-1.5 text-xs text-zinc-400">
                  Google Places에서 실시간 검색해요. 장소 이름을 입력해 주세요.
                </p>
              ) : null}
            </div>

            <hr className="border-zinc-100" />

            {/* Detail form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="wishlist-local-name"
                    className="mb-1.5 block text-xs font-medium text-zinc-700"
                  >
                    현지 표기
                  </label>
                  <input
                    id="wishlist-local-name"
                    type="text"
                    value={localName}
                    onChange={(event) => setLocalName(event.target.value)}
                    placeholder="예: ハジメ"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="wishlist-sub-category"
                    className="mb-1.5 block text-xs font-medium text-zinc-700"
                  >
                    세부 카테고리
                  </label>
                  <input
                    id="wishlist-sub-category"
                    type="text"
                    value={subCategory}
                    onChange={(event) => setSubCategory(event.target.value)}
                    placeholder="이노베이티브 프렌치·코스"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="wishlist-guide-badge"
                  className="mb-1.5 block text-xs font-medium text-zinc-700"
                >
                  가이드 뱃지
                </label>
                <input
                  id="wishlist-guide-badge"
                  type="text"
                  value={guideBadge}
                  onChange={(event) => setGuideBadge(event.target.value)}
                  placeholder="Michelin 3 Stars"
                  className={inputClassName}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="wishlist-address"
                    className="mb-1.5 block text-xs font-medium text-zinc-700"
                  >
                    주소
                  </label>
                  <input
                    id="wishlist-address"
                    type="text"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="선택 입력"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="wishlist-phone"
                    className="mb-1.5 block text-xs font-medium text-zinc-700"
                  >
                    전화번호
                  </label>
                  <input
                    id="wishlist-phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="선택 입력"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="wishlist-memo"
                  className="mb-1.5 block text-xs font-medium text-zinc-700"
                >
                  메모
                </label>
                <textarea
                  id="wishlist-memo"
                  rows={2}
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  placeholder="예) 예약 필수 · 런치 코스 추천"
                  className={cn(inputClassName, "resize-none")}
                />
              </div>
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600"
              >
                {error}
              </div>
            ) : null}
          </div>

          {/* Sticky CTA */}
          <div className="border-t border-zinc-100 bg-white p-4">
            <button
              type="submit"
              disabled={saving || !(placeName || searchQuery).trim()}
              className="w-full rounded-2xl bg-zinc-900 py-3.5 text-sm font-semibold text-white shadow-lg shadow-zinc-900/10 transition-all hover:bg-zinc-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  저장 중…
                </span>
              ) : (
                "장소 저장하기"
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Alias matching the design brief naming. */
export { AddSavedPlaceModal as AddPlaceModal }
