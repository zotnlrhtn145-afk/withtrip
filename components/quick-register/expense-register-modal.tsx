"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  ScanLine,
  X,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  fetchSettlementMembers,
  formatWon,
  initialsFromNickname,
  insertExpense,
  uploadReceiptImage,
  type ExpenseCategory,
} from "@/lib/settlements-api"
import { calcPerPerson } from "@/lib/settlement-math"
import { members as mockMembers } from "@/lib/trip-data"
import { clearDocumentScrollLock } from "@/lib/clear-scroll-lock"
import { parseReceiptImage } from "@/lib/parse-receipt"
import { cn } from "@/lib/utils"

export type ExpenseDraft = {
  amount: string
  storeName: string
  category: string
  paidAt: string
  paidById: string
  splitMemberIds: string[]
  receiptPreview: string | null
}

type MemberOption = {
  id: string
  name: string
  initials: string
  color?: string
  avatarUrl?: string
}

const CATEGORIES = ["식비", "숙박", "교통", "관광", "기타"] as const

const CATEGORY_TO_DB: Record<string, ExpenseCategory> = {
  식비: "식사",
  숙박: "숙소",
  교통: "교통",
  관광: "기타",
  기타: "기타",
}

const DB_CATEGORY_TO_UI: Record<string, (typeof CATEGORIES)[number]> = {
  식사: "식비",
  숙소: "숙박",
  교통: "교통",
  쇼핑: "기타",
  기타: "기타",
}

