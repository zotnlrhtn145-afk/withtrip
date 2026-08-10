"use client"

import { useState } from "react"
import { Car, MapPin, Navigation, Send, type LucideIcon } from "lucide-react"

import { ShareLocationDialog } from "@/components/share-location-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { type ShareLocation } from "@/lib/location-share-api"
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
  icon,
}: {
  destination: NavDestination | null
  fallbackQuery?: string
  variant?: "pill" | "icon" | "cta"
  className?: string
  label?: string
  icon?: LucideIcon
}) {
  const [open, setOpen] = useState(false)
  const [share, setShare] = useState<ShareLocation | null>(null)
  const baseClass = VARIANT_CLASS[variant]
  const TriggerIcon = icon ?? (variant === "cta" ? MapPin : Navigation)

  // 좌표가 없어도 업장 이름(fallbackQuery)만 있으면 검색 기반 길찾기 피커를 연다.
  const effectiveDest: NavDestination | null = destination
    ? destination
    : fallbackQuery
      ? { name: fallbackQuery }
      : null

  if (!effectiveDest) return null

  const overseas = !isInKorea(effectiveDest.lat, effectiveDest.lng)
  const uberUrl = overseas ? buildUberUrl(effectiveDest) : null

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={(event) => event.stopPropagation()}
        aria-label={`${effectiveDest.name} ${label}`}
        className={cn(baseClass, className)}
      >
        <TriggerIcon className={variant === "pill" ? "size-3.5" : "size-4"} />
        {variant !== "icon" ? label : null}
      </PopoverTrigger>
      <PopoverContent
        align={variant === "cta" ? "center" : "end"}
        className="w-60 p-1.5"
        positionerClassName="z-[100]"
        onClick={(event) => event.stopPropagation()}
      >
        {overseas ? (
          <>
            {uberUrl ? (
              <button
                type="button"
                onClick={() => {
                  openUberDirections(effectiveDest)
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
                openGoogleMapsDirections(effectiveDest)
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
                openTmapDirections(effectiveDest)
                setOpen(false)
              }}
              className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm font-semibold text-slate-800 transition-colors hover:bg-amber-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/tmap.svg" alt="" width={22} height={22} className="size-[22px] shrink-0 rounded-[6px]" />
              티맵
            </button>
            <button
              type="button"
              onClick={() => {
                openKakaoMapDirections(effectiveDest)
                setOpen(false)
              }}
              className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm font-semibold text-slate-800 transition-colors hover:bg-amber-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/kakao.svg" alt="" width={22} height={22} className="size-[22px] shrink-0 rounded-[6px]" />
              카카오맵
            </button>
            <button
              type="button"
              onClick={() => {
                openGoogleMapsDirections(effectiveDest)
                setOpen(false)
              }}
              className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm font-semibold text-slate-800 transition-colors hover:bg-amber-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/google.svg" alt="" width={22} height={22} className="size-[22px] shrink-0" />
              구글
            </button>
          </>
        )}
        <div className="my-1 h-px bg-slate-100" />
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setShare({ name: effectiveDest.name, lat: effectiveDest.lat, lng: effectiveDest.lng })
          }}
          className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50"
        >
          <Send className="size-4 shrink-0 text-amber-600" />
          위치 공유하기
        </button>
      </PopoverContent>
    </Popover>
    <ShareLocationDialog target={share} onClose={() => setShare(null)} />
    </>
  )
}
