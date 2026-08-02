"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeftRight,
  ArrowRight,
  Building2,
  Camera,
  Car,
  Check,
  CheckCircle2,
  LayoutGrid,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Receipt,
  ReceiptText,
  ScanLine,
  ShoppingBag,
  Utensils,
  Wallet,
  X,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { calcPerPerson } from "@/lib/settlement-math"
import { parseReceiptImage, type ParsedReceiptItem } from "@/lib/parse-receipt"
import {
  fetchSettlementMembers,
  fetchTripExpenses,
  fetchTripSettlements,
  formatExpenseDateLabel,
  formatExpenseSplitLabel,
  formatWon,
  initialsFromNickname,
  insertExpense,
  syncSettlementsForTrip,
  toggleSettlementStatus,
  uploadReceiptImage,
  type ExpenseCategory,
  type ExpenseRecord,
  type SettlementMember,
  type SettlementRecord,
} from "@/lib/settlements-api"
import { useTrips } from "@/components/trips-store"
import { setTripSettledFlag } from "@/lib/trip-settled"
import {
  EMPTY_PAYOUT_ACCOUNT,
  hasAnyPayout,
  hasBankPayout,
  hasCryptoPayout,
  type PayoutAccount,
} from "@/lib/payout-account"
import { shareSettlementSummary } from "@/lib/kakao-share"
import {
  fetchTripSettleStatus,
  fetchUserPayoutAccount,
  patchTripSettleStatus,
} from "@/lib/user-api"
import { cn } from "@/lib/utils"

type SettlementViewProps = {
  tripId?: string | null
  tripTitle?: string | null
  /** Optional: go back to trip picker (e.g. /settlement). */
  onChangeTrip?: () => void
}

type PanelTab = "all" | "transfers" | "expenses"

const PANEL_TABS: {
  key: PanelTab
  label: string
  icon: typeof LayoutGrid
}[] = [
  { key: "all", label: "전체 보기", icon: LayoutGrid },
  { key: "transfers", label: "송금 현황만", icon: ArrowLeftRight },
  { key: "expenses", label: "지출 내역만", icon: ReceiptText },
]

const CATEGORY_CHIPS: {
  value: ExpenseCategory
  label: string
  chipId: string
  Icon: typeof Utensils
}[] = [
  { chipId: "식사", value: "식사", label: "식사", Icon: Utensils },
  { chipId: "교통", value: "교통", label: "교통", Icon: Car },
  { chipId: "숙소", value: "숙소", label: "숙소", Icon: Building2 },
  { chipId: "쇼핑", value: "기타", label: "쇼핑", Icon: ShoppingBag },
  { chipId: "기타", value: "기타", label: "기타", Icon: MoreHorizontal },
]

function todayIsoDate() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = `${now.getMonth() + 1}`.padStart(2, "0")
  const dd = `${now.getDate()}`.padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

/** One row in the multi-item receipt review list. */
type ReviewItem = {
  id: number
  title: string
  amount: string
  chipId: string
  date: string
  selected: boolean
}

function chipIdToCategory(chipId: string): ExpenseCategory {
  const match = CATEGORY_CHIPS.find((chip) => chip.chipId === chipId)
  return match?.value ?? "기타"
}

let reviewItemSeq = 0
function toReviewItem(item: ParsedReceiptItem): ReviewItem {
  reviewItemSeq += 1
  const chipId = CATEGORY_CHIPS.some((chip) => chip.chipId === item.category)
    ? item.category
    : "기타"
  return {
    id: reviewItemSeq,
    title: item.title,
    amount: String(Math.round(item.amount)),
    chipId,
    date: /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : todayIsoDate(),
    selected: true,
  }
}