function toLocalDateTimeValue(date = new Date()) {
  const pad = (n: number) => `${n}`.padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function emptyDraft(memberIds: string[] = []): ExpenseDraft {
  return {
    amount: "",
    storeName: "",
    category: "식비",
    paidAt: toLocalDateTimeValue(),
    paidById: memberIds[0] ?? "",
    splitMemberIds: memberIds,
    receiptPreview: null,
  }
}

function mapMockMembers(): MemberOption[] {
  return mockMembers.map((m) => ({
    id: m.id,
    name: m.name,
    initials: m.initials,
    color: m.color,
  }))
}

export type QuickTripOption = { id: string; title: string }

export function ExpenseRegisterModal({
  open,
  onOpenChange,
  tripId = null,
  trips = [],
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tripId?: string | null
  trips?: QuickTripOption[]
  onSaved?: (draft: ExpenseDraft, tripId: string) => void
}) {
  const fixedTripId = String(tripId ?? "").trim() || null
  const [selectedTripId, setSelectedTripId] = useState<string>(fixedTripId ?? "")
  const activeTripId = fixedTripId ?? (selectedTripId || null)
  const [tab, setTab] = useState<"scan" | "manual">("scan")
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>(() => mapMockMembers())
  const [draft, setDraft] = useState<ExpenseDraft>(() =>
    emptyDraft(mapMockMembers().map((m) => m.id))
  )
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [ocrNotice, setOcrNotice] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelectedTripId(fixedTripId ?? "")
  }, [open, fixedTripId])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const resetWithMembers = (list: MemberOption[]) => {
      if (cancelled) return
      setMemberOptions(list)
      const ids = list.map((m) => m.id)
      setTab("scan")
      setDraft(emptyDraft(ids))
      setReceiptFile(null)
      setScanning(false)
      setSaving(false)
      setFormError(null)
      setOcrNotice(null)
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }

    if (!activeTripId) {
      resetWithMembers(mapMockMembers())
      return () => {
        cancelled = true
      }
    }

    void (async () => {
      try {
        const members = await fetchSettlementMembers(activeTripId)
        if (cancelled) return
        if (members.length === 0) {
          resetWithMembers(mapMockMembers())
          setFormError("여행 멤버를 불러오지 못했어요. 사이드바에서 여행을 확인해 주세요.")
          return
        }
        resetWithMembers(
          members.map((m) => ({
            id: m.userId,
            name: m.nickname,
            initials: initialsFromNickname(m.nickname),
            avatarUrl: m.avatarUrl,
          }))
        )
      } catch (err) {
        const typed = err as { message?: string }
        console.error("[ExpenseRegisterModal] members:", typed?.message)
        if (!cancelled) {
          resetWithMembers(mapMockMembers())
          setFormError("멤버를 불러오지 못했어요.")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, activeTripId])

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

  const canSubmit = useMemo(() => {
    const amount = Number(draft.amount.replace(/,/g, ""))
    return (
      Boolean(activeTripId) &&
      Number.isFinite(amount) &&
      amount > 0 &&
      draft.storeName.trim().length > 0 &&
      draft.paidById &&
      draft.splitMemberIds.length > 0
    )
  }, [draft, activeTripId])

  const liveShare = useMemo(() => {
    const amount = Number(draft.amount.replace(/,/g, ""))
    if (!Number.isFinite(amount) || amount <= 0 || draft.splitMemberIds.length === 0) return 0
    return calcPerPerson(amount, draft.splitMemberIds.length)
  }, [draft.amount, draft.splitMemberIds.length])

  const allSplitSelected =
    memberOptions.length > 0 && draft.splitMemberIds.length === memberOptions.length

  const update = <K extends keyof ExpenseDraft>(key: K, value: ExpenseDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const toggleSplitMember = (id: string, checked: boolean) => {
    setDraft((current) => {
      const next = checked
        ? [...new Set([...current.splitMemberIds, id])]
        : current.splitMemberIds.filter((item) => item !== id)
      return { ...current, splitMemberIds: next }
    })
  }

  const toggleAllSplitMembers = () => {
    setDraft((current) => ({
      ...current,
      splitMemberIds: allSplitSelected ? [] : memberOptions.map((member) => member.id),
    }))
  }

  const clearReceipt = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setReceiptFile(null)
    update("receiptPreview", null)
    setOcrNotice(null)
    setScanning(false)
  }

  const processReceiptFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const previewUrl = URL.createObjectURL(file)
    previewUrlRef.current = previewUrl
    setReceiptFile(file)
    update("receiptPreview", previewUrl)
    setScanning(true)
    setOcrNotice(null)
    setFormError(null)

    void (async () => {
      try {
        const parsed = await parseReceiptImage(file)
        setDraft((current) => ({
          ...current,
          storeName: parsed.title || current.storeName,
          amount: parsed.amount > 0 ? String(Math.round(parsed.amount)) : current.amount,
          category: DB_CATEGORY_TO_UI[parsed.category] ?? current.category,
          paidAt: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
            ? `${parsed.date}T${current.paidAt.slice(11) || "12:00"}`
            : current.paidAt,
          receiptPreview: previewUrl,
        }))
        setOcrNotice("영수증에서 내용을 불러왔어요. 직접 수정할 수 있어요.")
        setTab("manual")
      } catch (err) {
        const typed = err as { message?: string }
        console.error("[ExpenseRegisterModal] OCR failed:", typed?.message)
        setFormError(typed?.message || "영수증 정보를 읽지 못했어요. 직접 입력해 주세요.")
        setTab("manual")
      } finally {
        setScanning(false)
      }
    })()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit || scanning || saving) return

    if (!activeTripId) {
      setFormError("여행을 선택해 주세요.")
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      let receiptUrl: string | undefined
      if (receiptFile) {
        receiptUrl = await uploadReceiptImage(receiptFile, activeTripId)
      }

      const amount = Number(draft.amount.replace(/,/g, ""))
      const expenseDate = (draft.paidAt.slice(0, 10) || new Date().toISOString().slice(0, 10))
      await insertExpense({
        tripId: activeTripId,
        title: draft.storeName.trim(),
        amount,
        category: CATEGORY_TO_DB[draft.category] ?? "기타",
        payerId: draft.paidById,
        expenseDate,
        receiptUrl,
        participantIds: draft.splitMemberIds,
      })

      onSaved?.(draft, activeTripId)
      onOpenChange(false)
    } catch (err) {
      const typed = err as { message?: string }
      console.error("[ExpenseRegisterModal] save failed:", typed?.message)
      setFormError(
        typed?.message?.includes("receipts")
          ? "영수증 업로드에 실패했어요. Storage 버킷(receipts)을 확인해 주세요."
          : typed?.message?.includes("expense_participants")
            ? "정산 대상자 저장에 실패했어요. expense_participants 테이블을 확인해 주세요."
            : "지출 저장에 실패했어요. 잠시 후 다시 시도해 주세요."
      )
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
        aria-labelledby="expense-modal-title"
        className="relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-border bg-card shadow-2xl transform-gpu animate-in fade-in zoom-in-95 duration-200 ease-out sm:mx-4 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id="expense-modal-title" className="text-base font-bold">
              지출/정산 등록
            </h2>
            <p className="text-xs text-muted-foreground">영수증 스캔 또는 수기 입력</p>
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

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as "scan" | "manual")}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          {!fixedTripId ? (
            <div className="px-5 pt-4">
              <Field>
                <FieldLabel>여행</FieldLabel>
                <Select
                  items={trips.map((t) => ({ value: t.id, label: t.title }))}
                  value={selectedTripId}
                  onValueChange={(value) => setSelectedTripId(value as string)}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue placeholder="여행을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {trips.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {trips.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    먼저 여행을 등록해야 지출을 저장할 수 있어요.
                  </p>
                ) : null}
              </Field>
            </div>
          ) : null}

          <div className="px-5 pt-4">
            <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-secondary p-1">
              <TabsTrigger
                value="scan"
                className="rounded-lg text-xs font-semibold data-active:bg-primary data-active:text-primary-foreground sm:text-sm"
              >
                <ScanLine data-icon="inline-start" />
                영수증 스캔
              </TabsTrigger>
              <TabsTrigger
                value="manual"
                className="rounded-lg text-xs font-semibold data-active:bg-primary data-active:text-primary-foreground sm:text-sm"
              >
                직접 입력
              </TabsTrigger>
            </TabsList>
          </div>

          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <TabsContent value="scan" className="mt-0 flex flex-col gap-4">
                <ReceiptScanPanel
                  preview={draft.receiptPreview}
                  scanning={scanning}
                  onCamera={() => cameraInputRef.current?.click()}
                  onGallery={() => galleryInputRef.current?.click()}
                  onClear={clearReceipt}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    processReceiptFile(event.target.files?.[0])
                    event.target.value = ""
                  }}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    processReceiptFile(event.target.files?.[0])
                    event.target.value = ""
                  }}
                />
                <p className="text-center text-[11px] text-muted-foreground">
                  저장 시 영수증 이미지가 Storage에 업로드되고 지출에 연결돼요.
                </p>
              </TabsContent>

              <TabsContent value="manual" className="mt-0 flex flex-col gap-4">
                {ocrNotice ? (
                  <div className="flex items-start gap-2 rounded-xl bg-primary/15 px-3 py-2.5 text-xs font-medium text-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {ocrNotice}
                  </div>
                ) : null}
                {draft.receiptPreview ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draft.receiptPreview}
                      alt="영수증 미리보기"
                      className="size-14 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">첨부된 영수증</p>
                      <p className="text-[11px] text-muted-foreground">
                        저장 시 Storage에 업로드됩니다
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 font-semibold">
                      OCR
                    </Badge>
                  </div>
                ) : null}
                <ExpenseFormFields
                  draft={draft}
                  members={memberOptions}
                  allSplitSelected={allSplitSelected}
                  liveShare={liveShare}
                  onChange={update}
                  onToggleSplit={toggleSplitMember}
                  onToggleAllSplit={toggleAllSplitMembers}
                />
              </TabsContent>
            </div>

            <div className="border-t border-border bg-card px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {liveShare > 0 && draft.splitMemberIds.length > 0 ? (
                <p className="mb-3 text-center text-xs font-medium text-muted-foreground transition-opacity duration-300">
                  1인당 {formatWon(liveShare)} (총 {draft.splitMemberIds.length}명)
                </p>
              ) : null}
              {formError ? (
                <p className="mb-3 text-center text-xs font-medium text-destructive">{formError}</p>
              ) : null}
              {tab === "scan" && !draft.receiptPreview ? (
                <Button
                  type="button"
                  className="w-full rounded-full font-semibold"
                  onClick={() => setTab("manual")}
                  variant="outline"
                >
                  사진 없이 직접 입력하기
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!canSubmit || scanning || saving}
                  className="w-full rounded-full font-semibold"
                >
                  {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                  {saving ? "저장 중…" : "지출 저장하기"}
                </Button>
              )}
            </div>
          </form>
        </Tabs>
      </div>
    </div>
  )
}

