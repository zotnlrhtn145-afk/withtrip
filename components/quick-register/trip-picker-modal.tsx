"use client"

import { useEffect } from "react"
import { Plane, X } from "lucide-react"

import { clearDocumentScrollLock } from "@/lib/clear-scroll-lock"

export type QuickTripOption = { id: string; title: string }

/** 여러 여행 클립이 있을 때 지출/장소 추가 대상 여행을 고르는 모달. */
export function TripPickerModal({
  open,
  onOpenChange,
  trips,
  title,
  description,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trips: QuickTripOption[]
  title: string
  description: string
  onSelect: (trip: QuickTripOption) => void
}) {
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
        aria-labelledby="trip-picker-title"
        className="relative z-10 flex max-h-[80svh] w-full flex-col rounded-t-3xl border border-border bg-card shadow-2xl transform-gpu animate-in fade-in zoom-in-95 duration-200 ease-out sm:mx-4 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id="trip-picker-title" className="text-base font-bold">
              {title}
            </h2>
            <p className="text-xs text-muted-foreground">{description}</p>
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

        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
          {trips.map((trip) => (
            <li key={trip.id}>
              <button
                type="button"
                onClick={() => onSelect(trip)}
                className="touch-press flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3.5 text-left transition-colors hover:bg-secondary/70"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground">
                  <Plane className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {trip.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