export function SettlementView({
  tripId = null,
  tripTitle = null,
  onChangeTrip,
}: SettlementViewProps) {
  const activeTripId = String(tripId ?? "").trim() || null
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshTrips, setTripSettledStatus } = useTrips()

  const [members, setMembers] = useState<SettlementMember[]>([])
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [settlements, setSettlements] = useState<SettlementRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<PanelTab>("all")
  const [tripSettled, setTripSettled] = useState(false)
  const [settlingTrip, setSettlingTrip] = useState(false)
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccount>(EMPTY_PAYOUT_ACCOUNT)
  const [sharing, setSharing] = useState(false)

  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ExpenseCategory>("식사")
  const [categoryChipId, setCategoryChipId] = useState("식사")
  const [payerId, setPayerId] = useState("")
  const [expenseDate, setExpenseDate] = useState(todayIsoDate())
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [scanningReceipt, setScanningReceipt] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [receiptViewerUrl, setReceiptViewerUrl] = useState<string | null>(null)
  // 한 영수증(카드/은행 앱 거래내역 캡처 등)에 여러 건이 있을 때의 일괄 등록 검토 목록.
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const receiptInputRef = useRef<HTMLInputElement>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)
  const receiptPreviewRef = useRef<string | null>(null)

  // 퀵등록의 "지출 추가"에서 넘어온 경우 (?addExpense=1) 지출 입력 다이얼로그를 바로 연다.
  useEffect(() => {
    if (!activeTripId) return
    if (searchParams.get("addExpense") !== "1") return
    if (tripSettled) return
    setOpen(true)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("addExpense")
    const qs = params.toString()
    router.replace(qs ? `/settlement/${activeTripId}?${qs}` : `/settlement/${activeTripId}`)
  }, [activeTripId, searchParams, tripSettled, router])

  const membersById = useMemo(() => {
    const map = new Map<string, SettlementMember>()
    for (const member of members) map.set(member.userId, member)
    return map
  }, [members])

  const showToast = useCallback((message: string, durationMs = 2200) => {
    setToast(message)
    window.setTimeout(() => {
      setToast((current) => (current === message ? null : current))
    }, durationMs)
  }, [])

  const refreshSettlementData = useCallback(async () => {
    if (!activeTripId) {
      setMembers([])
      setExpenses([])
      setSettlements([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [loadedMembers, loadedExpenses, loadedSettlements] = await Promise.all([
        fetchSettlementMembers(activeTripId),
        fetchTripExpenses(activeTripId),
        fetchTripSettlements(activeTripId),
      ])

      setMembers(loadedMembers)
      setExpenses(loadedExpenses)

      const memberIds = loadedMembers.map((member) => member.userId)
      const synced = await syncSettlementsForTrip(
        activeTripId,
        memberIds,
        loadedExpenses,
        loadedSettlements
      )
      setSettlements(synced)
    } catch (err) {
      const typed = err as { message?: string; details?: string; hint?: string }
      console.error(
        "[SettlementView] refresh failed:",
        typed?.message,
        typed?.details,
        typed?.hint
      )
      setError("정산 데이터를 불러오지 못했어요.")
    } finally {
      setLoading(false)
    }
  }, [activeTripId])

  useEffect(() => {
    void refreshSettlementData()
  }, [refreshSettlementData])

  useEffect(() => {
    if (!activeTripId) {
      setTripSettled(false)
      return
    }
    let cancelled = false
    void (async () => {
      const status = await fetchTripSettleStatus(activeTripId)
      if (cancelled) return
      setTripSettled(status.isSettled)
      // Sync store + local cache from DB (api/client), not optimistic-only local.
      if (status.source === "api" || status.source === "client") {
        setTripSettledFlag(activeTripId, status.isSettled)
        setTripSettledStatus(activeTripId, status.isSettled)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeTripId, setTripSettledStatus])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await fetchUserPayoutAccount()
      if (cancelled) return
      setPayoutAccount(result.account)
    })()
    const onPayout = () => {
      void fetchUserPayoutAccount().then((result) => setPayoutAccount(result.account))
    }
    window.addEventListener("withtrip:payout-account", onPayout)
    window.addEventListener("storage", onPayout)
    return () => {
      cancelled = true
      window.removeEventListener("withtrip:payout-account", onPayout)
      window.removeEventListener("storage", onPayout)
    }
  }, [])

  useEffect(() => {
    if (!payerId && members[0]?.userId) {
      setPayerId(members[0].userId)
    }
    if (members.length > 0 && participantIds.length === 0) {
      setParticipantIds(members.map((member) => member.userId))
    }
  }, [members, payerId, participantIds.length])

  const total = useMemo(
    () => expenses.reduce((sum, item) => sum + item.amount, 0),
    [expenses]
  )
  const memberCount = members.length
  const perPerson = calcPerPerson(total, memberCount)

  const parsedAmount = useMemo(() => {
    const value = Number(String(amount).replace(/,/g, ""))
    return Number.isFinite(value) && value > 0 ? value : 0
  }, [amount])

  const selectedParticipantCount = participantIds.length
  const liveShare =
    selectedParticipantCount > 0 && parsedAmount > 0
      ? calcPerPerson(parsedAmount, selectedParticipantCount)
      : 0

  const allParticipantsSelected =
    members.length > 0 && participantIds.length === members.length

  const toggleParticipant = (userId: string) => {
    setParticipantIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    )
  }

  const toggleAllParticipants = () => {
    if (allParticipantsSelected) {
      setParticipantIds([])
    } else {
      setParticipantIds(members.map((member) => member.userId))
    }
  }

  const resetForm = () => {
    setTitle("")
    setAmount("")
    setCategory("식사")
    setCategoryChipId("식사")
    setPayerId(members[0]?.userId ?? "")
    setExpenseDate(todayIsoDate())
    setParticipantIds(members.map((member) => member.userId))
    setReceiptFile(null)
    if (receiptPreviewRef.current) {
      URL.revokeObjectURL(receiptPreviewRef.current)
      receiptPreviewRef.current = null
    }
    setReceiptPreview(null)
    setScanningReceipt(false)
    setFormError(null)
    setReviewItems([])
  }

  const applyParsedCategory = useCallback((raw: string) => {
    const value = String(raw ?? "").trim()
    if (value === "쇼핑") {
      setCategoryChipId("쇼핑")
      setCategory("기타")
      return
    }
    if (value === "식사" || value === "교통" || value === "숙소" || value === "기타") {
      setCategoryChipId(value)
      setCategory(value)
    }
  }, [])

  const handleReceiptScan = useCallback(
    async (file: File | undefined) => {
      if (!file || !file.type.startsWith("image/")) return

      if (receiptPreviewRef.current) {
        URL.revokeObjectURL(receiptPreviewRef.current)
        receiptPreviewRef.current = null
      }
      const previewUrl = URL.createObjectURL(file)
      receiptPreviewRef.current = previewUrl
      setReceiptFile(file)
      setReceiptPreview(previewUrl)
      setScanningReceipt(true)
      setFormError(null)
      setReviewItems([])

      try {
        const { items } = await parseReceiptImage(file)
        if (items.length > 1) {
          // 카드/은행 앱 거래내역처럼 한 이미지에 여러 건 — 검토 목록으로 전환.
          setReviewItems(items.map(toReviewItem))
          showToast(
            `영수증에서 ${items.length}건의 지출을 찾았어요. 등록할 항목을 확인해 주세요.`
          )
        } else {
          const data = items[0]
          if (data.title) setTitle(data.title)
          if (data.amount > 0) setAmount(String(Math.round(data.amount)))
          if (data.category) applyParsedCategory(data.category)
          if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
            setExpenseDate(data.date)
          }
          showToast("영수증에서 내용을 불러왔어요. 필요하면 수정해 주세요.")
        }
      } catch (err) {
        const typed = err as { message?: string }
        console.error("[SettlementView] receipt scan failed:", typed?.message)
        showToast("영수증 정보를 읽지 못했습니다. 직접 입력해 주세요.")
      } finally {
        setScanningReceipt(false)
      }
    },
    [applyParsedCategory, showToast]
  )

  const updateReviewItem = (id: number, patch: Partial<ReviewItem>) => {
    setReviewItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  const toggleReviewItem = (id: number) => {
    setReviewItems((current) =>
      current.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    )
  }

  const removeReviewItem = (id: number) => {
    setReviewItems((current) => current.filter((item) => item.id !== id))
  }

  const selectedReviewItems = useMemo(
    () => reviewItems.filter((item) => item.selected),
    [reviewItems]
  )

  const reviewItemsTotal = useMemo(
    () => selectedReviewItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [selectedReviewItems]
  )

  const handleAddExpense = async (event: React.FormEvent) => {
    event.preventDefault()
    if (scanningReceipt) return
    if (!activeTripId) {
      setFormError("사이드바에서 여행을 선택해 주세요.")
      return
    }
    const parsed = Number(String(amount).replace(/,/g, ""))
    if (!title.trim()) {
      setFormError("지출 항목명을 입력해 주세요.")
      return
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setFormError("올바른 결제 금액을 입력해 주세요.")
      return
    }
    if (!payerId) {
      setFormError("결제자를 선택해 주세요.")
      return
    }
    if (!expenseDate) {
      setFormError("날짜를 선택해 주세요.")
      return
    }
    if (participantIds.length === 0) {
      setFormError("정산 대상자를 한 명 이상 선택해 주세요.")
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      let receiptUrl: string | undefined
      if (receiptFile) {
        receiptUrl = await uploadReceiptImage(receiptFile, activeTripId)
      }
      await insertExpense({
        tripId: activeTripId,
        title: title.trim(),
        amount: parsed,
        category,
        payerId,
        expenseDate,
        receiptUrl,
        participantIds,
      })
      resetForm()
      setOpen(false)
      await refreshSettlementData()
      showToast("지출이 등록되었어요.")
    } catch (err) {
      const typed = err as { message?: string }
      console.error("[SettlementView] insert expense failed:", typed?.message)
      setFormError(
        typed?.message?.toLowerCase().includes("bucket") ||
          typed?.message?.toLowerCase().includes("receipts")
          ? "영수증 업로드에 실패했어요. Storage 버킷(receipts)을 확인해 주세요."
          : typed?.message?.toLowerCase().includes("expense_participants")
            ? "정산 대상자 저장에 실패했어요. expense_participants 테이블을 확인해 주세요."
            : "지출 등록에 실패했어요."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleBulkAddExpense = async (event: React.FormEvent) => {
    event.preventDefault()
    if (scanningReceipt) return
    if (!activeTripId) {
      setFormError("사이드바에서 여행을 선택해 주세요.")
      return
    }
    if (selectedReviewItems.length === 0) {
      setFormError("등록할 항목을 하나 이상 선택해 주세요.")
      return
    }
    if (!payerId) {
      setFormError("결제자를 선택해 주세요.")
      return
    }
    if (participantIds.length === 0) {
      setFormError("정산 대상자를 한 명 이상 선택해 주세요.")
      return
    }
    for (const item of selectedReviewItems) {
      if (!item.title.trim()) {
        setFormError("모든 항목의 지출명을 입력해 주세요.")
        return
      }
      if (!Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0) {
        setFormError("모든 항목의 금액을 올바르게 입력해 주세요.")
        return
      }
      if (!item.date) {
        setFormError("모든 항목의 날짜를 입력해 주세요.")
        return
      }
    }

    setSubmitting(true)
    setFormError(null)
    try {
      let receiptUrl: string | undefined
      if (receiptFile) {
        receiptUrl = await uploadReceiptImage(receiptFile, activeTripId)
      }
      // 순차 등록 — 각 지출이 독립적으로 실패해도 원인을 바로 알 수 있게.
      for (const item of selectedReviewItems) {
        await insertExpense({
          tripId: activeTripId,
          title: item.title.trim(),
          amount: Number(item.amount),
          category: chipIdToCategory(item.chipId),
          payerId,
          expenseDate: item.date,
          receiptUrl,
          participantIds,
        })
      }
      const count = selectedReviewItems.length
      resetForm()
      setOpen(false)
      await refreshSettlementData()
      showToast(`${count}건의 지출이 등록되었어요.`)
    } catch (err) {
      const typed = err as { message?: string }
      console.error("[SettlementView] bulk insert expense failed:", typed?.message)
      setFormError(
        typed?.message?.toLowerCase().includes("bucket") ||
          typed?.message?.toLowerCase().includes("receipts")
          ? "영수증 업로드에 실패했어요. Storage 버킷(receipts)을 확인해 주세요."
          : typed?.message?.toLowerCase().includes("expense_participants")
            ? "정산 대상자 저장에 실패했어요. expense_participants 테이블을 확인해 주세요."
            : "일부 지출 등록에 실패했어요. 다시 시도해 주세요."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleSettlement = async (row: SettlementRecord) => {
    const nextStatus = row.status === "completed" ? "pending" : "completed"
    setSettlements((prev) =>
      prev.map((item) => (item.id === row.id ? { ...item, status: nextStatus } : item))
    )
    setTogglingId(row.id)
    try {
      await toggleSettlementStatus(row.id, nextStatus)
    } catch (err) {
      const typed = err as { message?: string }
      console.error("[SettlementView] toggle failed:", typed?.message)
      setSettlements((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, status: row.status } : item))
      )
      showToast("송금 상태 변경에 실패했어요.")
    } finally {
      setTogglingId(null)
    }
  }

  const handleToggleTripSettled = async () => {
    if (!activeTripId || settlingTrip) return
    const next = !tripSettled
    setSettlingTrip(true)
    try {
      if (next) {
        const pending = settlements.filter((row) => row.status !== "completed")
        await Promise.all(
          pending.map((row) => toggleSettlementStatus(row.id, "completed"))
        )
        if (pending.length > 0) {
          setSettlements((prev) =>
            prev.map((item) => ({ ...item, status: "completed" as const }))
          )
        }
      }
      const result = await patchTripSettleStatus(activeTripId, next)
      if (!result.ok) {
        showToast(result.error || "정산 상태를 DB에 저장하지 못했어요.")
        return
      }
      setTripSettled(result.isSettled)
      setTripSettledStatus(activeTripId, result.isSettled)
      // Re-fetch trips so the sub-panel lists use persisted is_settled.
      await refreshTrips({ silent: true })
      showToast(
        result.isSettled ? "이 여행 정산을 완료했어요." : "정산을 다시 열었어요."
      )
    } catch (err) {
      const typed = err as { message?: string }
      console.error("[SettlementView] trip settle toggle failed:", typed?.message)
      showToast("정산 상태 변경에 실패했어요.")
    } finally {
      setSettlingTrip(false)
    }
  }

  const handleShareSettlement = async () => {
    if (sharing) return
    setSharing(true)
    try {
      const result = await shareSettlementSummary({
        tripTitle: tripTitle?.trim() || "여행 정산",
        total,
        perPerson,
        memberCount,
        account: payoutAccount,
        shareUrl:
          typeof window !== "undefined" ? window.location.href : undefined,
      })
      if (result === "kakao") {
        showToast("카카오톡 공유 창을 열었어요.")
      } else if (result === "clipboard") {
        showToast(
          "정산 내역 및 계좌 정보가 클립보드에 복사되었습니다. 카카오톡 채팅방에 붙여넣어(Ctrl+V) 공유하세요!",
          4500
        )
      } else {
        showToast("공유에 실패했어요. 다시 시도해 주세요.")
      }
    } finally {
      setSharing(false)
    }
  }

  const showTransfers = activeTab === "all" || activeTab === "transfers"
  const showExpenses = activeTab === "all" || activeTab === "expenses"

  if (!activeTripId) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-200 bg-[#FAFAFA] px-6 py-16 text-center">
        <Receipt className="size-8 text-neutral-400" />
        <p className="text-sm font-semibold text-neutral-800">정산할 여행을 선택해 주세요</p>
        <p className="text-sm text-neutral-500">
          정산 탭에서 참여 중인 여행을 고르면 지출·송금 내역을 확인할 수 있어요.
        </p>
        {onChangeTrip ? (
          <Button
            type="button"
            variant="outline"
            onClick={onChangeTrip}
            className="mt-1 rounded-full font-semibold"
          >
            여행 선택하기
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
        {/* Left panel — filters → payout → actions */}
        <aside className="md:col-span-4">
          <div className="flex flex-col gap-4 md:sticky md:top-4">
            <div className="min-w-0 px-0.5">
              <h2 className="truncate text-lg font-bold tracking-tight text-neutral-900">
                정산 관리
              </h2>
              <p className="truncate text-xs text-neutral-500">
                {tripTitle ? `「${tripTitle}」` : "선택한 여행"}
              </p>
            </div>

            {/* Compact totals */}
            <div className="rounded-2xl border border-neutral-100/80 bg-gradient-to-br from-amber-50/90 to-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-neutral-500">총지출</p>
                  <p className="mt-0.5 truncate text-xl font-extrabold tracking-tight text-neutral-900 tabular-nums">
                    {loading ? "—" : formatWon(total)}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[11px] font-medium text-neutral-500">1인당</p>
                  <p className="mt-0.5 truncate text-base font-bold tracking-tight text-neutral-800 tabular-nums">
                    {loading || memberCount === 0 ? "—" : formatWon(perPerson)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">
                {expenses.length}건 · {memberCount}명
              </p>
            </div>

            {/* 1. View filter tabs */}
            <nav
              aria-label="정산 보기 필터"
              className="rounded-2xl border border-neutral-100 bg-white p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              <ul className="flex flex-col gap-0.5">
                {PANEL_TABS.map((tab) => {
                  const isActive = activeTab === tab.key
                  return (
                    <li key={tab.key}>
                      <button
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200",
                          isActive
                            ? "bg-neutral-100 text-neutral-900"
                            : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg",
                            isActive ? "bg-white text-neutral-800 shadow-sm" : "bg-transparent text-neutral-400"
                          )}
                        >
                          <tab.icon className="size-4 stroke-[1.5]" />
                        </span>
                        {tab.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* 2. Payout account card */}
            <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                  <Wallet className="size-4 stroke-[1.5]" />
                </span>
                <p className="text-sm font-semibold text-neutral-900">내 수령 계좌</p>
              </div>
              {hasAnyPayout(payoutAccount) ? (
                <div className="flex flex-col gap-2.5 text-sm">
                  {hasBankPayout(payoutAccount) ? (
                    <div className="rounded-xl bg-neutral-50/90 px-3 py-2.5 ring-1 ring-neutral-100">
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                        <Building2 className="size-3.5 stroke-[1.5]" />
                        은행 계좌
                      </div>
                      <p className="font-semibold text-neutral-900">
                        {payoutAccount.bank.bankName}
                      </p>
                      <p className="tabular-nums text-neutral-700">
                        {payoutAccount.bank.accountNumber}
                      </p>
                      <p className="text-xs text-neutral-500">
                        예금주 {payoutAccount.bank.accountHolder}
                      </p>
                    </div>
                  ) : null}
                  {hasCryptoPayout(payoutAccount) ? (
                    <div className="rounded-xl bg-neutral-50/90 px-3 py-2.5 ring-1 ring-neutral-100">
                      <p className="mb-1 text-[11px] font-medium text-neutral-500">코인 지갑</p>
                      <p className="font-semibold text-neutral-900">
                        {payoutAccount.crypto.network}
                      </p>
                      <p className="break-all font-mono text-[11px] leading-relaxed text-neutral-600">
                        {payoutAccount.crypto.walletAddress}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm leading-relaxed text-neutral-500">
                    마이페이지에서 수령 계좌를 등록해 보세요.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.location.href = "/?nav=mypage"
                    }}
                    className="h-9 w-full rounded-xl border-neutral-200 font-semibold text-neutral-700 shadow-none hover:bg-neutral-50"
                  >
                    마이페이지로 이동
                  </Button>
                </div>
              )}
            </div>

            {/* 3. Action buttons */}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                onClick={() => setOpen(true)}
                disabled={tripSettled}
                className="h-11 w-full rounded-xl bg-amber-400 font-semibold text-neutral-900 shadow-[0_2px_8px_rgba(251,191,36,0.25)] transition-all duration-200 hover:bg-amber-500 active:scale-[0.98] disabled:opacity-50"
              >
                <Plus data-icon="inline-start" className="size-4 stroke-[2]" />
                지출 추가
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={settlingTrip || loading}
                onClick={() => void handleToggleTripSettled()}
                className={cn(
                  "h-11 w-full rounded-xl font-semibold shadow-none transition-all duration-200 active:scale-[0.98]",
                  tripSettled
                    ? "border-emerald-200/80 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
                )}
              >
                {settlingTrip ? (
                  <Loader2 data-icon="inline-start" className="size-4 animate-spin stroke-[1.75]" />
                ) : (
                  <CheckCircle2 data-icon="inline-start" className="size-4 stroke-[1.75]" />
                )}
                {tripSettled ? "정산 재개하기" : "정산 완료하기"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={sharing || loading}
                onClick={() => void handleShareSettlement()}
                className="h-11 w-full rounded-xl border-[#F5E6A3] bg-[#FEE500]/90 font-semibold text-[#191600] shadow-none transition-all duration-200 hover:bg-[#FEE500] active:scale-[0.98]"
              >
                {sharing ? (
                  <Loader2 data-icon="inline-start" className="size-4 animate-spin stroke-[1.75]" />
                ) : (
                  <MessageCircle data-icon="inline-start" className="size-4 stroke-[1.75]" />
                )}
                카카오톡으로 정산 공유하기
              </Button>
            </div>

            {toast ? (
              <div className="rounded-xl bg-neutral-900/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200">
                {toast}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <FieldError>{error}</FieldError>
              </div>
            ) : null}
          </div>
        </aside>

        {/* Right panel — detail */}
        <section className="md:col-span-8">
          <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-neutral-500">
                <Loader2 className="size-4 animate-spin" />
                정산 데이터를 불러오는 중…
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {showTransfers ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <h3 className="text-[15px] font-semibold text-neutral-900">송금 현황</h3>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          누가 누구에게 보내야 하는지 자동으로 계산돼요
                        </p>
                      </div>
                    </div>

                    {settlements.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
                        {memberCount < 2
                          ? "여행 멤버가 2명 이상일 때 송금 현황이 표시됩니다."
                          : "정산할 송금이 없습니다. 지출을 추가해 보세요."}
                      </div>
                    ) : (
                      <ul className="flex flex-col">
                        {settlements.map((transfer, index) => {
                          const from = membersById.get(transfer.fromUserId)
                          const to = membersById.get(transfer.toUserId)
                          const fromName = from?.nickname ?? "멤버"
                          const toName = to?.nickname ?? "멤버"
                          const isCompleted = transfer.status === "completed"
                          const isToggling = togglingId === transfer.id
                          return (
                            <li
                              key={transfer.id}
                              className={cn(
                                "flex items-center justify-between gap-3 py-4 transition-all duration-200",
                                index < settlements.length - 1 && "border-b border-neutral-100"
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex items-center gap-2 rounded-2xl bg-neutral-50 px-2.5 py-2 ring-1 ring-neutral-100">
                                  <Avatar className="size-9">
                                    {from?.avatarUrl ? (
                                      <AvatarImage src={from.avatarUrl} alt="" />
                                    ) : null}
                                    <AvatarFallback className="bg-neutral-200 text-[11px] font-bold text-neutral-700">
                                      {initialsFromNickname(fromName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <ArrowRight className="size-3.5 shrink-0 text-neutral-400" />
                                  <Avatar className="size-9">
                                    {to?.avatarUrl ? <AvatarImage src={to.avatarUrl} alt="" /> : null}
                                    <AvatarFallback className="bg-amber-400 text-[11px] font-bold text-neutral-900">
                                      {initialsFromNickname(toName)}
                                    </AvatarFallback>
                                  </Avatar>
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-neutral-900">
                                    {fromName}
                                    <span className="mx-1 font-normal text-neutral-400">→</span>
                                    {toName}
                                  </p>
                                  <p className="mt-0.5 text-sm font-bold tabular-nums text-neutral-800">
                                    {formatWon(transfer.amount)}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={isToggling}
                                onClick={() => void handleToggleSettlement(transfer)}
                                className={cn(
                                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95",
                                  isCompleted
                                    ? "bg-amber-400 text-neutral-900 hover:bg-amber-500"
                                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                                )}
                              >
                                {isToggling ? <Loader2 className="size-3 animate-spin" /> : null}
                                {isCompleted ? "완료" : "대기"}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}

                {showTransfers && showExpenses ? (
                  <div className="h-px bg-neutral-100" />
                ) : null}

                {showExpenses ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <h3 className="text-[15px] font-semibold text-neutral-900">지출 내역</h3>
                        <p className="mt-0.5 text-xs text-neutral-500">최신 등록순으로 표시됩니다</p>
                      </div>
                      <span className="text-xs font-medium tabular-nums text-neutral-500">
                        총 {expenses.length}건
                      </span>
                    </div>

                    {expenses.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-500">
                        등록된 지출이 없습니다. + 지출 추가로 기록해 보세요.
                      </div>
                    ) : (
                      <ul className="flex flex-col">
                        {expenses.map((expense, index) => (
                          <li
                            key={expense.id}
                            className={cn(
                              "flex items-start justify-between gap-4 py-4 transition-all duration-200",
                              index < expenses.length - 1 && "border-b border-neutral-100"
                            )}
                          >
                            <div className="flex min-w-0 items-start gap-3">
                              <Avatar className="size-11 shrink-0">
                                {expense.payerAvatarUrl ? (
                                  <AvatarImage src={expense.payerAvatarUrl} alt="" />
                                ) : null}
                                <AvatarFallback className="bg-amber-100 text-xs font-bold text-amber-900">
                                  {initialsFromNickname(expense.payerNickname)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-neutral-900">
                                    {expense.payerNickname}
                                  </span>
                                  <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                                    {expense.category}
                                  </span>
                                  {expense.receiptUrl ? (
                                    <button
                                      type="button"
                                      onClick={() => setReceiptViewerUrl(expense.receiptUrl!)}
                                      className="inline-flex size-7 items-center justify-center rounded-md text-base transition-colors hover:bg-amber-50"
                                      aria-label="영수증 보기"
                                      title="영수증 보기"
                                    >
                                      🧾
                                    </button>
                                  ) : null}
                                </div>
                                <p className="mt-1 truncate text-sm text-neutral-700">
                                  {expense.title}
                                </p>
                                <p className="mt-0.5 text-xs text-neutral-500">
                                  {expense.payerNickname} 결제 ·{" "}
                                  {formatExpenseSplitLabel(
                                    expense.participantIds.length > 0
                                      ? expense.participantIds
                                      : members.map((member) => member.userId),
                                    members.map((member) => ({
                                      userId: member.userId,
                                      nickname: member.nickname,
                                    }))
                                  )}{" "}
                                  · {formatExpenseDateLabel(expense.expenseDate)}
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 pt-0.5 text-sm font-bold tabular-nums text-neutral-900">
                              {formatWon(expense.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Add expense dialog */}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) {
            setParticipantIds(members.map((member) => member.userId))
          } else {
            resetForm()
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[90vh] w-full max-w-md flex-col gap-0 overflow-hidden rounded-3xl border border-gray-200 bg-white p-0 shadow-2xl sm:max-w-md"
        >
          <DialogHeader className="relative shrink-0 space-y-0.5 border-b border-gray-100 px-5 py-3.5 pr-12 text-left">
            <DialogTitle className="text-lg font-extrabold text-gray-900">
              지출 추가
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              함께 낸 지출을 기록하면 정산이 자동으로 계산돼요.
            </DialogDescription>
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="size-4" />
            </button>
          </DialogHeader>

          <form
            onSubmit={(event) =>
              void (reviewItems.length > 0
                ? handleBulkAddExpense(event)
                : handleAddExpense(event))
            }
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3.5">
              {/* Slim scan banner */}
              <button
                type="button"
                onClick={() => scanInputRef.current?.click()}
                disabled={scanningReceipt}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-yellow-400/50 bg-gray-50 p-2.5 transition-colors hover:bg-gray-100 disabled:cursor-wait disabled:opacity-80"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {scanningReceipt ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-yellow-600" />
                  ) : (
                    <ScanLine className="size-4 shrink-0 text-gray-700" />
                  )}
                  <span className="truncate text-left text-xs font-semibold text-gray-900">
                    {scanningReceipt ? "영수증 분석 중... ⏳" : "영수증 찍어서 바로 채우기"}
                  </span>
                </span>
                <span className="shrink-0 rounded-lg bg-yellow-400 px-2.5 py-1 text-[11px] font-bold text-gray-900">
                  {scanningReceipt ? "분석 중" : "스캔하기 >"}
                </span>
              </button>
              <input
                ref={scanInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={scanningReceipt}
                onChange={(event) => {
                  void handleReceiptScan(event.target.files?.[0])
                  event.target.value = ""
                }}
              />

              {reviewItems.length > 0 ? (
                <div className="flex flex-col gap-2 rounded-xl border border-yellow-400/50 bg-yellow-50/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-gray-900">
                      {reviewItems.length}건의 지출을 찾았어요
                    </p>
                    <span className="shrink-0 text-[11px] font-semibold text-gray-500">
                      선택 {selectedReviewItems.length}건 · {formatWon(reviewItemsTotal)}
                    </span>
                  </div>
                  <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
                    {reviewItems.map((item) => (
                      <li
                        key={item.id}
                        className={cn(
                          "flex flex-col gap-2 rounded-lg border bg-white p-2.5 transition-opacity",
                          item.selected
                            ? "border-gray-200"
                            : "border-gray-100 opacity-50"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={item.selected}
                            aria-label={item.selected ? "이 항목 제외" : "이 항목 포함"}
                            onClick={() => toggleReviewItem(item.id)}
                            className={cn(
                              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                              item.selected
                                ? "border-yellow-400 bg-yellow-400 text-gray-900"
                                : "border-gray-300 bg-white text-transparent"
                            )}
                          >
                            <Check className="size-3.5 stroke-[3]" />
                          </button>
                          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
                            <Input
                              value={item.title}
                              onChange={(event) =>
                                updateReviewItem(item.id, { title: event.target.value })
                              }
                              placeholder="상호명"
                              className="col-span-2 h-8 rounded-lg border-gray-200 bg-gray-50 px-2 text-xs shadow-none focus-visible:border-yellow-400 focus-visible:ring-1 focus-visible:ring-yellow-400/30"
                            />
                            <Input
                              inputMode="numeric"
                              value={item.amount}
                              onChange={(event) =>
                                updateReviewItem(item.id, {
                                  amount: event.target.value.replace(/[^\d]/g, ""),
                                })
                              }
                              placeholder="금액"
                              className="h-8 rounded-lg border-gray-200 bg-gray-50 px-2 text-xs tabular-nums shadow-none focus-visible:border-yellow-400 focus-visible:ring-1 focus-visible:ring-yellow-400/30"
                            />
                            <Input
                              type="date"
                              value={item.date}
                              onChange={(event) =>
                                updateReviewItem(item.id, { date: event.target.value })
                              }
                              className="h-8 rounded-lg border-gray-200 bg-gray-50 px-2 text-xs shadow-none focus-visible:border-yellow-400 focus-visible:ring-1 focus-visible:ring-yellow-400/30"
                            />
                          </div>
                          <button
                            type="button"
                            aria-label="항목 삭제"
                            onClick={() => removeReviewItem(item.id)}
                            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1 pl-7">
                          {CATEGORY_CHIPS.map((chip) => {
                            const selected = item.chipId === chip.chipId
                            const Icon = chip.Icon
                            return (
                              <button
                                key={chip.chipId}
                                type="button"
                                onClick={() => updateReviewItem(item.id, { chipId: chip.chipId })}
                                className={cn(
                                  "inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors",
                                  selected
                                    ? "bg-yellow-400 font-bold text-gray-900"
                                    : "bg-gray-100 font-medium text-gray-600 hover:bg-gray-200"
                                )}
                              >
                                <Icon className="size-3 stroke-[1.75]" />
                                {chip.label}
                              </button>
                            )
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setReviewItems([])}
                    className="self-start text-[11px] font-semibold text-gray-500 underline underline-offset-2 hover:text-gray-800"
                  >
                    대신 직접 한 건씩 입력할래요
                  </button>
                </div>
              ) : null}

              {reviewItems.length === 0 ? (
                <>
                  {/* Amount — compact high contrast */}
              <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="expense-amount"
                      className="text-[11px] font-semibold text-gray-700"
                    >
                      지출 금액
                    </label>
                    <div className="mt-0.5 flex items-center gap-1">
                      <span className="text-2xl font-bold text-gray-900">₩</span>
                      <Input
                        id="expense-amount"
                        inputMode="numeric"
                        value={amount}
                        onChange={(event) =>
                          setAmount(event.target.value.replace(/[^\d]/g, ""))
                        }
                        placeholder="0"
                        className="h-auto border-0 bg-transparent p-0 text-2xl font-bold text-gray-900 shadow-none placeholder:text-gray-300 focus-visible:ring-0"
                        required
                      />
                    </div>
                  </div>
                  {parsedAmount > 0 && selectedParticipantCount > 0 ? (
                    <span className="shrink-0 rounded-full border border-yellow-400/40 bg-yellow-400/15 px-2 py-1 text-[11px] font-semibold text-yellow-600">
                      1인당 약 {formatWon(liveShare).replace("원", "")}원
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1">
                <label htmlFor="expense-title" className="text-[11px] font-semibold text-gray-700">
                  지출 항목명
                </label>
                <Input
                  id="expense-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="예: 디너, 택시비, 호텔"
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 shadow-none placeholder:text-gray-400 focus-visible:border-yellow-400 focus-visible:ring-2 focus-visible:ring-yellow-400/30"
                  required
                />
              </div>

              {/* Category — monochrome chips */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-gray-700">카테고리</span>
                <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {CATEGORY_CHIPS.map((chip) => {
                    const selected = categoryChipId === chip.chipId
                    const Icon = chip.Icon
                    return (
                      <button
                        key={chip.chipId}
                        type="button"
                        onClick={() => {
                          setCategoryChipId(chip.chipId)
                          setCategory(chip.value)
                        }}
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs transition-colors",
                          selected
                            ? "border-none bg-yellow-400 font-bold text-gray-900"
                            : "bg-gray-100 font-medium text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        <Icon className="size-3.5 stroke-[1.75]" />
                        {chip.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Payer + Date row */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-gray-700">결제자</span>
                  <Select
                    items={members.map((member) => ({
                      value: member.userId,
                      label: member.nickname,
                    }))}
                    value={payerId}
                    onValueChange={(value) => setPayerId(String(value ?? ""))}
                  >
                    <SelectTrigger className="h-auto w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 shadow-none focus:ring-2 focus:ring-yellow-400/30 data-[size=default]:h-auto">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {(() => {
                          const payer = members.find((member) => member.userId === payerId)
                          return (
                            <>
                              <Avatar className="size-6 shrink-0">
                                {payer?.avatarUrl ? (
                                  <AvatarImage src={payer.avatarUrl} alt="" />
                                ) : null}
                                <AvatarFallback className="bg-gray-200 text-[9px] font-bold text-gray-700">
                                  {initialsFromNickname(payer?.nickname ?? "?")}
                                </AvatarFallback>
                              </Avatar>
                              <SelectValue placeholder="선택" />
                            </>
                          )
                        })()}
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.userId} value={member.userId}>
                          <span className="flex items-center gap-2">
                            <Avatar className="size-5">
                              {member.avatarUrl ? (
                                <AvatarImage src={member.avatarUrl} alt="" />
                              ) : null}
                              <AvatarFallback className="text-[9px] font-bold text-gray-700">
                                {initialsFromNickname(member.nickname)}
                              </AvatarFallback>
                            </Avatar>
                            {member.nickname}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="expense-date" className="text-[11px] font-semibold text-gray-700">
                    날짜
                  </label>
                  <Input
                    id="expense-date"
                    type="date"
                    value={expenseDate}
                    onChange={(event) => setExpenseDate(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 shadow-none focus-visible:border-yellow-400 focus-visible:ring-2 focus-visible:ring-yellow-400/30"
                    required
                  />
                </div>
              </div>
                </>
              ) : null}

              {/* Participants */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-gray-700">정산 대상자</span>
                  <button
                    type="button"
                    onClick={toggleAllParticipants}
                    className="text-[11px] font-semibold text-gray-700 underline underline-offset-2 hover:text-gray-900"
                  >
                    {allParticipantsSelected ? "전체 해제" : "전체 선택"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((member) => {
                    const checked = participantIds.includes(member.userId)
                    return (
                      <button
                        key={member.userId}
                        type="button"
                        onClick={() => toggleParticipant(member.userId)}
                        aria-pressed={checked}
                        className={cn(
                          "relative inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs transition-all",
                          checked
                            ? "border border-yellow-400 bg-yellow-400/15 font-bold text-gray-900"
                            : "border border-transparent bg-gray-50 font-medium text-gray-400 opacity-70"
                        )}
                      >
                        <Avatar className="size-5">
                          {member.avatarUrl ? (
                            <AvatarImage src={member.avatarUrl} alt="" />
                          ) : null}
                          <AvatarFallback className="bg-gray-200 text-[8px] font-bold text-gray-700">
                            {initialsFromNickname(member.nickname)}
                          </AvatarFallback>
                        </Avatar>
                        {member.nickname}
                        {checked ? (
                          <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-yellow-400 text-gray-900">
                            <Check className="size-2 stroke-[3]" />
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Slim receipt row */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-gray-700">영수증 첨부</span>
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={scanningReceipt}
                  onChange={(event) => {
                    void handleReceiptScan(event.target.files?.[0])
                    event.target.value = ""
                  }}
                />
                {receiptPreview ? (
                  <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={receiptPreview}
                      alt="영수증 미리보기"
                      className="size-9 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-gray-900">
                        {scanningReceipt ? "영수증 분석 중... ⏳" : "영수증 첨부됨 ✓"}
                      </p>
                      <p className="truncate text-[11px] text-gray-500">
                        {scanningReceipt
                          ? "AI가 금액·상호·날짜를 읽고 있어요"
                          : (receiptFile?.name ?? "receipt.jpg")}
                      </p>
                    </div>
                    {scanningReceipt ? (
                      <Loader2 className="size-4 shrink-0 animate-spin text-yellow-600" />
                    ) : (
                      <button
                        type="button"
                        className="shrink-0 text-[11px] font-semibold text-gray-700 underline underline-offset-2"
                        onClick={() => {
                          if (receiptPreviewRef.current) {
                            URL.revokeObjectURL(receiptPreviewRef.current)
                            receiptPreviewRef.current = null
                          }
                          setReceiptFile(null)
                          setReceiptPreview(null)
                        }}
                      >
                        제거
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => receiptInputRef.current?.click()}
                    disabled={scanningReceipt}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white py-2.5 text-xs font-semibold text-gray-700 transition-colors hover:border-yellow-400 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-70"
                  >
                    {scanningReceipt ? (
                      <Loader2 className="size-3.5 animate-spin text-yellow-600" />
                    ) : (
                      <Camera className="size-3.5 text-gray-500" />
                    )}
                    {scanningReceipt ? "영수증 분석 중... ⏳" : "영수증 사진 첨부"}
                  </button>
                )}
              </div>

              {formError ? <FieldError>{formError}</FieldError> : null}
            </div>

            <div className="sticky bottom-0 shrink-0 border-t border-gray-100 bg-white px-5 pt-3 pb-4">
              <Button
                type="submit"
                className="w-full rounded-2xl bg-yellow-400 py-3.5 text-base font-bold text-gray-900 shadow-none transition-all hover:bg-yellow-500 active:scale-[0.98]"
                disabled={
                  submitting ||
                  scanningReceipt ||
                  members.length === 0 ||
                  participantIds.length === 0 ||
                  (reviewItems.length > 0 && selectedReviewItems.length === 0)
                }
              >
                {submitting || scanningReceipt ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                {scanningReceipt
                  ? "분석 중…"
                  : reviewItems.length > 0
                    ? `선택한 ${selectedReviewItems.length}건 등록하기`
                    : "등록하기"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(receiptViewerUrl)}
        onOpenChange={(next) => {
          if (!next) setReceiptViewerUrl(null)
        }}
      >
        <DialogContent className="gap-3 rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>영수증</DialogTitle>
            <DialogDescription>첨부된 영수증 이미지입니다.</DialogDescription>
          </DialogHeader>
          {receiptViewerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={receiptViewerUrl}
              alt="영수증"
              className="max-h-[70vh] w-full rounded-xl object-contain bg-neutral-100"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
