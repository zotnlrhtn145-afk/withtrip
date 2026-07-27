export type BankPayoutInfo = {
  bankName: string
  accountNumber: string
  accountHolder: string
}

export type CryptoPayoutInfo = {
  network: string
  walletAddress: string
}

export type PayoutAccount = {
  bank: BankPayoutInfo
  crypto: CryptoPayoutInfo
}

export const BANK_OPTIONS = [
  "국민은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "농협은행",
  "기업은행",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "SC제일은행",
  "씨티은행",
  "새마을금고",
  "우체국",
] as const

export const CRYPTO_NETWORK_OPTIONS = [
  "Ethereum",
  "Solana",
  "Bitcoin",
  "USDT (TRC-20)",
  "USDT (ERC-20)",
  "Polygon",
  "BNB Smart Chain",
] as const

const STORAGE_KEY = "withtrip:payout-account"

export const EMPTY_PAYOUT_ACCOUNT: PayoutAccount = {
  bank: { bankName: "", accountNumber: "", accountHolder: "" },
  crypto: { network: "", walletAddress: "" },
}

function normalizePayout(raw: unknown): PayoutAccount {
  const value = (raw ?? {}) as Partial<PayoutAccount>
  return {
    bank: {
      bankName: String(value.bank?.bankName ?? "").trim(),
      accountNumber: String(value.bank?.accountNumber ?? "").trim(),
      accountHolder: String(value.bank?.accountHolder ?? "").trim(),
    },
    crypto: {
      network: String(value.crypto?.network ?? "").trim(),
      walletAddress: String(value.crypto?.walletAddress ?? "").trim(),
    },
  }
}

export function loadPayoutAccount(): PayoutAccount {
  if (typeof window === "undefined") return EMPTY_PAYOUT_ACCOUNT
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_PAYOUT_ACCOUNT
    return normalizePayout(JSON.parse(raw) as unknown)
  } catch {
    return EMPTY_PAYOUT_ACCOUNT
  }
}

export function savePayoutAccount(account: PayoutAccount): void {
  if (typeof window === "undefined") return
  const next = normalizePayout(account)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(
      new CustomEvent("withtrip:payout-account", { detail: next })
    )
  } catch {
    // ignore quota / private mode
  }
}

export function hasBankPayout(account: PayoutAccount): boolean {
  return Boolean(
    account.bank.bankName &&
      account.bank.accountNumber &&
      account.bank.accountHolder
  )
}

export function hasCryptoPayout(account: PayoutAccount): boolean {
  return Boolean(account.crypto.network && account.crypto.walletAddress)
}

export function hasAnyPayout(account: PayoutAccount): boolean {
  return hasBankPayout(account) || hasCryptoPayout(account)
}

export function formatPayoutShareText(input: {
  tripTitle: string
  total: number
  perPerson: number
  memberCount: number
  account: PayoutAccount
}): string {
  const lines = [
    `[WITHTRIP 정산] ${input.tripTitle}`,
    "",
    `총지출: ${input.total.toLocaleString("ko-KR")}원`,
    `참여 ${input.memberCount}명 · 1인당 약 ${input.perPerson.toLocaleString("ko-KR")}원`,
    "",
  ]

  if (hasBankPayout(input.account)) {
    lines.push("■ 수령 계좌")
    lines.push(`${input.account.bank.bankName} ${input.account.bank.accountNumber}`)
    lines.push(`예금주 ${input.account.bank.accountHolder}`)
    lines.push("")
  }

  if (hasCryptoPayout(input.account)) {
    lines.push("■ 코인 지갑")
    lines.push(`${input.account.crypto.network}`)
    lines.push(input.account.crypto.walletAddress)
    lines.push("")
  }

  if (!hasAnyPayout(input.account)) {
    lines.push("수령 계좌가 아직 등록되지 않았어요.")
    lines.push("")
  }

  lines.push("WITHTRIP에서 함께 정산해요 ✈️")
  return lines.join("\n")
}
