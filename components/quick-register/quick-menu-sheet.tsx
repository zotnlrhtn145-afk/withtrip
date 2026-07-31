"use client"

import { useEffect } from "react"
import { MapPinPlus, Plane, Receipt, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { clearDocumentScrollLock } from "@/lib/clear-scroll-lock"

export function QuickMenuSheet({
  open,
  onOpenChange,
  onSelectTrip,
  onSelectExpense,
  onSelectPlace,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTrip: () => void
  onSelectExpense: () => void
  onSelectPlace: () => void
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

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 mx-auto w-full max-w-md",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="퀵 메뉴 닫기"
        data-no-press
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ease-out",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => onOpenChange(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="퀵 등록 메뉴"
        className={cn(
          "absolute overflow-hidden border border-border bg-card shadow-2xl transform-gpu transition-all duration-200 ease-out",
          // Mobile: dropdown anchored under the top-left "+", unfurls downward.
          "max-md:top-16 max-md:left-4 max-md:w-[calc(100%-5rem)] max-md:max-w-xs max-md:origin-top-left max-md:rounded-3xl",
          open
            ? "max-md:scale-100 max-md:opacity-100"
            : "max-md:pointer-events-none max-md:scale-95 max-md:opacity-0",
          // Desktop: bottom sheet, centered, slides up.
          "md:inset-x-0 md:bottom-0 md:mx-auto md:w-full md:max-w-md md:origin-bottom md:rounded-t-3xl md:pb-[max(1rem,env(safe-area-inset-bottom))]",
          open ? "md:translate-y-0" : "md:translate-y-full"
        )}
      >
        <div className="flex flex-col gap-4 px-5 pt-3 max-md:pb-4">
          <div className="flex items-center justify-between max-md:hidden">
            <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">퀵 등록</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">무엇을 추가할까요?</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="닫기"
              className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <ul className="flex flex-col gap-2 pb-2">
            <li>
              <button
                type="button"
                onClick={onSelectTrip}
                className="touch-press flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3.5 text-left transition-colors hover:bg-secondary/70"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Plane className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold">새 여행 등록</span>
                  <span className="text-xs text-muted-foreground">
                    제목·위치·일정으로 여행을 바로 추가해요
                  </span>
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={onSelectExpense}
                className="touch-press flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3.5 text-left transition-colors hover:bg-secondary/70"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-foreground">
                  <Receipt className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold">지출/정산 등록</span>
                  <span className="text-xs text-muted-foreground">
                    영수증 스캔 또는 수기 입력으로 기록해요
                  </span>
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={onSelectPlace}
                className="touch-press flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3.5 text-left transition-colors hover:bg-secondary/70"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-foreground">
                  <MapPinPlus className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold">장소 저장</span>
                  <span className="text-xs text-muted-foreground">
                    가고 싶은 스팟을 위시리스트에 남겨요
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
