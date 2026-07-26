"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Pencil,
  ScanLine,
  X,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { members } from "@/lib/trip-data"
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

const CATEGORIES = ["식비", "숙박", "교통", "관광", "기타"] as const

function toLocalDateTimeValue(date = new Date()) {
  const pad = (n: number) => `${n}`.padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function emptyDraft(): ExpenseDraft {
  return {
    amount: "",
    storeName: "",
    category: "식비",
    paidAt: toLocalDateTimeValue(),
    paidById: members[0]?.id ?? "",
    splitMemberIds: members.map((m) => m.id),
    receiptPreview: null,
  }
}

/** Mock OCR result — replaced later by real AI OCR. */
function mockOcrFromImage(_file: File): Pick<
  ExpenseDraft,
  "amount" | "storeName" | "category" | "paidAt"
> {
  const sampleStores = ["도톤보리 타코야키", "세븐일레븐 우메다", "Kigawa", "JR 하루카"]
  const sampleAmounts = ["12800", "2460", "42000", "18500"]
  const idx = Math.floor(Math.random() * sampleStores.length)
  return {
    amount: sampleAmounts[idx],
    storeName: sampleStores[idx],
    category: idx === 3 ? "교통" : "식비",
    paidAt: toLocalDateTimeValue(),
  }
}

export function ExpenseRegisterModal({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (draft: ExpenseDraft) => void
}) {
  const [tab, setTab] = useState<"scan" | "manual">("scan")
  const [draft, setDraft] = useState<ExpenseDraft>(emptyDraft)
  const [scanning, setScanning] = useState(false)
  const [ocrNotice, setOcrNotice] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const scanTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    setTab("scan")
    setDraft(emptyDraft())
    setScanning(false)
    setOcrNotice(null)
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
      if (scanTimer.current) window.clearTimeout(scanTimer.current)
    }
  }, [open, onOpenChange])

  const canSubmit = useMemo(() => {
    const amount = Number(draft.amount.replace(/,/g, ""))
    return (
      Number.isFinite(amount) &&
      amount > 0 &&
      draft.storeName.trim().length > 0 &&
      draft.paidById &&
      draft.splitMemberIds.length > 0
    )
  }, [draft])

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

  const processReceiptFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return
    if (scanTimer.current) window.clearTimeout(scanTimer.current)

    const previewUrl = URL.createObjectURL(file)
    update("receiptPreview", previewUrl)
    setScanning(true)
    setOcrNotice(null)

    scanTimer.current = window.setTimeout(() => {
      const extracted = mockOcrFromImage(file)
      setDraft((current) => ({
        ...current,
        ...extracted,
        receiptPreview: previewUrl,
      }))
      setScanning(false)
      setOcrNotice("영수증에서 내용을 불러왔어요. 직접 수정할 수 있어요.")
      setTab("manual")
    }, 1400)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    onSaved?.(draft)
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex w-full max-w-md items-end sm:items-center">
      <button
        type="button"
        aria-label="모달 닫기"
        className="absolute inset-0 bg-black/45 animate-in fade-in-0"
        onClick={() => onOpenChange(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-modal-title"
        className="relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom-4 duration-300 sm:mx-4 sm:rounded-3xl"
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
                <Pencil data-icon="inline-start" />
                직접 수기 입력
              </TabsTrigger>
            </TabsList>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <TabsContent value="scan" className="mt-0 flex flex-col gap-4">
                <ReceiptScanPanel
                  preview={draft.receiptPreview}
                  scanning={scanning}
                  onCamera={() => cameraInputRef.current?.click()}
                  onGallery={() => galleryInputRef.current?.click()}
                  onClear={() => {
                    update("receiptPreview", null)
                    setOcrNotice(null)
                    setScanning(false)
                  }}
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
                  사진은 기기에서만 미리보기되며, 추후 AI OCR과 연동될 예정이에요.
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
                      <p className="text-[11px] text-muted-foreground">값을 확인·수정한 뒤 저장하세요</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 font-semibold">
                      OCR
                    </Badge>
                  </div>
                ) : null}
                <ExpenseFormFields
                  draft={draft}
                  onChange={update}
                  onToggleSplit={toggleSplitMember}
                />
              </TabsContent>
            </div>

            <div className="border-t border-border bg-card px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
                  disabled={!canSubmit || scanning}
                  className="w-full rounded-full font-semibold"
                >
                  지출 저장하기
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
            <p className="text-xs opacity-80">AI OCR 준비 중 · 샘플 값으로 채워요</p>
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
  onChange,
  onToggleSplit,
}: {
  draft: ExpenseDraft
  onChange: <K extends keyof ExpenseDraft>(key: K, value: ExpenseDraft[K]) => void
  onToggleSplit: (id: string, checked: boolean) => void
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
        <FieldLabel>함께 정산할 동행 멤버</FieldLabel>
        <ul className="flex flex-col gap-2 rounded-xl border border-border p-2">
          {members.map((member) => {
            const checked = draft.splitMemberIds.includes(member.id)
            return (
              <li key={member.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors",
                    checked ? "bg-primary/10" : "hover:bg-secondary/60"
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => onToggleSplit(member.id, value === true)}
                  />
                  <Avatar className="size-8">
                    <AvatarFallback className={cn("text-xs font-bold", member.color)}>
                      {member.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{member.name}</span>
                </label>
              </li>
            )
          })}
        </ul>
      </Field>
    </FieldGroup>
  )
}
