"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { Car, Check, Loader2, Plane, Plus, TrainFront, Trash2 } from "lucide-react"

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
import { STATION_OPTIONS, TRAIN_PRESETS } from "@/lib/transport-presets"
import {
  computeDurationLabel,
  getTransportErrorMessage,
  insertTripTransports,
  updateTripTransport,
  type CreateTripTransportInput,
  type TransportRole,
  type TransportType,
  type TripTransport,
} from "@/lib/transports-api"
import { getCurrentUserId } from "@/lib/auth-session"
import { fetchTripRoster, type TripMember } from "@/lib/trip-members-api"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"

type SegmentDraft = {
  key: string
  carrier: string
  vehicleNo: string
  fromLabel: string
  toLabel: string
  departTime: string
  arriveTime: string
  departDate: string
  arriveDate: string
  duration: string
}

type TabFormData = {
  outbound: SegmentDraft
  inbound: SegmentDraft
  multiCity: SegmentDraft[]
}

const TRANSPORT_TYPE_META: Record<
  TransportType,
  {
    label: string
    icon: typeof Plane
    carrierLabel: string
    carrierOptions: typeof AIRLINE_PRESETS
    carrierPlaceholder: string
    showVehicleNo: boolean
    vehicleNoLabel: string
    vehicleNoPlaceholder: string
    placeLabel: string
    placeOptions: typeof AIRPORT_OPTIONS
    fromPlaceholder: string
    toPlaceholder: string
  }
> = {
  FLIGHT: {
    label: "비행기",
    icon: Plane,
    carrierLabel: "항공사",
    carrierOptions: AIRLINE_PRESETS,
    carrierPlaceholder: "항공사 검색",
    showVehicleNo: true,
    vehicleNoLabel: "편명",
    vehicleNoPlaceholder: "KE721",
    placeLabel: "공항",
    placeOptions: AIRPORT_OPTIONS,
    fromPlaceholder: "ICN",
    toPlaceholder: "KIX",
  },
  TRAIN: {
    label: "기차",
    icon: TrainFront,
    carrierLabel: "열차 종류",
    carrierOptions: TRAIN_PRESETS,
    carrierPlaceholder: "KTX, SRT 등",
    showVehicleNo: true,
    vehicleNoLabel: "열차번호",
    vehicleNoPlaceholder: "101 (선택)",
    placeLabel: "역",
    placeOptions: STATION_OPTIONS,
    fromPlaceholder: "서울역",
    toPlaceholder: "부산역",
  },
  CAR: {
    label: "자가용",
    icon: Car,
    carrierLabel: "차량 정보",
    carrierOptions: [],
    carrierPlaceholder: "렌터카, 차종 등 (선택)",
    showVehicleNo: true,
    vehicleNoLabel: "차량번호",
    vehicleNoPlaceholder: "12가 3456 (선택)",
    placeLabel: "장소",
    placeOptions: [],
    fromPlaceholder: "출발지 입력",
    toPlaceholder: "도착지 입력",
  },
}

const TRANSPORT_TYPE_OPTIONS: TransportType[] = ["FLIGHT", "TRAIN", "CAR"]

function createEmptySegment(): SegmentDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    carrier: "",
    vehicleNo: "",
    fromLabel: "",
    toLabel: "",
    departTime: "",
    arriveTime: "",
    departDate: "",
    arriveDate: "",
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

function segmentFromTransport(transport: TripTransport): SegmentDraft {
  return {
    key: transport.id,
    carrier: transport.carrierName,
    vehicleNo: transport.vehicleNo,
    fromLabel: transport.fromLabel,
    toLabel: transport.toLabel,
    departTime: transport.departTime,
    arriveTime: transport.arriveTime,
    departDate: transport.departDate,
    arriveDate: transport.arriveDate,
    duration: transport.duration,
  }
}

function pickDefaultRole(): TransportRole {
  return "OUTBOUND"
}

