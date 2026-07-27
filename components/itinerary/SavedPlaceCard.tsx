"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Loader2, MapPin, Navigation, Phone, Star, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { resolveCoverImageUrl } from "@/lib/place-cover-image"
import type { SavedPlace } from "@/lib/saved-places-api"
import { toWishlistKind, WISHLIST_CATEGORY_VALUE } from "@/lib/trip-itinerary"
import { cn } from "@/lib/utils"

export function SavedPlaceCard({
  place,
  deleting,
  onDelete,
}: {
  place: SavedPlace
  deleting: boolean
  onDelete: (id: string) => void
}) {
  const kind = toWishlistKind(place.category)
  const categoryLabel = WISHLIST_CATEGORY_VALUE[kind]
  const coverSrc = resolveCoverImageUrl({
    imageUrl: place.imageUrl,
    category: place.category,
    subCategory: place.subCategory,
    kind,
  })
  const [imgSrc, setImgSrc] = useState(coverSrc)

  useEffect(() => {
    setImgSrc(coverSrc)
  }, [coverSrc])
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    place.address || place.placeName
  )}`

  return (
    <li className="group media-card flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="relative h-44 w-full shrink-0 overflow-hidden sm:h-[11.5rem]">
        <Image
          src={imgSrc}
          alt={place.placeName}
          fill
          sizes="(min-width: 768px) 40vw, 90vw"
          className="media-card-image rounded-t-2xl object-cover"
          onError={() =>
            setImgSrc(
              resolveCoverImageUrl({
                imageUrl: "",
                category: place.category,
                subCategory: place.subCategory,
                kind,
              })
            )
          }
        />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {place.guideBadge ? (
            <Badge className="max-w-[70%] border-transparent bg-amber-400 text-foreground shadow-sm">
              <span className="truncate font-bold">{place.guideBadge}</span>
            </Badge>
          ) : (
            <Badge className="border-transparent bg-amber-400/90 text-foreground shadow-sm">
              <span className="font-bold">{categoryLabel}</span>
            </Badge>
          )}
          {place.distanceKm != null && place.distanceKm > 0 ? (
            <Badge className="shrink-0 border-transparent bg-foreground/65 text-background backdrop-blur-sm">
              <span className="tabular-nums">호텔에서 {place.distanceKm}km</span>
            </Badge>
          ) : place.priceRange ? (
            <Badge className="shrink-0 border-transparent bg-foreground/55 font-mono text-background backdrop-blur-sm">
              {place.priceRange}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-foreground">{place.placeName}</h3>
                {place.localName ? (
                  <p className="truncate text-xs text-muted-foreground">{place.localName}</p>
                ) : null}
              </div>
              {place.rating != null && place.rating > 0 ? (
                <div className="flex shrink-0 flex-col items-end">
                  <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    {place.rating.toFixed(1)}
                  </span>
                  {place.reviewCount != null && place.reviewCount > 0 ? (
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      리뷰 {place.reviewCount.toLocaleString()}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="secondary"
                className={cn(
                  "text-[11px] font-semibold",
                  kind === "restaurant"
                    ? "bg-orange-100 text-orange-800"
                    : kind === "stay"
                      ? "bg-sky-100 text-sky-800"
                      : "bg-indigo-100 text-indigo-800"
                )}
              >
                {categoryLabel}
              </Badge>
              {place.subCategory ? (
                <Badge variant="outline" className="text-[10px] font-medium">
                  {place.subCategory}
                </Badge>
              ) : null}
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="장소 삭제"
            disabled={deleting}
            onClick={() => onDelete(place.id)}
            className="shrink-0 text-gray-400 hover:text-destructive"
          >
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        </div>

        <div className="flex flex-col gap-1.5 text-xs leading-relaxed text-gray-500">
          {place.address ? (
            <p className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span className="text-pretty">{place.address}</span>
            </p>
          ) : null}
          {place.phoneNumber ? (
            <p className="flex items-center gap-1.5 tabular-nums">
              <Phone className="size-3.5 shrink-0" />
              <span>{place.phoneNumber}</span>
            </p>
          ) : null}
          {place.memo ? <p className="text-pretty text-gray-500">{place.memo}</p> : null}
        </div>

        <div className="mt-auto flex justify-end pt-1">
          <a
            href={mapHref}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50",
              "touch-press px-2.5 text-[0.8rem] font-semibold text-foreground transition-colors hover:bg-amber-100"
            )}
          >
            <Navigation className="size-3.5" />
            길찾기
          </a>
        </div>
      </div>
    </li>
  )
}
