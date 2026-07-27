"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Image from "next/image"
import { Heart, Loader2, Plus, Search, Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  getErrorMessage,
  insertSavedPlace,
  type SavedPlace,
} from "@/lib/saved-places-api"
import { getCurrentUserId } from "@/lib/auth-session"
import {
  mergePlaceSearchResults,
  searchCuratedPlaces,
  searchGooglePlaces,
  type PlaceSearchResult,
} from "@/lib/places-search"
import {
  wishlistCategories,
  WISHLIST_CATEGORY_VALUE,
  type WishlistKind,
} from "@/lib/trip-itinerary"
import { cn } from "@/lib/utils"

const PRICE_OPTIONS = ["¥", "¥¥", "¥¥¥", "¥¥¥¥"] as const

const FALLBACK_IMAGE: Record<WishlistKind, string> = {
  restaurant: "/images/place-sushi.png",
  bar: "/images/place-bar.png",
  stay: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80",
}

/**
 * '가고 싶은 곳 추가' 모달 — Google Places 실시간 검색 + Auto-fill.
 */
export function AddSavedPlaceModal({
  tripId,
  trigger,
  defaultKind = "restaurant",
  onSaved,
}: {
  tripId: string
  trigger: ReactNode
  defaultKind?: WishlistKind
  onSaved?: (place: SavedPlace) => void
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<WishlistKind>(defaultKind)
  /** Search box query (debounced → Google Places). */
  const [searchQuery, setSearchQuery] = useState("")
  const [placeName, setPlaceName] = useState("")
  const [localName, setLocalName] = useState("")
  const [subCategory, setSubCategory] = useState("")
  const [guideBadge, setGuideBadge] = useState("")
  const [priceRange, setPriceRange] = useState<string>("¥¥¥")
  const [address, setAddress] = useState("")
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

  const curatedResults = useMemo(
    () => searchCuratedPlaces(searchQuery, kind),
    [searchQuery, kind]
  )

  const suggestions = useMemo(
    () => mergePlaceSearchResults(googleResults, curatedResults, 10),
    [curatedResults, googleResults]
  )

  const reset = useCallback(() => {
    setKind(defaultKind)
    setSearchQuery("")
    setPlaceName("")
    setLocalName("")
    setSubCategory("")
    setGuideBadge("")
    setPriceRange("¥¥¥")
    setAddress("")
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

  /** Debounced Google Places Text Search (300ms). */
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
    setPriceRange(String(place.priceRange ?? "").trim() || "¥¥¥")
    setAddress(String(place.address ?? "").trim())
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

      const saved = await insertSavedPlace({
        tripId,
        ...(userId ? { userId } : {}),
        placeName: name,
        category: WISHLIST_CATEGORY_VALUE[kind],
        localName: localName.trim(),
        subCategory: subCategory.trim(),
        guideBadge: guideBadge.trim(),
        priceRange: priceRange.trim(),
        address: address.trim(),
        phoneNumber: phoneNumber.trim(),
        memo: memo.trim(),
        imageUrl: imageUrl.trim(),
        rating,
        reviewCount,
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
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent
        showCloseButton
        className="max-h-[90svh] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-lg"
      >
        <DialogHeader className="gap-2 px-5 pt-5 pr-12 pb-0">
          <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
            <span className="flex size-9 items-center justify-center rounded-full bg-amber-400 text-foreground shadow-sm">
              <Heart className="size-5 fill-current" />
            </span>
            가고 싶은 곳 추가
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            멤버들과 공유할 미식·라운지 스폿을 저장해 두세요.
          </DialogDescription>
        </DialogHeader>

        <form
          id="wishlist-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-5 px-5 py-5"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="wishlist-kind">카테고리</FieldLabel>
              <div id="wishlist-kind" className="flex flex-wrap gap-2">
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
                        "rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
                        active
                          ? "bg-amber-400 text-foreground shadow-sm"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      )}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="wishlist-search">장소 검색</FieldLabel>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="wishlist-search"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setPlaceName(event.target.value)
                    setDropdownOpen(true)
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="레스토랑, 바 또는 숙소 이름 (예: 파크 하얏트)"
                  className="rounded-xl pl-9 pr-10"
                  required
                  autoComplete="off"
                />
                {searchingGoogle ? (
                  <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-amber-500" />
                ) : null}
              </div>

              {searchWarning ? (
                <p className="mt-1.5 text-xs text-amber-700">{searchWarning}</p>
              ) : null}

              {dropdownOpen && searchingGoogle && suggestions.length === 0 ? (
                <div className="mt-1.5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-amber-500" />
                  Google에서 장소를 찾는 중…
                </div>
              ) : null}

              {dropdownOpen && suggestions.length > 0 ? (
                <div className="mt-1.5 flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-xl border border-border/70 bg-card p-1.5 shadow-sm">
                  {suggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectPlace(item)}
                      className="flex items-center gap-3 rounded-xl bg-secondary/50 p-2 text-left transition-colors hover:bg-secondary"
                    >
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={item.imageUrl || item.image || FALLBACK_IMAGE[item.kind ?? kind]}
                          alt={item.imageAlt || item.placeName}
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{item.placeName}</span>
                          {typeof item.rating === "number" ? (
                            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold tabular-nums">
                              <Star className="size-3 fill-amber-400 text-amber-400" />
                              {item.rating}
                            </span>
                          ) : null}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {item.address || item.subCategory || "검색 결과"}
                        </span>
                      </span>
                      <Badge variant="outline" className="shrink-0 bg-card text-[10px]">
                        {item.guideBadge || (item.source === "google" ? "Google" : "추천")}
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim() && !searchingGoogle ? (
                <FieldDescription>
                  검색 결과가 없어요. 다른 키워드를 입력하거나 아래 항목을 직접 작성해 주세요.
                </FieldDescription>
              ) : !searchQuery.trim() ? (
                <FieldDescription>
                  Google Places에서 실시간 검색해요. 예: 정식당, La Cime, Park Hyatt
                </FieldDescription>
              ) : null}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="wishlist-local-name">현지 표기</FieldLabel>
                <Input
                  id="wishlist-local-name"
                  value={localName}
                  onChange={(event) => setLocalName(event.target.value)}
                  placeholder="예: ハジメ"
                  className="rounded-xl"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="wishlist-sub-category">세부 카테고리</FieldLabel>
                <Input
                  id="wishlist-sub-category"
                  value={subCategory}
                  onChange={(event) => setSubCategory(event.target.value)}
                  placeholder="이노베이티브 프렌치 · 코스"
                  className="rounded-xl"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="wishlist-guide-badge">가이드 뱃지</FieldLabel>
                <Input
                  id="wishlist-guide-badge"
                  value={guideBadge}
                  onChange={(event) => setGuideBadge(event.target.value)}
                  placeholder="Michelin 3 Stars"
                  className="rounded-xl"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="wishlist-price">가격대</FieldLabel>
                <div id="wishlist-price" className="flex gap-1.5">
                  {PRICE_OPTIONS.map((option) => {
                    const active = priceRange === option
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPriceRange(option)}
                        className={cn(
                          "flex-1 rounded-full px-2 py-1.5 text-sm font-semibold transition-colors",
                          active
                            ? "bg-amber-400 text-foreground shadow-sm"
                            : "border border-border bg-card text-foreground hover:bg-secondary"
                        )}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="wishlist-address">주소</FieldLabel>
                <Input
                  id="wishlist-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="선택 입력"
                  className="rounded-xl"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="wishlist-phone">전화번호</FieldLabel>
                <Input
                  id="wishlist-phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="선택 입력"
                  className="rounded-xl"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="wishlist-memo">메모</FieldLabel>
              <Textarea
                id="wishlist-memo"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder="예) 예약 필수 · 런치 코스 추천"
                rows={2}
                className="resize-none rounded-xl"
              />
            </Field>
          </FieldGroup>

          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}
        </form>

        <DialogFooter className="mx-0 mb-0 rounded-b-2xl border-t bg-secondary/60 p-4 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={saving}
            className="rounded-full font-semibold text-foreground"
          >
            취소
          </Button>
          <Button
            type="submit"
            form="wishlist-form"
            disabled={saving || !(placeName || searchQuery).trim()}
            className="rounded-full bg-amber-400 font-semibold text-foreground hover:bg-amber-400/90"
          >
            {saving ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            등록하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
