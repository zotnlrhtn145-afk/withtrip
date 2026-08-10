"use client"

import { useEffect, useState } from "react"
import {
  Building2,
  Check,
  ChevronRight,
  Loader2,
  LogOut,
  Mail,
  Pencil,
  Plane,
  UserRoundX,
  Wallet,
  X,
} from "lucide-react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BlockedUsersDialog } from "@/components/blocked-users-dialog"
import { useTrips } from "@/components/trips-store"
import {
  BANK_OPTIONS,
  CRYPTO_NETWORK_OPTIONS,
  EMPTY_PAYOUT_ACCOUNT,
  type PayoutAccount,
} from "@/lib/payout-account"
import {
  fetchUserPayoutAccount,
  fetchUserProfile,
  requestAccountDeletion,
  saveUserNickname,
  saveUserPayoutAccount,
  type UserProfile,
} from "@/lib/user-api"
import { getTripMembers, type Trip } from "@/lib/trip-data"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

const PROVIDER_LABEL: Record<string, string> = {
  kakao: "카카오 로그인",
  google: "구글 로그인",
  email: "이메일 로그인",
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/15"

const labelClass = "text-[11px] font-bold tracking-wider text-slate-400 uppercase"

function formatJoinedAt(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, "0")
  const d = `${date.getDate()}`.padStart(2, "0")
  return `${y}.${m}.${d}`
}

function initialsFromName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return "WT"
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}

