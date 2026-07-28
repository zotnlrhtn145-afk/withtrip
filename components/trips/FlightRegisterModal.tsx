"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { Check, Loader2, Plane, Plus, Trash2 } from "lucide-react"

import { SearchableSelect } from "@/components/searchable-select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { AIRLINE_PRESETS, AIRPORT_OPTIONS } from "@/lib/flight-presets"
import {
  computeDurationLabel,
  getErrorMessage,
  insertTripFlights,
  updateTripFlight,
  type FlightType,
  type TripFlight,
} from "@/lib/flights-api"
import { cn } from "@/lib/utils"

type SegmentDraft = {
  key: string
  airline: string
  flightNo: string
  departureAirport: string
  arrivalAirport: string
  departTime: string
  arriveTime: string
  duration: string
}

type TabFormData = {
  outbound: SegmentDraft
  inbound: SegmentDraft
  multiCity: SegmentDraft[]
}

const DUPLICATE_TYPE_MESSAGE =
  "이미 출국(또는 귀국) 항공권이 등록되어 있습니다. 기존 티켓을 수정해 주세요."

function createEmptySegment(): SegmentDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    airline: "",
    flightNo: "",
    departureAirport: "",
    arrivalAirport: "",
    departTime: "",
    arriveTime: "",
    duration: "",
  }
}

function createEmptyFormData(): TabFormData {
  return {
    outbound: createEmptySegment(),
    inbound: createEmptySegment(),
    multiCity: [createEmptySegment(), createEmptySegment()],
  }
}

function segmentFromFlight(flight: TripFlight): SegmentDraft {
  return {
    key: flight.id,
    airline: flight.airlineName,
    flightNo: flight.flightNo,
    departureAirport: flight.fromCode,
    arrivalAirport: flight.toCode,
    departTime: flight.departTime,
    arriveTime: flight.arriveTime,
    duration: flight.duration,
  }
}

function hasTypeTaken(
  existingFlights: TripFlight[],
  type: FlightType,
  excludeId?: string | null
) {
  if (type === "LAYOVER") return false
  return existingFlights.some(
    (flight) => flight.flightType === type && flight.id !== excludeId
  )
}

function pickDefaultCreateType(existingFlights: TripFlight[]): FlightType {
  if (!hasTypeTaken(existingFlights, "OUTBOUND")) return "OUTBOUND"
  if (!hasTypeTaken(existingFlights, "RETURN")) return "RETURN"
  return "LAYOVER"
}

function tabKeyFromType(type: FlightType): keyof TabFormData {
  if (type === "RETURN") return "inbound"
  if (type === "LAYOVER") return "multiCity"
  return "outbound"
}