function tabKeyFromRole(role: TransportRole): keyof TabFormData {
  if (role === "RETURN") return "inbound"
  if (role === "LAYOVER") return "multiCity"
  return "outbound"
}

function SegmentFields({
  transportType,
  segment,
  index,
  total,
  showRemove,
  onChange,
  onRemove,
}: {
  transportType: TransportType
  segment: SegmentDraft
  index: number
  total: number
  showRemove: boolean
  onChange: (key: string, patch: Partial<SegmentDraft>) => void
  onRemove: (key: string) => void
}) {
  const baseId = useId()
  const meta = TRANSPORT_TYPE_META[transportType]

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
          {total > 1 ? `구간 ${index + 1}` : `${meta.label} 정보`}
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
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${baseId}-carrier`} className="text-xs text-gray-500">
              {meta.carrierLabel}
              {transportType === "CAR" ? <span className="ml-1 text-gray-300">(선택)</span> : null}
            </FieldLabel>
            {meta.carrierOptions.length > 0 ? (
              <SearchableSelect
                id={`${baseId}-carrier`}
                value={segment.carrier}
                onChange={(value) => patch({ carrier: value })}
                options={meta.carrierOptions}
                placeholder={meta.carrierPlaceholder}
                emptyText="일치하는 항목이 없어요"
                allowCustom
                customHint="목록에 없으면 입력한 이름을 그대로 저장해요."
              />
            ) : (
              <Input
                id={`${baseId}-carrier`}
                value={segment.carrier}
                onChange={(event) => patch({ carrier: event.target.value })}
                placeholder={meta.carrierPlaceholder}
                className="h-9 rounded-xl border-gray-200 bg-gray-50/80 focus-visible:bg-white"
              />
            )}
          </Field>
          {meta.showVehicleNo ? (
            <Field>
              <FieldLabel htmlFor={`${baseId}-vehicle-no`} className="text-xs text-gray-500">
                {meta.vehicleNoLabel}
              </FieldLabel>
              <Input
                id={`${baseId}-vehicle-no`}
                value={segment.vehicleNo}
                onChange={(event) => patch({ vehicleNo: event.target.value.toUpperCase() })}
                placeholder={meta.vehicleNoPlaceholder}
                className="h-9 rounded-xl border-gray-200 bg-gray-50/80 font-mono uppercase tracking-wide focus-visible:bg-white"
              />
            </Field>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${baseId}-from`} className="text-xs text-gray-500">
              출발 {meta.placeLabel}
            </FieldLabel>
            {meta.placeOptions.length > 0 ? (
              <SearchableSelect
                id={`${baseId}-from`}
                value={segment.fromLabel}
                onChange={(next) => patch({ fromLabel: next })}
                options={meta.placeOptions}
                placeholder={meta.fromPlaceholder}
                emptyText="일치하는 항목이 없어요"
                allowCustom
                customHint="이름으로 검색하거나 직접 입력하세요."
              />
            ) : (
              <Input
                id={`${baseId}-from`}
                value={segment.fromLabel}
                onChange={(event) => patch({ fromLabel: event.target.value })}
                placeholder={meta.fromPlaceholder}
                className="h-9 rounded-xl border-gray-200 bg-gray-50/80 focus-visible:bg-white"
              />
            )}
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
              className="h-9 rounded-xl border-gray-200 bg-gray-50/80 tabular-nums focus-visible:bg-white"
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${baseId}-depart-date`} className="text-xs text-gray-500">
            출발 날짜 <span className="ml-1 text-gray-300">(선택)</span>
          </FieldLabel>
          <Input
            id={`${baseId}-depart-date`}
            type="date"
            value={segment.departDate}
            onChange={(event) => patch({ departDate: event.target.value })}
            className="h-9 rounded-xl border-gray-200 bg-gray-50/80 tabular-nums focus-visible:bg-white"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${baseId}-to`} className="text-xs text-gray-500">
              도착 {meta.placeLabel}
            </FieldLabel>
            {meta.placeOptions.length > 0 ? (
              <SearchableSelect
                id={`${baseId}-to`}
                value={segment.toLabel}
                onChange={(next) => patch({ toLabel: next })}
                options={meta.placeOptions}
                placeholder={meta.toPlaceholder}
                emptyText="일치하는 항목이 없어요"
                allowCustom
                customHint="이름으로 검색하거나 직접 입력하세요."
              />
            ) : (
              <Input
                id={`${baseId}-to`}
                value={segment.toLabel}
                onChange={(event) => patch({ toLabel: event.target.value })}
                placeholder={meta.toPlaceholder}
                className="h-9 rounded-xl border-gray-200 bg-gray-50/80 focus-visible:bg-white"
              />
            )}
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
              className="h-9 rounded-xl border-gray-200 bg-gray-50/80 tabular-nums focus-visible:bg-white"
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`${baseId}-arrive-date`} className="text-xs text-gray-500">
            도착 날짜 <span className="ml-1 text-gray-300">(선택)</span>
          </FieldLabel>
          <Input
            id={`${baseId}-arrive-date`}
            type="date"
            value={segment.arriveDate}
            onChange={(event) => patch({ arriveDate: event.target.value })}
            className="h-9 rounded-xl border-gray-200 bg-gray-50/80 tabular-nums focus-visible:bg-white"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`${baseId}-duration`} className="text-xs text-gray-500">
            소요 시간
          </FieldLabel>
          <Input
            id={`${baseId}-duration`}
            value={segment.duration}
            onChange={(event) => patch({ duration: event.target.value })}
            placeholder="자동 계산"
            className="h-9 rounded-xl border-gray-200 bg-gray-50/80 focus-visible:bg-white"
          />
          <FieldDescription className="text-[11px] text-gray-400">
            출발·도착 시간으로 자동 계산되며, 직접 수정할 수도 있어요.
          </FieldDescription>
        </Field>
      </FieldGroup>
    </div>
  )
}

