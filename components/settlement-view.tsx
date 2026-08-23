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
  RotateCcw,
  ScanLine,
  Share2,
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
import {
  applyCarryoverCredit,
  calcPerPerson,
  calcVariableMemberBalances,
} from "@/lib/settlement-math"
import { parseReceiptImage, type ParsedReceiptItem } from "@/lib/parse-receipt"
import {
  addSettlementGuest,
  deleteSettlementGuest,
  fetchSettlementMembers,
  fetchTripCarryoverConfig,
  fetchTripExpenses,
  fetchTripSettlements,
  formatExpenseDateLabel,
  formatExpenseSplitLabel,
  formatWon,
  initialsFromNickname,
  insertExpense,
  updateExpense,
  deleteExpense,
  setTripCarryover,
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
import { computePresence, type Presence } from "@/shared/trip-presence"
import { supabase } from "@/lib/supabase"
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
import { getCurrentUserId } from "@/lib/auth-session"
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
  { key: "all", label: "전체", icon: LayoutGrid },
  { key: "transfers", label: "송금", icon: ArrowLeftRight },
  { key: "expenses", label: "지출", icon: ReceiptText },
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
  /** 이 내역의 정산 대상자 (내역마다 다르게 지정 가능) */
  participantIds: string[]
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
    participantIds: [],
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

  // 공동 자금(이월) — 호스트만 지정 가능, 적용 대상 멤버 선택 가능.
  const [carryover, setCarryover] = useState(0)
  const [carryMembers, setCarryMembers] = useState<string[]>([])
  const [carryOwnerId, setCarryOwnerId] = useState<string | null>(null)
  const [carryModalOpen, setCarryModalOpen] = useState(false)
  const [carryInput, setCarryInput] = useState("")
  const [carrySel, setCarrySel] = useState<Set<string>>(new Set())
  const [savingCarry, setSavingCarry] = useState(false)

  // 모바일 액션 FAB(speed-dial) 열림 상태
  const [fabOpen, setFabOpen] = useState(false)

  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ExpenseCategory>("식사")
  const [categoryChipId, setCategoryChipId] = useState("식사")
  const [payerId, setPayerId] = useState("")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [expenseDate, setExpenseDate] = useState(todayIsoDate())
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [scanningReceipt, setScanningReceipt] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [receiptViewerUrl, setReceiptViewerUrl] = useState<string | null>(null)
  /** 고치는 중인 지출. 비어 있으면 새로 추가하는 것이다 */
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
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

  // 정산 전용 게스트 id (지출 저장 시 guest_id 로 구분)
  const guestIds = useMemo(() => members.filter((m) => m.isGuest).map((m) => m.userId), [members])
  // 결제자 후보 = 게스트 제외 (게스트는 payer 가 될 수 없음)
  const payerMembers = useMemo(() => members.filter((m) => !m.isGuest), [members])

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
      const [loadedMembers, loadedExpenses, loadedSettlements, carryConfig] = await Promise.all([
        fetchSettlementMembers(activeTripId),
        fetchTripExpenses(activeTripId),
        fetchTripSettlements(activeTripId),
        fetchTripCarryoverConfig(activeTripId),
      ])

      setMembers(loadedMembers)
      setExpenses(loadedExpenses)
      setCarryover(carryConfig.carryover)
      setCarryMembers(carryConfig.members)
      setCarryOwnerId(carryConfig.ownerId)

      const memberIds = loadedMembers.map((member) => member.userId)
      const synced = await syncSettlementsForTrip(
        activeTripId,
        memberIds,
        loadedExpenses,
        loadedSettlements,
        carryConfig.carryover,
        carryConfig.members
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

  // 정산 전용 게스트 추가/삭제
  const handleAddGuest = useCallback(async () => {
    if (!activeTripId) return
    const name = window.prompt("게스트 이름 (여행 멤버가 아니지만 정산에 함께 넣을 사람)")?.trim()
    if (!name) return
    try {
      await addSettlementGuest(activeTripId, name)
      await refreshSettlementData()
      showToast(`게스트 "${name}"을(를) 추가했어요.`)
    } catch {
      showToast("게스트 추가에 실패했어요.")
    }
  }, [activeTripId, refreshSettlementData, showToast])

  const handleDeleteGuest = useCallback(
    async (guestId: string, name: string) => {
      if (!window.confirm(`게스트 "${name}"을(를) 정산에서 뺄까요?`)) return
      try {
        await deleteSettlementGuest(guestId)
        await refreshSettlementData()
      } catch {
        showToast("게스트 삭제에 실패했어요.")
      }
    },
    [refreshSettlementData, showToast]
  )

  // 공동 자금(이월) 모달 열기 — 현재 값으로 초기화. 대상 미지정이면 게스트 제외 전체 멤버.
  const openCarryModal = useCallback(() => {
    setCarryInput(carryover ? String(carryover) : "")
    setCarrySel(
      new Set(
        carryMembers.length > 0
          ? carryMembers
          : members.filter((m) => !m.isGuest).map((m) => m.userId)
      )
    )
    setCarryModalOpen(true)
  }, [carryover, carryMembers, members])

  const saveCarryover = useCallback(async () => {
    if (!activeTripId || savingCarry) return
    const value = Math.max(0, Math.round(Number(carryInput.replace(/[^0-9]/g, "")) || 0))
    const mems = value > 0 ? [...carrySel] : []
    setSavingCarry(true)
    try {
      await setTripCarryover(activeTripId, value, mems)
      setCarryModalOpen(false)
      await refreshSettlementData()
      showToast(value > 0 ? `공동 자금 ${value.toLocaleString()}원을 반영했어요.` : "공동 자금을 해제했어요.")
    } catch {
      showToast("공동 자금 저장에 실패했어요.")
    } finally {
      setSavingCarry(false)
    }
  }, [activeTripId, savingCarry, carryInput, carrySel, refreshSettlementData, showToast])

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
    void getCurrentUserId().then((id) => setCurrentUserId(id))
  }, [])

  // 결제자 기본값 = 현재 로그인 유저(작성자). 멤버 목록에 있으면 그 사람으로, 없으면 첫 멤버.
  useEffect(() => {
    if (!payerId && members.length > 0) {
      // 폴백도 게스트를 피한다 — payer_id 는 profiles 를 참조해서 게스트면 저장이 죽는다
      const mine =
        currentUserId && members.some((m) => m.userId === currentUserId)
          ? currentUserId
          : (members.find((m) => !m.isGuest)?.userId ?? "")
      if (mine) setPayerId(mine)
    }
  }, [members, payerId, currentUserId])

  /**
   * 그 날 여행에 있던 사람만 미리 체크한다.
   *
   * ⚠️ **돈이 갈리는 계산이라 앱이 마음대로 정하지 않는다.** 기본 체크만 맞춰
   *    두고, 손으로 얼마든지 고칠 수 있다. 근거로 쓰는 교통편 데이터가
   *    성기기 때문이다(여행 6개 중 절반만 도착 날짜가 온전했다).
   *    잘못 빼면 누군가 돈을 덜 내게 된다 — 그건 조용히 일어나면 안 된다.
   *
   * ⚠️ 판단은 **날짜 단위**다. 지출에는 시각이 없다. 진짜로 쓸모 있는 건
   *    **날짜가 아예 다른 경우** — 3일차에 합류한 친구는 1·2일차 지출에서
   *    저절로 빠진다.
   */
  const [presence, setPresence] = useState<Map<string, Presence>>(new Map())
  const [tripRange, setTripRange] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  })
  /** 손으로 한 번이라도 고쳤나 — 그 뒤로는 날짜가 바뀌어도 건드리지 않는다 */
  const participantsTouched = useRef(false)

  useEffect(() => {
    if (!activeTripId || members.length === 0) return
    let alive = true
    void (async () => {
      const [t, tr] = await Promise.all([
        supabase.from("trips").select("start_date, end_date").eq("id", activeTripId).maybeSingle(),
        supabase
          .from("trip_transports")
          .select("passenger_ids, depart_date, depart_time, arrive_date, arrive_time")
          .eq("trip_id", activeTripId),
      ])
      if (!alive) return
      const trip = t.data as { start_date: string | null; end_date: string | null } | null
      setTripRange({ start: trip?.start_date ?? null, end: trip?.end_date ?? null })
      const rows =
        (tr.data as {
          passenger_ids: string[] | null
          depart_date: string | null
          depart_time: string | null
          arrive_date: string | null
          arrive_time: string | null
        }[] | null) ?? []
      setPresence(
        computePresence({
          startDate: trip?.start_date ?? null,
          endDate: trip?.end_date ?? null,
          personIds: members.map((m) => m.userId),
          transports: rows.map((r) => ({
            passengerIds: (r.passenger_ids ?? []).map(String),
            departDate: r.depart_date,
            departTime: r.depart_time,
            arriveDate: r.arrive_date,
            arriveTime: r.arrive_time,
          })),
        })
      )
    })()
    return () => {
      alive = false
    }
  }, [activeTripId, members])

  const presentOn = useCallback(
    (userId: string, day: string): boolean => {
      /*
        ⚠️ **여행 기간 밖의 날짜에는 아무도 안 뺀다.** 지출 날짜는 오늘로
           시작하는데, 다음 달 여행이면 모두가 "합류 전" 이 되어 한 명도 안
           남는다 — 저장도 못 하고 고장 난 것처럼 보인다(앱에서 그렇게 나왔다).
      */
      const { start, end } = tripRange
      if (!start || !end || !day || day < start || day > end) return true
      const p = presence.get(userId)
      if (!p) return true // 모르면 있는 것으로 본다
      if (p.joinsAt && day < p.joinsAt.date) return false
      if (p.leavesAt && day > p.leavesAt.date) return false
      return true
    },
    [presence, tripRange]
  )

  useEffect(() => {
    if (editingExpenseId || participantsTouched.current || members.length === 0) return
    const here = members.filter((m) => presentOn(m.userId, expenseDate)).map((m) => m.userId)
    /*
      ⚠️ **한 명도 안 남으면 전원으로 되돌린다.** 빈 목록은 저장이 막히고
         사용자 눈에는 그냥 고장이다.
    */
    setParticipantIds(here.length > 0 ? here : members.map((m) => m.userId))
  }, [members, presence, expenseDate, editingExpenseId, presentOn])

  const total = useMemo(
    () => expenses.reduce((sum, item) => sum + item.amount, 0),
    [expenses]
  )
  const memberCount = members.length

  const isCarryOwner = !!currentUserId && currentUserId === carryOwnerId
  // 공동 자금을 먼저 뺀 뒤 남는 금액과 1인당 균등분할(참고용).
  const netTotal = Math.max(0, total - carryover)
  const perPerson = members.length ? Math.round(netTotal / members.length) : 0

  /** 정산 대상 인원별 실제 부담액 — 지출마다 다른 참여자 구성 + 공동 자금(이월)을 반영한다. */
  const memberBalances = useMemo(() => {
    if (members.length === 0 || expenses.length === 0) return []
    const memberIds = members.map((member) => member.userId)
    const balances = applyCarryoverCredit(
      calcVariableMemberBalances(
        memberIds,
        expenses.map((expense) => ({
          amount: expense.amount,
          payerId: expense.payerId,
          participantIds:
            expense.participantIds.length > 0 ? expense.participantIds : memberIds,
        }))
      ),
      carryover,
      carryMembers
    )
    return balances
      .map((entry) => ({ ...entry, member: membersById.get(entry.userId) }))
      .filter((entry) => entry.member)
      .sort((a, b) => b.balance - a.balance)
  }, [members, expenses, membersById, carryover, carryMembers])

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
    participantsTouched.current = true
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
    // ⚠️ 새 지출을 시작하면 "손으로 고쳤다" 표시도 지운다 — 안 그러면 그날 이후
    //    모든 지출이 기본 체크를 못 받는다
    participantsTouched.current = false
    setTitle("")
    setAmount("")
    setCategory("식사")
    setCategoryChipId("식사")
    setPayerId(
      currentUserId && members.some((m) => m.userId === currentUserId) ? currentUserId : members[0]?.userId ?? ""
    )
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
          // 각 내역의 정산 대상자는 기본으로 전체 멤버, 이후 내역별로 조정 가능.
          const allMemberIds = members.map((m) => m.userId)
          setReviewItems(items.map((it) => ({ ...toReviewItem(it), participantIds: allMemberIds })))
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

  /**
   * 지출 줄을 눌렀을 때 — 지금 값을 폼에 채우고 고치기 모드로 연다.
   *
   * ⚠️ 영수증 파일은 채우지 않는다. 새로 고르지 않으면 기존 영수증을 그대로 둔다
   *    (updateExpense 가 receiptUrl 이 없으면 건드리지 않는다).
   */
  const startEditExpense = (expense: ExpenseRecord) => {
    setEditingExpenseId(expense.id)
    setTitle(expense.title ?? "")
    setAmount(String(expense.amount ?? ""))
    setCategory(expense.category as typeof category)
    setPayerId(expense.payerId ?? null)
    setExpenseDate(expense.expenseDate ?? "")
    setParticipantIds(
      expense.participantIds.length > 0
        ? [...expense.participantIds]
        : members.map((m) => m.userId)
    )
    setFormError(null)
    setOpen(true)
  }

  /** 지출 지우기 — 정산 금액이 바로 바뀌므로 무엇을 지우는지 보여 주고 묻는다 */
  const removeExpense = async (expense: ExpenseRecord) => {
    const label = `${expense.title || "지출"} · ${formatWon(expense.amount)}`
    if (!window.confirm(`"${label}" 을(를) 지울까요?\n정산 금액이 바로 바뀝니다.`)) return
    try {
      await deleteExpense(expense.id)
      await refreshSettlementData()
      showToast("지출을 지웠어요.")
    } catch (err) {
      const typed = err as { message?: string }
      showToast(typed?.message ?? "지출을 지우지 못했어요.")
    }
  }

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
    // DB 의 amount 는 int4 다. 넘기면 "value out of range" 라는 날것의 오류가 뜬다.
    if (parsed > 2_000_000_000) {
      setFormError("20억 원까지 입력할 수 있어요. 금액을 다시 확인해 주세요.")
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
      const common = {
        title: title.trim(),
        amount: parsed,
        category,
        payerId,
        expenseDate,
        receiptUrl,
        participantIds,
        guestIds,
      }
      if (editingExpenseId) {
        await updateExpense({ expenseId: editingExpenseId, ...common })
      } else {
        await insertExpense({ tripId: activeTripId, ...common })
      }
      const wasEditing = Boolean(editingExpenseId)
      setEditingExpenseId(null)
      resetForm()
      setOpen(false)
      await refreshSettlementData()
      showToast(wasEditing ? "지출을 고쳤어요." : "지출이 등록되었어요.")
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
      if (item.participantIds.length === 0) {
        setFormError(`"${item.title.trim() || "지출"}"의 나눠낼 사람을 한 명 이상 선택해 주세요.`)
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
          participantIds: item.participantIds, // 내역별 정산 대상자
          guestIds,
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
        expenseCount: expenses.length,
        memberCount,
        transfers: settlements.map((transfer) => ({
          fromNickname: membersById.get(transfer.fromUserId)?.nickname ?? "멤버",
          toNickname: membersById.get(transfer.toUserId)?.nickname ?? "멤버",
          amount: transfer.amount,
        })),
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
      {/* 인스타그램식 상단 탭 — 정산 보기 전환(전체/송금/지출). 모바일·데스크톱 모두 최상단 고정. */}
      <div
        role="tablist"
        aria-label="정산 보기"
        className="sticky top-0 z-30 mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-neutral-100 bg-white/95 p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] backdrop-blur-md"
      >
        {PANEL_TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200",
                isActive
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
              )}
            >
              <tab.icon className="size-4 stroke-[1.75]" />
              {tab.label}
            </button>
          )
        })}
      </div>
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
                <div className="flex shrink-0 items-center gap-2">
                  <p className="text-[11px] text-neutral-400 tabular-nums">
                    {expenses.length}건 · {memberCount}명
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleAddGuest()}
                    className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-100"
                  >
                    <Plus className="size-3" />
                    게스트
                  </button>
                </div>
              </div>

              {/* 공동 자금(이월) — 정산에서 먼저 빼고 나눈다. 호스트만 지정 가능. */}
              {!loading ? (
                isCarryOwner ? (
                  <button
                    type="button"
                    onClick={openCarryModal}
                    className={cn(
                      "mt-2.5 flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
                      carryover > 0
                        ? "border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50"
                        : "border-dashed border-neutral-200 bg-neutral-50/60 hover:bg-neutral-50"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Wallet className={cn("size-3.5 shrink-0", carryover > 0 ? "text-emerald-600" : "text-neutral-400")} />
                      <span className={cn("truncate text-xs font-semibold", carryover > 0 ? "text-emerald-700" : "text-neutral-500")}>
                        {carryover > 0
                          ? `공동 자금 −${carryover.toLocaleString()}원 · 1인당 ${formatWon(perPerson)}`
                          : "공동 자금(이월) 추가"}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-bold text-neutral-400">
                      {carryover > 0 ? "수정" : "＋"}
                    </span>
                  </button>
                ) : carryover > 0 ? (
                  <div className="mt-2.5 flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                    <Wallet className="size-3.5 shrink-0 text-emerald-600" />
                    <span className="truncate text-xs font-semibold text-emerald-700">
                      공동 자금 −{carryover.toLocaleString()}원 (호스트 지정)
                    </span>
                  </div>
                ) : null
              ) : null}

              {/* 지출마다 참여자가 달라질 수 있어 "1인당" 균등분할 대신, 실제 부담액을 인원별로 보여준다. */}
              {!loading && memberBalances.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2 border-t border-neutral-100/80 pt-3">
                  {memberBalances.map(({ userId, balance, member }) => {
                    const isSettled = Math.abs(balance) < 1
                    const name = member?.nickname ?? "멤버"
                    return (
                      <li key={userId} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Avatar className="size-5 shrink-0">
                            {member?.avatarUrl ? (
                              <AvatarImage src={member.avatarUrl} alt="" />
                            ) : null}
                            <AvatarFallback className="bg-neutral-200 text-[9px] font-bold text-neutral-600">
                              {initialsFromNickname(name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-xs font-medium text-neutral-700">
                            {name}
                          </span>
                          {member?.isGuest ? (
                            <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 text-[9px] font-bold text-neutral-500">
                              게스트
                            </span>
                          ) : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={cn(
                              "text-xs font-bold tabular-nums",
                              isSettled
                                ? "text-neutral-400"
                                : balance > 0
                                  ? "text-emerald-600"
                                  : "text-red-500"
                            )}
                          >
                            {isSettled
                              ? "정산 완료"
                              : `${balance > 0 ? "+" : "-"}${formatWon(Math.abs(balance))}`}
                          </span>
                          {member?.isGuest ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteGuest(userId, name)}
                              aria-label="게스트 삭제"
                              className="text-neutral-300 transition-colors hover:text-red-500"
                            >
                              <X className="size-3.5" />
                            </button>
                          ) : null}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>

            {/* 2. Payout account card — 계좌 있으면 헤더+상세, 없으면 한 줄 컴팩트 프롬프트 */}
            <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              {hasAnyPayout(payoutAccount) ? (
                <div className="flex flex-col gap-2.5 text-sm">
                  <div className="mb-0.5 flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                      <Wallet className="size-4 stroke-[1.5]" />
                    </span>
                    <p className="text-sm font-semibold text-neutral-900">내 수령 계좌</p>
                  </div>
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
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/?nav=mypage"
                  }}
                  className="flex w-full items-center gap-2.5 text-left"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
                    <Wallet className="size-4 stroke-[1.5]" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold text-neutral-900">내 수령 계좌</span>
                    <span className="text-xs text-neutral-400">등록하면 멤버가 바로 송금할 수 있어요</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-amber-600">등록 →</span>
                </button>
              )}
            </div>

            {/* 3. Action buttons — 데스크톱은 사이드바에 그대로, 모바일은 우하단 FAB로 대체 */}
            <div className="hidden flex-col gap-2 md:flex">
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
                            <div className="flex shrink-0 items-center gap-1 pt-0.5">
                              <span className="text-sm font-bold tabular-nums text-neutral-900">
                                {formatWon(expense.amount)}
                              </span>
                              {/*
                                ⚠️ 잘못 넣은 지출을 고칠 방법이 아예 없어서 틀린 금액이
                                   정산에 그대로 남았다. 줄마다 손댈 자리를 만든다.
                              */}
                              <button
                                type="button"
                                onClick={() => startEditExpense(expense)}
                                aria-label="지출 고치기"
                                title="고치기"
                                className="ml-1 rounded-md px-2 py-1 text-xs font-semibold text-neutral-500 transition-colors hover:bg-amber-50 hover:text-amber-900"
                              >
                                고치기
                              </button>
                              <button
                                type="button"
                                onClick={() => void removeExpense(expense)}
                                aria-label="지출 지우기"
                                title="지우기"
                                className="rounded-md px-2 py-1 text-xs font-semibold text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-700"
                              >
                                지우기
                              </button>
                            </div>
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

      {/* 모바일 액션 FAB (speed-dial) — 데스크톱은 사이드바 버튼 사용 */}
      <div className="md:hidden">
        {fabOpen ? (
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setFabOpen(false)}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] duration-200 animate-in fade-in-0"
          />
        ) : null}
        <div className="fixed right-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-3">
          {fabOpen ? (
            <>
              {/*
                아이콘과 이름을 **한 알약 안에** 담는다.
                예전엔 검은 알약(이름) + 동그라미(아이콘)가 따로 떠 있었고
                색도 카카오 노랑·흰색·앰버가 섞여 산만했다.
                지금은 흰 알약으로 통일하고, 주된 동작(지출 추가)만 브랜드색으로 둔다.
              */}
              <button
                type="button"
                disabled={sharing || loading}
                onClick={() => {
                  setFabOpen(false)
                  void handleShareSettlement()
                }}
                style={{ animationDelay: "80ms" }}
                className="flex items-center gap-2 rounded-full bg-white py-2.5 pr-4 pl-3 text-sm font-bold text-neutral-800 shadow-lg ring-1 ring-neutral-200/70 transition-transform duration-200 animate-in fade-in-0 slide-in-from-bottom-2 active:scale-95 disabled:opacity-50"
              >
                {sharing ? (
                  <Loader2 className="size-[18px] animate-spin text-neutral-400" />
                ) : (
                  <Share2 className="size-[18px] text-neutral-400" />
                )}
                공유
              </button>

              <button
                type="button"
                disabled={settlingTrip || loading}
                onClick={() => {
                  setFabOpen(false)
                  void handleToggleTripSettled()
                }}
                style={{ animationDelay: "40ms" }}
                className="flex items-center gap-2 rounded-full bg-white py-2.5 pr-4 pl-3 text-sm font-bold text-neutral-800 shadow-lg ring-1 ring-neutral-200/70 transition-transform duration-200 animate-in fade-in-0 slide-in-from-bottom-2 active:scale-95 disabled:opacity-50"
              >
                {settlingTrip ? (
                  <Loader2 className="size-[18px] animate-spin text-neutral-400" />
                ) : tripSettled ? (
                  <RotateCcw className="size-[18px] text-neutral-400" />
                ) : (
                  <Check className="size-[18px] text-neutral-400" />
                )}
                {tripSettled ? "정산 재개" : "정산 완료"}
              </button>

              <button
                type="button"
                disabled={tripSettled}
                onClick={() => {
                  setFabOpen(false)
                  setOpen(true)
                }}
                className="flex items-center gap-2 rounded-full bg-amber-400 py-2.5 pr-4 pl-3 text-sm font-bold text-neutral-900 shadow-lg shadow-amber-400/30 transition-transform duration-200 animate-in fade-in-0 slide-in-from-bottom-2 active:scale-95 disabled:opacity-50"
              >
                <Plus className="size-[18px]" />
                지출 추가
              </button>
            </>
          ) : null}
          {/* 메인 FAB */}
          <button
            type="button"
            aria-label={fabOpen ? "정산 메뉴 닫기" : "정산 메뉴 열기"}
            aria-expanded={fabOpen}
            onClick={() => setFabOpen((prev) => !prev)}
            className="flex size-14 items-center justify-center rounded-full bg-amber-400 text-neutral-900 shadow-xl shadow-amber-400/40 transition-transform active:scale-90"
          >
            <Plus className={cn("size-7 transition-transform duration-300 ease-out", fabOpen && "rotate-45")} />
          </button>
        </div>
      </div>

      {/* Add expense dialog */}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditingExpenseId(null)
          if (next) {
            participantsTouched.current = false
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
              {editingExpenseId ? "지출 고치기" : "지출 추가"}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              {editingExpenseId
                ? "고치면 정산 금액이 바로 다시 계산돼요."
                : "함께 낸 지출을 기록하면 정산이 자동으로 계산돼요."}
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
                        {/* 내역별 정산 대상자 */}
                        <div className="flex flex-wrap items-center gap-1 border-t border-gray-100 pt-2 pl-7">
                          <span className="mr-0.5 text-[10px] font-bold text-gray-400">나눠낼 사람</span>
                          {members.map((member) => {
                            const on = item.participantIds.includes(member.userId)
                            return (
                              <button
                                key={member.userId}
                                type="button"
                                onClick={() =>
                                  updateReviewItem(item.id, {
                                    participantIds: on
                                      ? item.participantIds.filter((mid) => mid !== member.userId)
                                      : [...item.participantIds, member.userId],
                                  })
                                }
                                className={cn(
                                  "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                                  on
                                    ? "border-yellow-400 bg-yellow-400 font-bold text-gray-900"
                                    : "border-gray-200 bg-white font-medium text-gray-400 hover:bg-gray-50"
                                )}
                              >
                                {member.userId === currentUserId ? "나" : member.nickname}
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
                    items={payerMembers.map((member) => ({
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
                      {payerMembers.map((member) => (
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
                        {/*
                          ⚠️ **왜 빠졌는지 말해 준다.** 그냥 체크가 없으면 실수로
                             안 누른 건지 앱이 뺀 건지 알 수 없다. 돈 이야기라
                             더 그렇다. 눌러서 도로 넣을 수 있다.
                        */}
                        {!checked && !presentOn(member.userId, expenseDate) ? (
                          <span className="text-[10px] font-bold text-gray-400">
                            {(() => {
                              const p = presence.get(member.userId)
                              return p?.joinsAt && expenseDate < p.joinsAt.date ? "합류 전" : "출발 후"
                            })()}
                          </span>
                        ) : null}
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
                  (reviewItems.length === 0 && participantIds.length === 0) ||
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

      {/* 공동 자금(이월) 설정 — 호스트 전용 */}
      <Dialog open={carryModalOpen} onOpenChange={setCarryModalOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 space-y-0.5 border-b border-gray-100 px-5 py-3.5 text-left">
            <DialogTitle className="text-lg font-extrabold text-gray-900">공동 자금(이월)</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              모아둔 돈에서 먼저 빼고 남은 금액만 정산해요. 아래에서 이 돈을 함께 쓴 사람만 골라 주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-700">이월 금액 (원)</label>
              <Input
                inputMode="numeric"
                value={carryInput ? Number(carryInput.replace(/[^0-9]/g, "")).toLocaleString() : ""}
                onChange={(event) => setCarryInput(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="예: 300,000"
                className="h-11 rounded-xl border-gray-200 bg-gray-50 text-right text-base font-bold tabular-nums shadow-none focus-visible:border-yellow-400 focus-visible:ring-1 focus-visible:ring-yellow-400/30"
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-bold text-gray-700">
                이 돈을 함께 쓴 사람 <span className="font-normal text-gray-400">(선택 인원끼리 나눠 부담을 덜어요)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {payerMembers.map((member) => {
                  const on = carrySel.has(member.userId)
                  return (
                    <button
                      key={member.userId}
                      type="button"
                      onClick={() =>
                        setCarrySel((prev) => {
                          const next = new Set(prev)
                          if (next.has(member.userId)) next.delete(member.userId)
                          else next.add(member.userId)
                          return next
                        })
                      }
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                        on
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                      )}
                    >
                      {on ? <Check className="size-3 stroke-[3]" /> : null}
                      {member.nickname}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                아무도 안 고르면 전원에게 균등 적용돼요. 멤버가 바뀌면 여기서 조절하세요.
              </p>
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-100 px-5 pt-3 py-3.5">
            <Button
              type="button"
              onClick={() => void saveCarryover()}
              disabled={savingCarry}
              className="w-full rounded-2xl bg-yellow-400 py-3.5 text-base font-bold text-gray-900 shadow-none transition-all hover:bg-yellow-500 active:scale-[0.98]"
            >
              {savingCarry ? <Loader2 className="animate-spin" /> : null}
              {carryInput && Number(carryInput.replace(/[^0-9]/g, "")) > 0 ? "적용하기" : "공동 자금 해제"}
            </Button>
          </div>
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