function ReceiptScanPanel({
  preview,
  scanning,
  onCamera,
  onGallery,
  onClear,
}: {
  preview: string | null
  scanning: boolean
  onCamera: () => void
  onGallery: () => void
  onClear: () => void
}) {
  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="선택한 영수증" className="max-h-64 w-full object-contain" />
        {scanning ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 text-white">
            <Loader2 className="size-8 animate-spin" />
            <p className="text-sm font-semibold">영수증을 읽는 중…</p>
            <p className="text-xs opacity-80">AI가 금액·상호·날짜를 읽고 있어요</p>
          </div>
        ) : null}
        {!scanning ? (
          <div className="absolute top-2 right-2 flex gap-2">
            <Button type="button" size="sm" variant="secondary" className="rounded-full" onClick={onClear}>
              다시 선택
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onCamera}
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-secondary/50 px-4 py-10 transition-colors hover:bg-secondary"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Camera className="size-6" />
        </span>
        <span className="text-sm font-semibold">카메라로 영수증 촬영</span>
        <span className="text-xs text-muted-foreground">촬영 후 자동으로 항목을 채워 드려요</span>
      </button>
      <Button type="button" variant="outline" className="rounded-full font-semibold" onClick={onGallery}>
        <ImagePlus data-icon="inline-start" />
        앨범에서 이미지 업로드
      </Button>
    </div>
  )
}