function SegmentFields({
  segment,
  index,
  total,
  showRemove,
  onChange,
  onRemove,
}: {
  segment: SegmentDraft
  index: number
  total: number
  showRemove: boolean
  onChange: (key: string, patch: Partial<SegmentDraft>) => void
  onRemove: (key: string) => void
}) {
  const baseId = useId()

  const patch = (next: Partial<SegmentDraft>) => {
    const merged = { ...segment, ...next }
    if ("departTime" in next || "arriveTime" in next) {
      merged.duration = computeDurationLabel(merged.departTime, merged.arriveTime)
    }
    onChange(segment.key, merged)
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold tracking-tight text-gray-900">
          {total > 1 ? `구간 ${index + 1}` : "비행 정보"}
        </p>
        {showRemove ? (
          <button
            type="button"
            aria-label={`구간 ${index + 1} 삭제`}
            onClick={() => onRemove(segment.key)}
            className="flex size-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-rose-50 hover:text-rose-500"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>

      <FieldGroup className="gap-3.5">
        <Field>
          <FieldLabel htmlFor={`${baseId}-airline`} className="text-xs text-gray-500">
            항공사
          </FieldLabel>
          <SearchableSelect
            id={`${baseId}-airline`}
            value={segment.airline}
            onChange={(value) => patch({ airline: value })}
            options={AIRLINE_PRESETS}
            placeholder="항공사 검색"
            emptyText="일치하는 항공사가 없어요"
            allowCustom
            customHint="목록에 없으면 입력한 이름을 그대로 저장해요."
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`${baseId}-flight-no`} className="text-xs text-gray-500">
            편명
          </FieldLabel>
          <Input
            id={`${baseId}-flight-no`}
            value={segment.flightNo}
            onChange={(event) => patch({ flightNo: event.target.value.toUpperCase() })}
            placeholder="KE721"
            className="h-11 rounded-xl border-gray-200 bg-gray-50/80 font-mono uppercase tracking-wide focus-visible:bg-white"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${baseId}-from`} className="text-xs text-gray-500">
              출발
            </FieldLabel>
            <SearchableSelect
              id={`${baseId}-from`}
              value={segment.departureAirport}
              onChange={(next) => patch({ departureAirport: next.toUpperCase().slice(0, 8) })}
              options={AIRPORT_OPTIONS}
              placeholder="ICN"
              emptyText="일치하는 공항이 없어요"
              allowCustom
              customHint="코드 또는 공항명으로 검색"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${baseId}-depart-time`} className="text-xs text-gray-500">
              출발 시간
            </FieldLabel>
            <Input
              id={`${baseId}-depart-time`}
              type="time"
              value={segment.departTime}
              onChange={(event) => patch({ departTime: event.target.value })}
              className="h-11 rounded-xl border-gray-200 bg-gray-50/80 tabular-nums focus-visible:bg-white"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${baseId}-to`} className="text-xs text-gray-500">
              도착
            </FieldLabel>
            <SearchableSelect
              id={`${baseId}-to`}
              value={segment.arrivalAirport}
              onChange={(next) => patch({ arrivalAirport: next.toUpperCase().slice(0, 8) })}
              options={AIRPORT_OPTIONS}
              placeholder="KIX"
              emptyText="일치하는 공항이 없어요"
              allowCustom
              customHint="코드 또는 공항명으로 검색"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${baseId}-arrive-time`} className="text-xs text-gray-500">
              도착 시간
            </FieldLabel>
            <Input
              id={`${baseId}-arrive-time`}
              type="time"
              value={segment.arriveTime}
              onChange={(event) => patch({ arriveTime: event.target.value })}
              className="h-11 rounded-xl border-gray-200 bg-gray-50/80 tabular-nums focus-visible:bg-white"
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor={`${baseId}-duration`} className="text-xs text-gray-500">
            소요 시간
          </FieldLabel>
          <Input
            id={`${baseId}-duration`}
            value={segment.duration}
            onChange={(event) => patch({ duration: event.target.value })}
            placeholder="자동 계산"
            className="h-11 rounded-xl border-gray-200 bg-gray-50/80 focus-visible:bg-white"
          />
          <FieldDescription className="text-[11px] text-gray-400">
            출발·도착 시간으로 자동 계산되며, 직접 수정할 수도 있어요.
          </FieldDescription>
        </Field>
      </FieldGroup>
    </div>
  )
}

