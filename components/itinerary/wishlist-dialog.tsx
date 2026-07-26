"use client"

import { useMemo, useState, type ReactNode } from "react"
import Image from "next/image"
import { Heart, Plus, Search, Star } from "lucide-react"

import { useTrips } from "@/components/trips-store"
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
import type { Trip } from "@/lib/trip-data"
import {
  wishlistCategories,
  wishlistSuggestions,
  type WishlistKind,
} from "@/lib/trip-itinerary"

const FALLBACK_IMAGE: Record<WishlistKind, string> = {
  restaurant: "/images/place-sushi.png",
  bar: "/images/place-bar.png",
}

const FALLBACK_ALT: Record<WishlistKind, string> = {
  restaurant: "정갈하게 담긴 파인 다이닝 코스 요리",
  bar: "따뜻한 조명이 감도는 칵테일 바의 카운터",
}

export function WishlistDialog({ trip, trigger }: { trip: Trip; trigger: ReactNode }) {
  const { addWishlistPlace } = useTrips()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<WishlistKind>("restaurant")
  const [name, setName] = useState("")
  const [nameLocal, setNameLocal] = useState("")
  const [category, setCategory] = useState("")
  const [badge, setBadge] = useState("")
  const [badgeNote, setBadgeNote] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [priceRange, setPriceRange] = useState("¥¥¥")
  const [image, setImage] = useState(FALLBACK_IMAGE.restaurant)
  const [imageAlt, setImageAlt] = useState(FALLBACK_ALT.restaurant)

  const suggestions = useMemo(() => {
    const keyword = String(name ?? "")
      .trim()
      .toLowerCase()
    const pool = wishlistSuggestions.filter((item) => item.kind === kind)
    if (!keyword) return pool.slice(0, 3)
    return pool
      .filter((item) =>
        `${item?.name ?? ""} ${item?.nameLocal ?? ""} ${item?.category ?? ""}`
          .toLowerCase()
          .includes(keyword)
      )
      .slice(0, 3)
  }, [kind, name])

  const reset = () => {
    setKind("restaurant")
    setName("")
    setNameLocal("")
    setCategory("")
    setBadge("")
    setBadgeNote("")
    setAddress("")
    setPhone("")
    setPriceRange("¥¥¥")
    setImage(FALLBACK_IMAGE.restaurant)
    setImageAlt(FALLBACK_ALT.restaurant)
  }

  const handleKindChange = (next: WishlistKind) => {
    setKind(next)
    setImage(FALLBACK_IMAGE[next])
    setImageAlt(FALLBACK_ALT[next])
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    addWishlistPlace(trip.id, {
      kind,
      name: name.trim(),
      nameLocal: nameLocal.trim() || name.trim(),
      badge: badge.trim() || (kind === "restaurant" ? "Michelin Selected" : "Local Favorite"),
      badgeNote: badgeNote.trim() || "멤버 추천",
      address: address.trim(),
      phone: phone.trim(),
      category: category.trim() || (kind === "restaurant" ? "파인 다이닝" : "칵테일 · 라운지"),
      priceRange,
      rating: 0,
      reviews: 0,
      distanceKm: 0,
      walkMinutes: 0,
      image,
      imageAlt,
    })
    setOpen(false)
    reset()
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
      <DialogContent className="max-h-[90svh] gap-5 overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Heart className="size-4" />
            </span>
            가고 싶은 곳 추가
          </DialogTitle>
          <DialogDescription>
            멤버들과 공유할 미식·라운지 스폿을 저장해 두세요.
          </DialogDescription>
        </DialogHeader>

        <form id="wishlist-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="wishlist-kind">카테고리</FieldLabel>
              <div id="wishlist-kind" className="flex gap-2">
                {wishlistCategories.map((item) => (
                  <Button
                    key={item.kind}
                    type="button"
                    variant={kind === item.kind ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleKindChange(item.kind)}
                    className="rounded-full font-semibold"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="wishlist-name">장소 검색</FieldLabel>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="wishlist-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="레스토랑 또는 바 이름"
                  className="pl-9"
                  required
                />
              </div>
              {suggestions.length > 0 ? (
                <div className="flex flex-col gap-1.5 pt-1">
                  {suggestions.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        setName(item.name)
                        setNameLocal(item.nameLocal)
                        setCategory(item.category)
                        setBadge(item.badge)
                        setBadgeNote(item.badgeNote)
                        setAddress(item.address)
                        setPhone(item.phone)
                        setPriceRange(item.priceRange)
                        setImage(item.image)
                        setImageAlt(item.imageAlt)
                      }}
                      className="flex items-center gap-3 rounded-xl bg-secondary/60 p-2 text-left transition-colors hover:bg-secondary"
                    >
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={item.image || "/placeholder.svg"}
                          alt={item.imageAlt}
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{item.name}</span>
                          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold tabular-nums">
                            <Star className="size-3 fill-primary text-primary" />
                            {item.rating}
                          </span>
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {item.category}
                        </span>
                      </span>
                      <Badge variant="outline" className="shrink-0 bg-card text-[10px]">
                        {item.badge}
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : (
                <FieldDescription>추천 결과가 없어요. 직접 입력해 주세요.</FieldDescription>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="wishlist-name-local">현지 표기</FieldLabel>
                <Input
                  id="wishlist-name-local"
                  value={nameLocal}
                  onChange={(event) => setNameLocal(event.target.value)}
                  placeholder="예: ハジメ"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="wishlist-category">세부 카테고리</FieldLabel>
                <Input
                  id="wishlist-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="이노베이티브 프렌치 · 코스"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="wishlist-badge">가이드 뱃지</FieldLabel>
                <Input
                  id="wishlist-badge"
                  value={badge}
                  onChange={(event) => setBadge(event.target.value)}
                  placeholder="Michelin 3 Stars"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="wishlist-price">가격대</FieldLabel>
                <div id="wishlist-price" className="flex gap-1.5">
                  {["¥", "¥¥", "¥¥¥", "¥¥¥¥"].map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={priceRange === option ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPriceRange(option)}
                      className="flex-1 rounded-full font-semibold"
                    >
                      {option}
                    </Button>
                  ))}
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
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="wishlist-phone">전화번호</FieldLabel>
                <Input
                  id="wishlist-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="선택 입력"
                />
              </Field>
            </div>
          </FieldGroup>
        </form>

        <DialogFooter className="rounded-b-2xl">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            className="rounded-full font-semibold"
          >
            취소
          </Button>
          <Button
            type="submit"
            form="wishlist-form"
            disabled={!name.trim()}
            className="rounded-full font-semibold"
          >
            <Plus data-icon="inline-start" />
            등록하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