export function MyPageView({
  onSelectTrip,
  onLogout,
}: {
  onSelectTrip: (trip: Trip) => void
  onLogout: () => void
}) {
  const { trips, members } = useTrips()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState("")
  const [passwordDraft, setPasswordDraft] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null)

  const [payout, setPayout] = useState<PayoutAccount>(EMPTY_PAYOUT_ACCOUNT)
  const [payoutSaved, setPayoutSaved] = useState(false)
  const [payoutHint, setPayoutHint] = useState<string | null>(null)
  const [payoutLoading, setPayoutLoading] = useState(true)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deletionError, setDeletionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setProfileLoading(true)
      const result = await fetchUserProfile()
      if (cancelled) return
      setProfile(result.profile)
      setNameDraft(result.profile?.nickname || "")
      setProfileError(result.profile ? null : result.error || "로그인이 필요해요.")
      setProfileLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setPayoutLoading(true)
      const result = await fetchUserPayoutAccount()
      if (cancelled) return
      setPayout(result.account)
      setPayoutLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const updateBank = <K extends keyof PayoutAccount["bank"]>(
    key: K,
    value: PayoutAccount["bank"][K]
  ) => {
    setPayout((prev) => ({ ...prev, bank: { ...prev.bank, [key]: value } }))
    setPayoutSaved(false)
    setPayoutHint(null)
  }

  const updateCrypto = <K extends keyof PayoutAccount["crypto"]>(
    key: K,
    value: PayoutAccount["crypto"][K]
  ) => {
    setPayout((prev) => ({ ...prev, crypto: { ...prev.crypto, [key]: value } }))
    setPayoutSaved(false)
    setPayoutHint(null)
  }

  const handleSavePayout = () => {
    void (async () => {
      const result = await saveUserPayoutAccount(payout)
      setPayoutSaved(result.ok)
      setPayoutHint(
        result.source === "api"
          ? null
          : result.error || "로컬에 저장됐어요. DB 연동은 SQL 마이그레이션 후 가능해요."
      )
      window.setTimeout(() => setPayoutSaved(false), 2200)
    })()
  }

  const isOAuthUser = profile?.provider === "kakao" || profile?.provider === "google"

  const handleSaveProfile = () => {
    void (async () => {
      setSavingProfile(true)
      setProfileSaveError(null)

      const trimmedName = nameDraft.trim()
      const nicknameResult = trimmedName
        ? await saveUserNickname(trimmedName)
        : { ok: true, profile, error: undefined }

      let passwordOk = true
      if (!isOAuthUser && passwordDraft.trim()) {
        const supabase = createClient()
        const { error } = await supabase.auth.updateUser({ password: passwordDraft.trim() })
        if (error) {
          passwordOk = false
          setProfileSaveError(error.message || "비밀번호 변경에 실패했어요.")
        }
      }

      if (nicknameResult.ok && nicknameResult.profile) {
        setProfile(nicknameResult.profile)
      } else if (!nicknameResult.ok) {
        setProfileSaveError(nicknameResult.error || "닉네임 저장에 실패했어요.")
      }

      setPasswordDraft("")
      setSavingProfile(false)
      if (nicknameResult.ok && passwordOk) setEditing(false)
    })()
  }

  const handleRequestDeletion = () => {
    void (async () => {
      setDeletingAccount(true)
      setDeletionError(null)
      const result = await requestAccountDeletion()
      if (result.ok) {
        setProfile((prev) => (prev ? { ...prev, deletionRequestedAt: result.deletionRequestedAt } : prev))
        setDeleteDialogOpen(false)
      } else {
        setDeletionError(result.error || "탈퇴 요청에 실패했어요.")
      }
      setDeletingAccount(false)
    })()
  }

  const displayName = profile?.nickname || (profile?.email ? profile.email.split("@")[0] : "회원")
  const providerLabel = profile?.provider ? PROVIDER_LABEL[profile.provider] ?? null : null

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className={labelClass}>My Page</p>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          마이페이지
        </h2>
      </div>

      {profileError && !profileLoading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-500">
          {profileError}
        </div>
      ) : null}

      {/* Profile card */}
      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="h-16 bg-gradient-to-r from-amber-400 via-amber-300 to-rose-300" aria-hidden="true" />
        <div className="flex flex-col gap-5 px-5 pb-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <span className="-mt-10 rounded-full bg-gradient-to-tr from-amber-500 via-amber-300 to-amber-200 p-[3px] shadow-md">
                <span className="flex size-[4.5rem] items-center justify-center overflow-hidden rounded-full bg-white p-[3px]">
                  {profile?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatarUrl}
                      alt=""
                      className="size-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-500">
                      {initialsFromName(displayName)}
                    </span>
                  )}
                </span>
              </span>
              <div className="flex flex-col gap-1 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold text-slate-900">
                    {profileLoading ? "불러오는 중…" : `${displayName} 님`}
                  </span>
                  {providerLabel ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      {providerLabel}
                    </span>
                  ) : null}
                </div>
                <span className="flex items-center gap-1.5 text-sm text-slate-400">
                  <Mail className="size-3.5" />
                  {profile?.email || "—"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setNameDraft(profile?.nickname || "")
                setPasswordDraft("")
                setProfileSaveError(null)
                setEditing((current) => !current)
              }}
              disabled={profileLoading || !profile}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
            >
              <Pencil className="size-3.5" />
              {editing ? "편집 취소" : "프로필 수정"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className={labelClass}>가입일</p>
              <p className="mt-1 text-sm font-bold tabular-nums text-slate-800">
                {formatJoinedAt(profile?.joinedAt ?? null)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className={labelClass}>함께한 여행</p>
              <p className="mt-1 text-sm font-bold tabular-nums text-slate-800">{trips.length}개</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className={labelClass}>다음 출발</p>
              <p className="mt-1 text-sm font-bold tabular-nums text-slate-800">
                {trips.length > 0
                  ? `D-${Math.min(...trips.map((trip) => trip.dDay))}`
                  : "예정 없음"}
              </p>
            </div>
          </div>

          {editing ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                handleSaveProfile()
              }}
              className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="profile-name" className={labelClass}>
                  닉네임
                </label>
                <input
                  id="profile-name"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              {!isOAuthUser ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="profile-password" className={labelClass}>
                    새 비밀번호
                  </label>
                  <input
                    id="profile-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="변경할 비밀번호를 입력하세요"
                    value={passwordDraft}
                    onChange={(event) => setPasswordDraft(event.target.value)}
                    className={inputClass}
                  />
                </div>
              ) : null}
              {profileSaveError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {profileSaveError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-500 active:scale-95 disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {savingProfile ? "저장 중…" : "변경 저장"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(profile?.nickname || "")
                    setPasswordDraft("")
                    setProfileSaveError(null)
                    setEditing(false)
                  }}
                  className="rounded-full px-5 py-2.5 text-sm font-bold text-slate-500 transition-all hover:bg-slate-100"
                >
                  되돌리기
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>

      {/* Payout account card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <Wallet className="size-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">정산 수령 계좌 관리</p>
            <p className="text-xs text-slate-400">
              은행 계좌와 코인 지갑을 등록하면 카카오톡 공유에 자동으로 포함돼요.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <Building2 className="size-3.5 text-slate-400" />
              <p className="text-xs font-bold text-slate-600">은행 계좌 정보</p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>은행 선택</label>
                <Select
                  value={payout.bank.bankName}
                  onValueChange={(value) => updateBank("bankName", String(value ?? ""))}
                >
                  <SelectTrigger className="w-full rounded-xl border-slate-200">
                    <SelectValue placeholder="은행을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANK_OPTIONS.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="payout-account-number" className={labelClass}>
                  계좌번호
                </label>
                <input
                  id="payout-account-number"
                  inputMode="numeric"
                  placeholder="하이픈 없이 입력"
                  value={payout.bank.accountNumber}
                  onChange={(event) => updateBank("accountNumber", event.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="payout-account-holder" className={labelClass}>
                  예금주
                </label>
                <input
                  id="payout-account-holder"
                  placeholder="예금주명"
                  value={payout.bank.accountHolder}
                  onChange={(event) => updateBank("accountHolder", event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold text-slate-600">암호화폐 지갑 정보</p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>네트워크 / 코인</label>
                <Select
                  value={payout.crypto.network}
                  onValueChange={(value) => updateCrypto("network", String(value ?? ""))}
                >
                  <SelectTrigger className="w-full rounded-xl border-slate-200">
                    <SelectValue placeholder="네트워크를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {CRYPTO_NETWORK_OPTIONS.map((network) => (
                      <SelectItem key={network} value={network}>
                        {network}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="payout-wallet" className={labelClass}>
                  지갑 주소
                </label>
                <input
                  id="payout-wallet"
                  placeholder="0x… 또는 지갑 주소"
                  value={payout.crypto.walletAddress}
                  onChange={(event) => updateCrypto("walletAddress", event.target.value)}
                  className={cn(inputClass, "font-mono text-xs")}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSavePayout}
              disabled={payoutLoading}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-500 active:scale-95 disabled:opacity-50"
            >
              {payoutSaved ? (
                <>
                  <Check className="size-3.5" />
                  저장됨
                </>
              ) : (
                "수령 정보 저장"
              )}
            </button>
            <p className="text-xs text-slate-400">
              {payoutHint || "Supabase profiles에 저장돼요."}
            </p>
          </div>
        </div>
      </div>

      {/* Trip list card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-bold text-slate-900">내 여행 관리</p>
        <div className="flex flex-col gap-2">
          {trips.length === 0 ? (
            <p className="px-1 py-4 text-center text-sm text-slate-400">
              아직 등록된 여행이 없어요.
            </p>
          ) : null}
          {trips.map((trip) => {
            const tripMembers = getTripMembers(trip, members)
            const isOwner = Boolean(profile?.id) && trip.ownerId === profile?.id
            return (
              <button
                key={trip.id}
                type="button"
                onClick={() => onSelectTrip(trip)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3 text-left transition-all hover:bg-slate-50 active:scale-[0.99]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                    <Plane className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm font-bold text-slate-900">{trip.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        {isOwner ? "내가 만든 여행" : "공유받은 여행"}
                      </span>
                      <span className="text-xs text-slate-400 tabular-nums">
                        {trip.startDate} — {trip.endDate} · 멤버 {tripMembers.length}명
                      </span>
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-amber-700">
                    D-{trip.dDay}
                  </span>
                  <ChevronRight className="size-4 text-slate-300" />
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Account settings card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-bold text-slate-900">계정 설정</p>
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.99]"
          >
            <LogOut className="size-4" />
            로그아웃
          </button>
          <BlockedUsersDialog />
          <div className="h-px bg-slate-100" />
          {profile?.deletionRequestedAt ? (
            <p className="self-center text-xs text-slate-400">
              탈퇴 요청이 접수됐어요 ({formatJoinedAt(profile.deletionRequestedAt)}) · 검토 후
              처리돼요.
            </p>
          ) : (
            <button
              type="button"
              disabled={!profile}
              onClick={() => {
                setDeletionError(null)
                setDeleteDialogOpen(true)
              }}
              className="inline-flex items-center gap-1.5 self-center text-xs font-semibold text-slate-400 transition-colors hover:text-rose-500 disabled:opacity-50"
            >
              <UserRoundX className="size-3.5" />
              회원 탈퇴
            </button>
          )}
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-full max-w-xs gap-0 rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl"
        >
          <DialogHeader className="relative mb-1 gap-1 pr-8 text-left">
            <DialogClose className="absolute top-0 right-0 rounded-full p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700">
              <X className="size-4" />
              <span className="sr-only">닫기</span>
            </DialogClose>
            <DialogTitle className="text-base font-bold text-slate-900">
              회원 탈퇴를 요청할까요?
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-slate-400">
              탈퇴 요청은 운영자가 확인 후 계정과 데이터를 삭제해요. 즉시 삭제되지 않으며, 처리
              전까지는 계속 로그인해서 이용할 수 있어요.
            </DialogDescription>
          </DialogHeader>
          {deletionError ? (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {deletionError}
            </p>
          ) : null}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(false)}
              className="flex-1 rounded-full bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-200"
            >
              취소
            </button>
            <button
              type="button"
              disabled={deletingAccount}
              onClick={handleRequestDeletion}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-red-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-red-600 disabled:opacity-50"
            >
              {deletingAccount ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {deletingAccount ? "요청 중…" : "탈퇴 요청"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
