"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  openGoogleMapsDirections,
  openKakaoMapDirections,
  openTmapDirections,
  type NavDestination,
} from "@/lib/navigation-links"

export type DirTarget = { name: string; lat?: number | null; lng?: number | null }

/** 알림 등에서 목적지를 받아 티맵/카카오맵/구글로 길찾기를 여는 다이얼로그. */
export function DirectionsPickerDialog({
  target,
  onClose,
}: {
  target: DirTarget | null
  onClose: () => void
}) {
  const dest: NavDestination | null = target
    ? { name: target.name, lat: target.lat, lng: target.lng }
    : null
  const go = (fn: (d: NavDestination) => void) => {
    if (dest) fn(dest)
    onClose()
  }
  const rowClass =
    "flex w-full items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left text-sm font-semibold text-slate-800 transition-colors hover:bg-amber-50"
  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="w-full max-w-xs rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
        <DialogHeader className="mb-1 text-left">
          <DialogTitle className="text-base font-bold text-slate-900">길찾기</DialogTitle>
        </DialogHeader>
        <p className="mb-3 truncate text-xs text-slate-400">{target?.name}</p>
        <div className="flex flex-col gap-1.5">
          <button type="button" onClick={() => go(openTmapDirections)} className={rowClass}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/tmap.svg" alt="" width={22} height={22} className="size-[22px] shrink-0 rounded-[6px]" />
            티맵
          </button>
          <button type="button" onClick={() => go(openKakaoMapDirections)} className={rowClass}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/kakao.svg" alt="" width={22} height={22} className="size-[22px] shrink-0 rounded-[6px]" />
            카카오맵
          </button>
          <button type="button" onClick={() => go(openGoogleMapsDirections)} className={rowClass}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/google.svg" alt="" width={22} height={22} className="size-[22px] shrink-0" />
            구글
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