export function TransportRegisterModal({
  open,
  onOpenChange,
  tripId,
  existingTransports = [],
  editingTransport = null,
  onSaved,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  tripId: string
  existingTransports?: TripTransport[]
  editingTransport?: TripTransport | null
  onSaved: (transports?: TripTransport[]) => void
}) {
  const isEditMode = Boolean(editingTransport)

  const [transportType, setTransportType] = useState<TransportType>("FLIGHT")
  const [role, setRole] = useState<TransportRole>("OUTBOUND")
  const [formData, setFormData] = useState<TabFormData>(() => createEmptyFormData())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roster, setRoster] = useState<TripMember[]>([])
  const [passengerIds, setPassengerIds] = useState<string[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)

  // 멤버마다 각자 가는 편/오는 편을 등록할 수 있으므로 role 은 항상 선택 가능
  const roleOptions = useMemo(
    () => [
      { value: "OUTBOUND" as const, label: "가는 편", hint: "출발", disabled: false },
      { value: "RETURN" as const, label: "오는 편", hint: "귀환", disabled: false },
      { value: "LAYOVER" as const, label: "경유", hint: "환승", disabled: false },
    ],
    []
  )

  const activeSegments: SegmentDraft[] = useMemo(() => {
    if (role === "RETURN") return [formData.inbound]
    if (role === "LAYOVER") return formData.multiCity
    return [formData.outbound]
  }, [role, formData])

  useEffect(() => {
    if (!open) return

    setError(null)
    setSaving(false)

    let cancelled = false
    setRosterLoading(true)

    void (async () => {
      try {
        const [members, authUserId] = await Promise.all([
          fetchTripRoster(tripId),
          getCurrentUserId(),
        ])
        if (cancelled) return
        setRoster(members)

        if (editingTransport) {
          // Respect the saved list as-is — an empty list means the author
          // deliberately unchecked themselves, not "not yet decided".
          setPassengerIds(editingTransport.passengerIds)
        } else {
          setPassengerIds(authUserId ? [authUserId] : [])
        }
      } catch (err) {
        console.error("[TransportRegisterModal] roster load failed:", err)
        if (!cancelled) {
          setRoster([])
          setPassengerIds([])
        }
      } finally {
        if (!cancelled) setRosterLoading(false)
      }
    })()

    if (editingTransport) {
      const segment = segmentFromTransport(editingTransport)
      const next = createEmptyFormData()
      if (editingTransport.transportRole === "RETURN") next.inbound = segment
      else if (editingTransport.transportRole === "LAYOVER") next.multiCity = [segment]
      else next.outbound = segment
      setTransportType(editingTransport.transportType)
      setRole(editingTransport.transportRole)
      setFormData(next)
    } else {
      setRole(pickDefaultRole())
      setFormData(createEmptyFormData())
    }

    return () => {
      cancelled = true
    }
    // Prefill only when the dialog opens (or the edit target changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- existingTransports snapshot at open
  }, [open, editingTransport, tripId])

  const selectTransportType = (next: TransportType) => {
    if (isEditMode) return
    setTransportType(next)
    setRole(pickDefaultRole())
    setError(null)
  }

  /** Switch tabs without wiping other tabs' drafts. */
  const selectRole = (next: TransportRole) => {
    const option = roleOptions.find((item) => item.value === next)
    if (option?.disabled) return
    setRole(next)
    setError(null)
  }

  const updateSegment = (key: string, patch: Partial<SegmentDraft>) => {
    const tab = tabKeyFromRole(role)
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
    if (isEditMode || role !== "LAYOVER") return
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
    setRole("LAYOVER")
    setFormData((current) => ({
      ...current,
      multiCity: [...current.multiCity, createEmptySegment()],
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return

    const segments =
      role === "LAYOVER"
        ? formData.multiCity
        : role === "RETURN"
          ? [formData.inbound]
          : [formData.outbound]

    const requiresCarrier = transportType !== "CAR"
    const invalid = segments.some(
      (segment) =>
        (requiresCarrier && !segment.carrier.trim()) ||
        !segment.fromLabel.trim() ||
        !segment.toLabel.trim()
    )

    if (invalid) {
      setError(
        transportType === "CAR"
          ? "출발지와 도착지를 입력해 주세요"
          : `${TRANSPORT_TYPE_META[transportType].carrierLabel} 및 출발·도착 정보를 입력해 주세요`
      )
      return
    }

    const resolvedRole: TransportRole = !isEditMode && segments.length > 1 ? "LAYOVER" : role

    // 여행 멤버마다 각자 이동수단을 등록할 수 있어야 함(선발대/후발대 등 서로 다른 시간·루트)
    // → 가는 편/오는 편 중복 등록 제한을 두지 않는다.

    setSaving(true)
    setError(null)
    try {
      const toInput = (segment: SegmentDraft, segmentOrder: number): CreateTripTransportInput => ({
        tripId,
        transportType,
        carrierName: segment.carrier.trim(),
        vehicleNo: segment.vehicleNo.trim(),
        fromLabel: segment.fromLabel.trim(),
        toLabel: segment.toLabel.trim(),
        departTime: segment.departTime,
        arriveTime: segment.arriveTime,
        duration: segment.duration.trim(),
        departDate: segment.departDate,
        arriveDate: segment.arriveDate,
        transportRole: resolvedRole,
        segmentOrder,
        passengerIds,
      })

      if (isEditMode && editingTransport) {
        const segment = segments[0]
        if (!segment) throw new Error("수정할 이동수단 정보가 없어요.")
        const updated = await updateTripTransport(
          editingTransport.id,
          toInput(segment, resolvedRole === "LAYOVER" ? editingTransport.segmentOrder : 1)
        )
        onSaved([updated])
        onOpenChange(false)
        return
      }

      const transports = await insertTripTransports(
        segments.map((segment, index) => toInput(segment, index + 1))
      )
      onSaved(transports)
      onOpenChange(false)
    } catch (err) {
      console.error("[TransportRegisterModal] save failed:", err)
      const message = getTransportErrorMessage(err)
      setError(message || "이동수단 저장에 실패했어요. 잠시 후 다시 시도해 주세요.")
    } finally {
      setSaving(false)
    }
  }

  const activeMeta = TRANSPORT_TYPE_META[transportType]
  const ActiveIcon = activeMeta.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] gap-0 overflow-hidden rounded-3xl border-gray-100 bg-white p-0 sm:max-w-lg">
        <DialogHeader className="gap-1 border-b border-gray-100 px-5 pt-5 pb-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight text-gray-900">
            <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-rose-400 to-amber-500 p-[2px]">
              <span className="flex size-full items-center justify-center rounded-full bg-white">
                <ActiveIcon className="size-4 text-amber-500" />
              </span>
            </span>
            {isEditMode ? "이동수단 수정" : "이동수단 추가"}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-400">
            {isEditMode
              ? "탭을 바꿔도 입력한 내용은 유지돼요."
              : "가는 편 · 오는 편 · 경유 입력값은 탭을 바꿔도 사라지지 않아요."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="transport-register-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex max-h-[min(70svh,560px)] flex-col gap-4 overflow-y-auto px-5 py-4"
        >
          <div
            role="tablist"
            aria-label="이동수단 종류"
            className="grid grid-cols-3 gap-1 rounded-full bg-gray-100 p-1"
          >
            {TRANSPORT_TYPE_OPTIONS.map((type) => {
              const meta = TRANSPORT_TYPE_META[type]
              const Icon = meta.icon
              const selected = transportType === type
              return (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  disabled={isEditMode && !selected}
                  onClick={() => selectTransportType(type)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-full px-2 py-2 transition-all",
                    selected
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-800",
                    isEditMode && !selected && "cursor-not-allowed opacity-40 hover:text-gray-500"
                  )}
                >
                  <Icon className="size-4" />
                  <span className="text-[12px] font-semibold tracking-tight sm:text-[13px]">
                    {meta.label}
                  </span>
                </button>
              )
            })}
          </div>

          <div
            role="tablist"
            aria-label="여정 방향"
            className="grid grid-cols-3 gap-1 rounded-full bg-gray-100 p-1"
          >
            {roleOptions.map((option) => {
              const selected = role === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-disabled={option.disabled}
                  disabled={option.disabled}
                  onClick={() => selectRole(option.value)}
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
                transportType={transportType}
                segment={segment}
                index={index}
                total={activeSegments.length}
                showRemove={!isEditMode && role === "LAYOVER" && activeSegments.length > 1}
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

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-[13px] font-semibold tracking-tight text-gray-900">동승자</p>
            <p className="mt-0.5 text-[11px] text-gray-400">
              함께 이동하는 여행 멤버를 선택해 주세요.
            </p>
            {rosterLoading ? (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="size-3.5 animate-spin" />
                멤버를 불러오는 중…
              </div>
            ) : roster.length === 0 ? (
              <p className="mt-3 text-xs text-gray-400">선택할 수 있는 여행 멤버가 없어요.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {roster.map((member) => {
                  const checked = passengerIds.includes(member.userId)
                  return (
                    <li key={member.userId}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-gray-50">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            setPassengerIds((current) => {
                              if (next) {
                                return current.includes(member.userId)
                                  ? current
                                  : [...current, member.userId]
                              }
                              return current.filter((id) => id !== member.userId)
                            })
                          }}
                          aria-label={`${member.name} 동승 선택`}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                          {member.name}
                        </span>
                        {member.role === "owner" ? (
                          <span className="shrink-0 text-[10px] font-semibold text-gray-400">
                            호스트
                          </span>
                        ) : null}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

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
            form="transport-register-form"
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
