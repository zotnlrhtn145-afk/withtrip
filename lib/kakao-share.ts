import {
  formatPayoutShareText,
  hasBankPayout,
  hasCryptoPayout,
  type PayoutAccount,
  type PayoutShareTransfer,
} from "@/lib/payout-account"

type KakaoSDK = {
  isInitialized: () => boolean
  init: (key: string) => void
  Share: {
    sendDefault: (settings: Record<string, unknown>) => void
  }
}

declare global {
  interface Window {
    Kakao?: KakaoSDK
  }
}

function getKakaoJsKey() {
  return (
    process.env.NEXT_PUBLIC_KAKAO_JS_KEY?.trim() ||
    process.env.NEXT_PUBLIC_KAKAO_APP_KEY?.trim() ||
    ""
  )
}

async function loadKakaoSdk(): Promise<KakaoSDK | null> {
  if (typeof window === "undefined") return null
  if (window.Kakao) return window.Kakao

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-withtrip-kakao="true"]'
    )
    if (existing) {
      if (window.Kakao) {
        resolve()
        return
      }
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () =>
        reject(new Error("Kakao SDK load failed"))
      )
      return
    }
    const script = document.createElement("script")
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
    script.async = true
    script.dataset.withtripKakao = "true"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Kakao SDK load failed"))
    document.head.appendChild(script)
  })

  return window.Kakao ?? null
}

async function ensureKakaoReady(): Promise<KakaoSDK | null> {
  const key = getKakaoJsKey()
  if (!key) return null

  try {
    const kakao = await loadKakaoSdk()
    if (!kakao) return null
    if (!kakao.isInitialized()) {
      kakao.init(key)
    }
    return kakao.isInitialized() ? kakao : null
  } catch {
    return null
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through
  }
  try {
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.left = "-9999px"
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

export type SettlementShareInput = {
  tripTitle: string
  total: number
  expenseCount: number
  memberCount: number
  transfers: PayoutShareTransfer[]
  account: PayoutAccount
  shareUrl?: string
}

function buildKakaoTitle(tripTitle: string) {
  const name = tripTitle.trim() || "여행"
  return `[${name}] 정산 내역이 도착했어요`
}

function buildKakaoDescription(input: SettlementShareInput): string {
  const lines = [
    `총지출 ${input.total.toLocaleString("ko-KR")}원 · ${input.expenseCount}건 · ${input.memberCount}명`,
  ]

  if (input.transfers.length > 0) {
    lines.push("")
    lines.push("송금 안내")
    for (const transfer of input.transfers) {
      lines.push(
        `${transfer.fromNickname} → ${transfer.toNickname} ${transfer.amount.toLocaleString("ko-KR")}원`
      )
    }
  }

  if (hasBankPayout(input.account)) {
    lines.push(
      `계좌 ${input.account.bank.bankName} ${input.account.bank.accountNumber} (예금주 ${input.account.bank.accountHolder})`
    )
  }

  if (hasCryptoPayout(input.account)) {
    lines.push(
      `지갑 ${input.account.crypto.network} ${input.account.crypto.walletAddress}`
    )
  }

  return lines.join("\n")
}

function resolveShareUrl(shareUrl?: string) {
  if (shareUrl?.trim()) return shareUrl.trim()
  if (typeof window !== "undefined") return window.location.href
  return "https://withtrip.app"
}

/**
 * KakaoTalk-only share via Kakao.Share.sendDefault.
 * Never uses navigator.share (OS share sheet).
 * Falls back to clipboard copy when Kakao key/SDK is unavailable.
 */
export async function shareSettlementSummary(
  input: SettlementShareInput
): Promise<"kakao" | "clipboard" | "failed"> {
  const title = buildKakaoTitle(input.tripTitle)
  const description = buildKakaoDescription(input)
  const clipboardText = formatPayoutShareText(input)
  const url = resolveShareUrl(input.shareUrl)

  const kakao = await ensureKakaoReady()
  if (kakao?.Share?.sendDefault) {
    try {
      // Text template — no image required; opens KakaoTalk share popup.
      kakao.Share.sendDefault({
        objectType: "text",
        text: `${title}\n\n${description}`,
        link: {
          mobileWebUrl: url,
          webUrl: url,
        },
        buttonTitle: "정산 내역 확인하기",
      })
      return "kakao"
    } catch (err) {
      console.warn("[shareSettlementSummary] Kakao.Share.sendDefault failed:", err)
    }
  }

  const copied = await copyTextToClipboard(clipboardText)
  return copied ? "clipboard" : "failed"
}