function ExpenseFormFields({
  draft,
  members,
  allSplitSelected,
  liveShare,
  onChange,
  onToggleSplit,
  onToggleAllSplit,
}: {
  draft: ExpenseDraft
  members: MemberOption[]
  allSplitSelected: boolean
  liveShare: number
  onChange: <K extends keyof ExpenseDraft>(key: K, value: ExpenseDraft[K]) => void
  onToggleSplit: (id: string, checked: boolean) => void
  onToggleAllSplit: () => void
}) {
  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor="expense-amount">결제 금액</FieldLabel>
        <Input
          id="expense-amount"
          inputMode="numeric"
          placeholder="예: 12800"
          value={draft.amount}
          onChange={(event) => onChange("amount", event.target.value.replace(/[^\d]/g, ""))}
          className="rounded-xl"
          required
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="expense-store">사용처 / 가게 이름</FieldLabel>
        <Input
          id="expense-store"
          placeholder="예: 도톤보리 타코야키"
          value={draft.storeName}
          onChange={(event) => onChange("storeName", event.target.value)}
          className="rounded-xl"
          required
        />
      </Field>

      <Field>
        <FieldLabel>카테고리</FieldLabel>
        <Select
          items={CATEGORIES.map((item) => ({ value: item, label: item }))}
          value={draft.category}
          onValueChange={(value) => onChange("category", value as string)}
        >
          <SelectTrigger className="w-full rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="expense-paid-at">결제한 날짜 및 시간</FieldLabel>
        <Input
          id="expense-paid-at"
          type="datetime-local"
          value={draft.paidAt}
          onChange={(event) => onChange("paidAt", event.target.value)}
          className="rounded-xl"
          required
        />
      </Field>

      <Field>
        <FieldLabel>결제한 사람</FieldLabel>
        <Select
          items={members.map((m) => ({ value: m.id, label: m.name }))}
          value={draft.paidById}
          onValueChange={(value) => onChange("paidById", value as string)}
        >
          <SelectTrigger className="w-full rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>정산 대상자 (누가 함께 냈나요?)</FieldLabel>
          <button
            type="button"
            onClick={onToggleAllSplit}
            className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
          >
            {allSplitSelected ? "전체 해제" : "전체 선택"}
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {members.map((member) => {
            const checked = draft.splitMemberIds.includes(member.id)
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => onToggleSplit(member.id, !checked)}
                aria-pressed={checked}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                  checked
                    ? "border-primary/40 bg-primary/15 text-foreground shadow-sm"
                    : "border-border bg-secondary/40 text-muted-foreground line-through decoration-muted-foreground/40"
                )}
              >
                <Avatar className="size-5">
                  {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
                  <AvatarFallback className={cn("text-[9px] font-bold", member.color)}>
                    {member.initials || initialsFromNickname(member.name)}
                  </AvatarFallback>
                </Avatar>
                {member.name}
              </button>
            )
          })}
        </div>
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            liveShare > 0 && draft.splitMemberIds.length > 0
              ? "mt-2 max-h-12 opacity-100"
              : "max-h-0 opacity-0"
          )}
        >
          <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-foreground">
            1인당 {formatWon(liveShare)} (총 {draft.splitMemberIds.length}명)
          </p>
        </div>
      </Field>
    </FieldGroup>
  )
}