export function FlightRegisterModal({
  open,
  onOpenChange,
  tripId,
  existingFlights = [],
  editingFlight = null,
  onSaved,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  tripId: string
  existingFlights?: TripFlight[]
  editingFlight?: TripFlight | null
  onSaved: (flights?: TripFlight[]) => void
}) {
  const isEditMode = Boolean(editingFlight)
  const excludeId = editingFlight?.id ?? null

  const [flightType, setFlightType] = useState<FlightType>("OUTBOUND")
  const [formData, setFormData] = useState<TabFormData>(() => createEmptyFormData())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const outboundTaken = hasTypeTaken(existingFlights, "OUTBOUND", excludeId)
  const returnTaken = hasTypeTaken(existingFlights, "RETURN", excludeId)

  const typeOptions = useMemo(
    () => [
      {
        value: "OUTBOUND" as const,
        label: outboundTaken ? "출국 완료" : "출국",
        hint: "가는 편",
        disabled: outboundTaken,
      },
      {
        value: "RETURN" as const,
        label: returnTaken ? "귀국 완료" : "귀국",
        hint: "오는 편",
        disabled: returnTaken,
      },
      {
        value: "LAYOVER" as const,
        label: "다구간",
        hint: "경유",
        disabled: false,
      },
    ],
    [outboundTaken, returnTaken]
  )

  const activeSegments: SegmentDraft[] = useMemo(() => {
    if (flightType === "RETURN") return [formData.inbound]
    if (flightType === "LAYOVER") return formData.multiCity
    return [formData.outbound]
  }, [flightType, formData])

  useEffect(() => {
    if (!open) return

    setError(null)
    setSaving(false)

    if (editingFlight) {
      const segment = segmentFromFlight(editingFlight)
      const next = createEmptyFormData()
      if (editingFlight.flightType === "RETURN") next.inbound = segment
      else if (editingFlight.flightType === "LAYOVER") next.multiCity = [segment]
      else next.outbound = segment
      setFlightType(editingFlight.flightType)
      setFormData(next)
      return
    }

    setFlightType(pickDefaultCreateType(existingFlights))
    setFormData(createEmptyFormData())
    // Prefill only when the dialog opens (or the edit target changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- existingFlights snapshot at open
  }, [open, editingFlight])

  /** Switch tabs without wiping other tabs' drafts. */
  const selectFlightType = (next: FlightType) => {
    const option = typeOptions.find((item) => item.value === next)
    if (option?.disabled) return
    setFlightType(next)
    setError(null)
  }

  const updateSegment = (key: string, patch: Partial<SegmentDraft>) => {
    const tab = tabKeyFromType(flightType)
    setFormData((current) => {
      if (tab === "multiCity") {
        return {
          ...current,
          multiCity: current.multiCity.map((segment) =>
            segment.key === key ? { ...segment, ...patch } : segment
          ),
        }
      }
      const single = current[tab]
      if (single.key !== key) return current
      return { ...current, [tab]: { ...single, ...patch } }
    })
  }

  const removeSegment = (key: string) => {
    if (isEditMode || flightType !== "LAYOVER") return
    setFormData((current) => {
      if (current.multiCity.length <= 1) return current
      return {
        ...current,
        multiCity: current.multiCity.filter((segment) => segment.key !== key),
      }
    })
  }

  const addSegment = () => {
    if (isEditMode) return
    setError(null)
    setFlightType("LAYOVER")
    setFormData((current) => ({
      ...current,
      multiCity: [...current.multiCity, createEmptySegment()],
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return

    const segments =
      flightType === "LAYOVER"
        ? formData.multiCity
        : flightType === "RETURN"
          ? [formData.inbound]
          : [formData.outbound]

    const invalid = segments.some(
      (segment) =>
        !segment.airline.trim() ||
        !segment.departureAirport.trim() ||
        !segment.arrivalAirport.trim()
    )

    if (invalid) {
      setError("항공사 및 공항 정보를 선택해 주세요")
      return
    }

    const resolvedType: FlightType =
      !isEditMode && segments.length > 1 ? "LAYOVER" : flightType

    if (hasTypeTaken(existingFlights, resolvedType, excludeId)) {
      setError(DUPLICATE_TYPE_MESSAGE)
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (isEditMode && editingFlight) {
        const segment = segments[0]
        if (!segment) throw new Error("수정할 항공권 정보가 없어요.")
        const updated = await updateTripFlight(editingFlight.id, {
          tripId,
          airlineName: segment.airline.trim(),
          flightNo: segment.flightNo.trim(),
          fromCode: segment.departureAirport.trim().toUpperCase(),
          toCode: segment.arrivalAirport.trim().toUpperCase(),
          departTime: segment.departTime,
          arriveTime: segment.arriveTime,
          duration: segment.duration.trim(),
          flightType: resolvedType,
          segmentOrder: resolvedType === "LAYOVER" ? editingFlight.segmentOrder : 1,
        })
        onSaved([updated])
        onOpenChange(false)
        return
      }

      const flights = await insertTripFlights(
        segments.map((segment, index) => ({
          tripId,
          airlineName: segment.airline.trim(),
          flightNo: segment.flightNo.trim(),
          fromCode: segment.departureAirport.trim().toUpperCase(),
          toCode: segment.arrivalAirport.trim().toUpperCase(),
          departTime: segment.departTime,
          arriveTime: segment.arriveTime,
          duration: segment.duration.trim(),
          flightType: resolvedType,
          segmentOrder: index + 1,
        }))
      )
      onSaved(flights)
      onOpenChange(false)
    } catch (err) {
      console.error("[FlightRegisterModal] save failed:", err)
      if (err && typeof err === "object") {
        console.error("[FlightRegisterModal] error.message:", (err as { message?: unknown }).message)
        console.error("[FlightRegisterModal] error.details:", (err as { details?: unknown }).details)
        console.error("[FlightRegisterModal] error.hint:", (err as { hint?: unknown }).hint)
        console.error("[FlightRegisterModal] error.code:", (err as { code?: unknown }).code)
      }
      const message = getErrorMessage(err)
      setError(message || "항공권 저장에 실패했어요. 잠시 후 다시 시도해 주세요.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] gap-0 overflow-hidden rounded-3xl border-gray-100 bg-white p-0 sm:max-w-lg">
        <DialogHeader className="gap-1 border-b border-gray-100 px-5 pt-5 pb-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight text-gray-900">
            <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-rose-400 to-amber-500 p-[2px]">
              <span className="flex size-full items-center justify-center rounded-full bg-white">
                <Plane className="size-4 text-amber-500" />
              </span>
            </span>
            {isEditMode ? "비행 일정 수정" : "비행 일정 추가"}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-400">
            {isEditMode
              ? "탭을 바꿔도 입력한 내용은 유지돼요."
              : "출국 · 귀국 · 다구간 입력값은 탭을 바꿔도 사라지지 않아요."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="flight-register-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex max-h-[min(70svh,560px)] flex-col gap-4 overflow-y-auto px-5 py-4"
        >
          <div
            role="tablist"
            aria-label="여정 유형"
            className="grid grid-cols-3 gap-1 rounded-full bg-gray-100 p-1"
          >
            {typeOptions.map((option) => {
              const selected = flightType === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-disabled={option.disabled}
                  disabled={option.disabled}
                  onClick={() => selectFlightType(option.value)}
                  className={cn(
                    "flex flex-col items-center rounded-full px-2 py-2 transition-all",
                    selected
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-800",
                    option.disabled && "cursor-not-allowed opacity-40 hover:text-gray-500"
                  )}
                >
                  <span className="text-[12px] font-semibold tracking-tight sm:text-[13px]">
                    {option.label}
                  </span>
                  <span className="text-[10px] text-gray-400">{option.hint}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-3">
            {activeSegments.map((segment, index) => (
              <SegmentFields
                key={segment.key}
                segment={segment}
                index={index}
                total={activeSegments.length}
                showRemove={!isEditMode && flightType === "LAYOVER" && activeSegments.length > 1}
                onChange={updateSegment}
                onRemove={removeSegment}
              />
            ))}
          </div>

          {!isEditMode ? (
            <button
              type="button"
              onClick={addSegment}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-dashed border-amber-300/80 bg-amber-50/40 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
            >
              <Plus className="size-4" />
              경유 구간 추가
            </button>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-600"
            >
              <p className="break-words">{error}</p>
            </div>
          ) : null}
        </form>

        <DialogFooter
          className={cn(
            "sticky bottom-0 left-0 right-0 z-10 mx-0 mb-0",
            "grid w-full grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:items-center sm:justify-end",
            "rounded-b-3xl border-t border-slate-100 bg-white/95 px-5 pt-4 backdrop-blur-md",
            "pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-4"
          )}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-full px-4 py-2.5 text-xs font-semibold text-slate-500 transition-all hover:bg-slate-100/80 hover:text-slate-900 active:scale-95 disabled:opacity-50 sm:w-auto"
          >
            취소
          </button>
          <button
            type="submit"
            form="flight-register-form"
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-amber-400 px-6 py-2.5 text-xs font-bold text-slate-950 shadow-sm shadow-amber-400/20 transition-all hover:bg-amber-500 active:scale-95 disabled:opacity-60 sm:w-auto"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : isEditMode ? (
              <Check className="size-3.5" />
            ) : (
              <Plus className="size-3.5" />
            )}
            {saving ? "저장 중…" : isEditMode ? "수정 완료" : "저장하기"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
