"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { Check, Loader2, Plane, Plus, Trash2 } from "lucide-react"

import { SearchableSelect } from "@/components/searchable-select"
import { Button } from "@/components/ui/button"
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
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">
          {total > 1 ? `구간 ${index + 1}` : "비행 정보"}
        </p>
        {showRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`구간 ${index + 1} 삭제`}
            onClick={() => onRemove(segment.key)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
          </Button>
        ) : null}
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${baseId}-airline`}>항공사</FieldLabel>
          <SearchableSelect
            id={`${baseId}-airline`}
            value={segment.airline}
            onChange={(value) => patch({ airline: value })}
            options={AIRLINE_PRESETS}
            placeholder="항공사를 검색하거나 선택하세요"
            emptyText="일치하는 항공사가 없어요"
            allowCustom
            customHint="목록에 없으면 입력한 이름을 그대로 저장해요."
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`${baseId}-flight-no`}>편명</FieldLabel>
          <Input
            id={`${baseId}-flight-no`}
            value={segment.flightNo}
            onChange={(event) => patch({ flightNo: event.target.value.toUpperCase() })}
            placeholder="예: KE721"
            className="rounded-xl font-mono uppercase"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${baseId}-from`}>출발 공항</FieldLabel>
            <SearchableSelect
              id={`${baseId}-from`}
              value={segment.departureAirport}
              onChange={(next) => patch({ departureAirport: next.toUpperCase().slice(0, 8) })}
              options={AIRPORT_OPTIONS}
              placeholder="출발 공항 선택 (예: ICN, 인천)"
              emptyText="일치하는 공항이 없어요"
              allowCustom
              customHint="코드 또는 공항명으로 검색 · 직접 입력도 가능"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${baseId}-depart-time`}>출발 시간</FieldLabel>
            <Input
              id={`${baseId}-depart-time`}
              type="time"
              value={segment.departTime}
              onChange={(event) => patch({ departTime: event.target.value })}
              placeholder="시간 선택"
              className="rounded-xl tabular-nums"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${baseId}-to`}>도착 공항</FieldLabel>
            <SearchableSelect
              id={`${baseId}-to`}
              value={segment.arrivalAirport}
              onChange={(next) => patch({ arrivalAirport: next.toUpperCase().slice(0, 8) })}
              options={AIRPORT_OPTIONS}
              placeholder="도착 공항 선택 (예: KIX, 간사이)"
              emptyText="일치하는 공항이 없어요"
              allowCustom
              customHint="코드 또는 공항명으로 검색 · 직접 입력도 가능"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${baseId}-arrive-time`}>도착 시간</FieldLabel>
            <Input
              id={`${baseId}-arrive-time`}
              type="time"
              value={segment.arriveTime}
              onChange={(event) => patch({ arriveTime: event.target.value })}
              placeholder="시간 선택"
              className="rounded-xl tabular-nums"
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor={`${baseId}-duration`}>소요 시간</FieldLabel>
          <Input
            id={`${baseId}-duration`}
            value={segment.duration}
            onChange={(event) => patch({ duration: event.target.value })}
            placeholder="시간 입력 시 자동 계산됩니다"
            className="rounded-xl"
          />
          <FieldDescription>
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
  const [segments, setSegments] = useState<SegmentDraft[]>([createEmptySegment()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const outboundTaken = hasTypeTaken(existingFlights, "OUTBOUND", excludeId)
  const returnTaken = hasTypeTaken(existingFlights, "RETURN", excludeId)

  const typeOptions = useMemo(
    () => [
      {
        value: "OUTBOUND" as const,
        label: outboundTaken ? "출국 (등록완료)" : "출국 (가는 편)",
        disabled: outboundTaken,
      },
      {
        value: "RETURN" as const,
        label: returnTaken ? "귀국 (등록완료)" : "귀국 (오는 편)",
        disabled: returnTaken,
      },
      {
        value: "LAYOVER" as const,
        label: "경유 / 다구간",
        disabled: false,
      },
    ],
    [outboundTaken, returnTaken]
  )

  useEffect(() => {
    if (!open) return

    setError(null)
    setSaving(false)

    if (editingFlight) {
      setFlightType(editingFlight.flightType)
      setSegments([segmentFromFlight(editingFlight)])
      return
    }

    const defaultType = pickDefaultCreateType(existingFlights)
    setFlightType(defaultType)
    setSegments(
      defaultType === "LAYOVER"
        ? [createEmptySegment(), createEmptySegment()]
        : [createEmptySegment()]
    )
    // Prefill only when the dialog opens (or the edit target changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- existingFlights snapshot at open
  }, [open, editingFlight])

  const selectFlightType = (next: FlightType) => {
    const option = typeOptions.find((item) => item.value === next)
    if (option?.disabled) return

    setFlightType(next)
    setError(null)
    if (isEditMode) {
      // Edit keeps a single segment; type change only updates the badge/type.
      return
    }
    if (next === "LAYOVER") {
      setSegments((current) => (current.length >= 2 ? current : [...current, createEmptySegment()]))
      return
    }
    setSegments((current) => [current[0] ?? createEmptySegment()])
  }

  const updateSegment = (key: string, patch: Partial<SegmentDraft>) => {
    setSegments((current) =>
      current.map((segment) => (segment.key === key ? { ...segment, ...patch } : segment))
    )
  }

  const removeSegment = (key: string) => {
    if (isEditMode) return
    setSegments((current) => {
      if (current.length <= 1) return current
      return current.filter((segment) => segment.key !== key)
    })
  }

  const addSegment = () => {
    if (isEditMode) return
    setError(null)
    if (flightType !== "LAYOVER") setFlightType("LAYOVER")
    setSegments((current) => [...current, createEmptySegment()])
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return

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
      !isEditMode && segments.length > 1
        ? "LAYOVER"
        : flightType === "LAYOVER"
          ? "LAYOVER"
          : flightType

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
      <DialogContent className="max-h-[90svh] gap-5 overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Plane className="size-4" />
            </span>
            {isEditMode ? "비행기 일정 수정" : "비행기 일정 등록"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "항공사·공항·시간 정보를 수정한 뒤 수정 완료를 눌러 주세요."
              : "출국·귀국·경유를 구분해 등록하고, 다구간은 구간을 추가해 저장할 수 있어요."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="flight-register-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-5"
        >
          <div
            role="tablist"
            aria-label="여정 유형"
            className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
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
                    "rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors sm:text-sm",
                    selected
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                    option.disabled && "cursor-not-allowed opacity-45 hover:text-muted-foreground"
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-3">
            {segments.map((segment, index) => (
              <SegmentFields
                key={segment.key}
                segment={segment}
                index={index}
                total={segments.length}
                showRemove={!isEditMode && segments.length > 1}
                onChange={updateSegment}
                onRemove={removeSegment}
              />
            ))}
          </div>

          {!isEditMode ? (
            <Button
              type="button"
              variant="outline"
              onClick={addSegment}
              disabled={saving}
              className="rounded-full font-semibold"
            >
              <Plus data-icon="inline-start" />
              경유지/구간 추가
            </Button>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <p className="break-words">{error}</p>
            </div>
          ) : null}
        </form>

        <DialogFooter className="rounded-b-2xl">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-full font-semibold"
          >
            취소
          </Button>
          <Button
            type="submit"
            form="flight-register-form"
            disabled={saving}
            className="rounded-full font-semibold"
          >
            {saving ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : isEditMode ? (
              <Check data-icon="inline-start" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            {isEditMode ? "수정 완료" : "저장하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
