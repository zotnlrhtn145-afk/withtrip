"use client"

import { useState } from "react"
import { Car, MapPin, Navigation } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  buildUberUrl,
  isInKorea,
  openGoogleMapsDirections,
  openKakaoMapDirections,
  openTmapDirections,
  openUberDirections,
  type NavDestination,
} from "@/lib/navigation-links"
import { cn } from "@/lib/utils"

const PILL_CLASS =
  "inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-[0.8rem] font-semibold text-slate-700 transition-colors hover:border-amber-400 hover:bg-amber-50"

const ICON_CLASS =
  "flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-amber-600 transition-all hover:border-amber-300 hover:bg-amber-50 active:scale-95"

const CTA_CLASS =
  "flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-400 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-500 active:scale-[0.99]"

const VARIANT_CLASS = { pill: PILL_CLASS, icon: ICON_CLASS, cta: CTA_CLASS }

/** 길찾기 버튼 — 좌표가 있으면 티맵/카카오맵 선택 팝오버, 없으면 구글 지도 주소 검색으로 대체. */
export function DirectionsMenu({
  destination,
  fallbackQuery,
  variant = "pill",
  className,
  label = "길찾기",
}: {
  destination: NavDestination | null
  fallbackQuery?: string
  variant?: "pill" | "icon" | "cta"
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const baseClass = VARIANT_CLASS[variant]
  const triggerIcon = variant === "cta" ? MapPin : Navigation
  const TriggerIcon = triggerIcon
  const overseas = destination ? !isInKorea(destination.lat, destination.lng) : false
  const uberUrl = destination && overseas ? buildUberUrl(destination) : null

  if (!destination) {
    if (!fallbackQuery) return null
    const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      fallbackQuery
    )}`
    return (
      <a
        href={mapHref}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        aria-label={`${fallbackQuery} ${label}`}
        className={cn(baseClass, className)}
      >
        <TriggerIcon className={variant === "pill" ? "size-3.5" : "size-4"} />
        {variant !== "icon" ? label : null}
      </a>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={(event) => event.stopPropagation()}
        aria-label={`${destination.name} ${label}`}
        className={cn(baseClass, className)}
      >
        <TriggerIcon className={variant === "pill" ? "size-3.5" : "size-4"} />
        {variant !== "icon" ? label : null}
      </PopoverTrigger>
      <PopoverContent
        align={variant === "cta" ? "center" : "end"}
        className="w-48 p-1.5"
        onClick={(event) => event.stopPropagation()}
      >
        {overseas ? (
          <>
            {uberUrl ? (
              <button
                type="button"
                onClick={() => {
                  openUberDirections(destination)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-amber-50"
              >
                <Car className="size-3.5 text-amber-500" />
                우버로 택시 부르기
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                openGoogleMapsDirections(destination)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-amber-50"
            >
              <MapPin className="size-3.5 text-amber-500" />
              구글 지도로 길찾기
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                openTmapDirections(destination)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-amber-50"
            >
              <Navigation className="size-3.5 text-amber-500" />
              티맵으로 길찾기
            </button>
            <button
              type="button"
              onClick={() => {
                openKakaoMapDirections(destination)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-amber-50"
            >
              <MapPin className="size-3.5 text-amber-500" />
              카카오맵으로 길찾기
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
