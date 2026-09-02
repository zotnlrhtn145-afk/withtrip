"use client"

/**
 * 주소·전화번호 한 줄 — **누를 수 있다.**
 *
 * ⚠️ 그동안 둘 다 그냥 글자였다. 식당에 전화하려면 번호를 눈으로 읽어 옮겨
 *    적어야 했고, 주소는 아예 옮길 방법이 없었다(신고받음).
 *
 * ⚠️ 화면마다 아이콘 + 회색 글자로 따로 그려져 있어서, 한 곳만 고치면 나머지는
 *    죽은 글자로 남는다. 줄 자체를 하나로 모은다. (앱의 `ContactLine` 과 같다)
 *
 * ⚠️ **복사는 눈에 보이는 결과가 없다.** 눌렀는지 알 수 없으면 사람은 두 번,
 *    세 번 누른다 — 그래서 잠깐 「복사됨」으로 바뀐다.
 */

import { Check, MapPin, Phone } from "lucide-react"
import { useEffect, useRef, useState } from "react"

function dialable(phone: string): string {
  const t = String(phone ?? "").trim()
  const plus = t.startsWith("+")
  const digits = t.replace(/[^0-9]/g, "")
  return digits ? `${plus ? "+" : ""}${digits}` : ""
}

export function ContactLine({
  kind,
  value,
  className,
  iconClassName,
  textClassName,
}: {
  kind: "address" | "phone"
  value: string
  className?: string
  iconClassName?: string
  textClassName?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const text = String(value ?? "").trim()
  if (!text) return null

  const Icon = kind === "phone" ? Phone : MapPin
  const icon = `size-3.5 shrink-0 text-amber-500 ${kind === "phone" ? "" : "mt-0.5"} ${iconClassName ?? ""}`
  const row = `group flex w-fit max-w-full items-start gap-1.5 text-left transition-opacity hover:opacity-70 ${className ?? ""}`

  /* 전화는 링크로 둔다 — 길게 눌러 저장하거나 새 탭으로 여는 브라우저 기능이 살아 있다 */
  if (kind === "phone") {
    const num = dialable(text)
    return (
      <a href={num ? `tel:${num}` : undefined} className={`${row} items-center tabular-nums`}>
        <Icon className={icon} />
        <span className={`min-w-0 break-keep underline-offset-4 group-hover:underline ${textClassName ?? ""}`}>
          {text}
        </span>
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setCopied(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), 1600)
      }}
      className={row}
      title="주소 복사"
    >
      {copied ? <Check className={`${icon} text-emerald-600`} /> : <Icon className={icon} />}
      <span className={`min-w-0 break-keep ${textClassName ?? ""}`}>{copied ? "주소를 복사했어요" : text}</span>
    </button>
  )
}
