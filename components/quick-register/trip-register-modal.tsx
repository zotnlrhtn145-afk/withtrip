"use client"

import { useEffect, useState } from "react"
import { Loader2, Plane, X } from "lucide-react"

import { useTrips } from "@/components/trips-store"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { type Trip } from "@/lib/trip-data"

export function TripRegisterModal({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (trip: Trip) => void
}) {
  const { createTrip, setQuery } = useTrips()
  const [title, setTitle] = useState("")
  const [location, setLocation] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle("")
    setLocation("")
    setStartDate("")
    setEndDate("")
    setSaving(false)
    setError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onOpenChange])

  const canSubmit =
    title.trim().length > 0 &&
    Boolean(startDate) &&
    Boolean(endDate) &&
    startDate <= endDate

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit || saving) return
    setSaving(true)
    setError(null)
    try {
      const trip = await createTrip({
        title: title.trim(),
        location: location.trim() || undefined,
        startDate,
        endDate,
      })
      // Close modal + reset fields (via open=false effect) and notify parent to stay on home.
      setQuery("")
      onOpenChange(false)
      onSaved?.(trip)
    } catch (err) {
      console.error("[TripRegisterModal.onSubmit] Supabase error:", err)
      console.error(
        "[TripRegisterModal.onSubmit] error.message:",
        err && typeof err === "object" && "message" in err
          ? (err as { message: unknown }).message
          : undefined
      )
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message ?? "")
          : err instanceof Error
            ? err.message
            : "여행 저장에 실패했어요."
      setError(message || "여행 저장에 실패했어요.")
    } finally {
      setSaving(false)
    }
  }

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
        aria-labelledby="trip-modal-title"
        className="relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-border bg-card shadow-2xl transform-gpu animate-in fade-in zoom-in-95 duration-200 ease-out sm:mx-4 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Plane className="size-4.5" />
            </span>
            <div>
              <h2 id="trip-modal-title" className="text-base font-bold">
                새 여행 등록
              </h2>
              <p className="text-xs text-muted-foreground">제목·위치·일정을 입력해 저장해요</p>
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="trip-title">여행 제목</FieldLabel>
                <Input
                  id="trip-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="예: 오사카 · 교토 여행"
                  className="rounded-xl"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="trip-location">위치 (선택)</FieldLabel>
                <Input
                  id="trip-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="예: Osaka & Kyoto, Japan"
                  className="rounded-xl"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="trip-start">시작일</FieldLabel>
                  <Input
                    id="trip-start"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="rounded-xl"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="trip-end">종료일</FieldLabel>
                  <Input
                    id="trip-end"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="rounded-xl"
                    required
                  />
                </Field>
              </div>
            </FieldGroup>

            {error ? (
              <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <div className="border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="submit"
              disabled={!canSubmit || saving}
              className="w-full rounded-full font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                  저장 중…
                </>
              ) : (
                "여행 저장하기"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
