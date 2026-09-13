"use client"

import { useEffect, useState, type MouseEvent } from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion, useReducedMotion } from "framer-motion"
import { Compass, Heart, CircleUserRound, type LucideIcon } from "lucide-react"


export type NavKey = "home" | "friends" | "spots" | "settlement" | "mypage" | "saved"

export const navItems: { key: NavKey; label: string; icon: LucideIcon }[] = [
  { key: "home", label: "여행", icon: Compass },
  { key: "saved", label: "찜", icon: Heart },
  { key: "mypage", label: "프로필", icon: CircleUserRound },
]

function toHref(key: NavKey): string {
  if (key === "home") return "/"
  if (key === "spots") return "/around"
  if (key === "friends") return "/friends"
  if (key === "settlement") return "/settlement"
  if (key === "saved") return "/saved"
  return "/mypage"
}

/** 동결 시안 shared-nav.js의 SVG 경로·레이어 순서. */
function ReferenceNavIcon({ item, selected, compact, reduced }: { item: typeof navItems[number]; selected: boolean; compact: boolean; reduced: boolean }) {
  if (item.key === "saved") return <span style={{ width: selected && !compact ? 30 : 25, height: selected && !compact ? 30 : 25, display: "grid", placeItems: "center", flexShrink: 0, transition: reduced ? "none" : "width 280ms, height 280ms" }}><img src="/design/saved-map-pin-figma.svg" alt="" style={{ height: "100%", width: "auto" }} /></span>
  const ink = "#182126", yellow = "#fbbf24", muted = "#747e80"
  const stroke = selected ? ink : muted
  return <svg width={selected && !compact ? 30 : 25} height={selected && !compact ? 30 : 25} style={{ flexShrink: 0, transition: reduced ? "none" : "width 280ms, height 280ms" }} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {item.key === "home" ? <><circle cx="12" cy="12" r="10" fill={selected ? yellow : "none"} stroke={selected ? yellow : stroke} /><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" fill={selected ? ink : "none"} /></> : <><circle cx="12" cy="12" r="10" fill={selected ? yellow : "none"} stroke={selected ? yellow : stroke} /><path d="M17.925 20.056a6 6 0 0 0-11.851.001" /><circle cx="12" cy="11" r="4" /></>}
  </svg>
}

export function BottomNav({
  active,
  onSelect,
  onTabChange,
}: {
  active: NavKey
  onSelect?: (key: NavKey) => void
  onTabChange?: (key: NavKey) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [compact, setCompact] = useState(false)

  const reduced = useReducedMotion()
  useEffect(() => {
    const previous = new WeakMap<object, number>()
    previous.set(document, window.scrollY)
    setCompact(false)
    const onScroll = (event: Event) => {
      const target = event.target
      if (!target || typeof target !== "object") return
      const y = target === document ? window.scrollY : target instanceof HTMLElement ? target.scrollTop : 0
      const delta = y - (previous.get(target) ?? 0)
      previous.set(target, y)
      if (y < 15) setCompact(false)
      else if (Math.abs(delta) > 5) setCompact(delta > 0)
    }
    document.addEventListener("scroll", onScroll, { passive: true, capture: true })
    return () => document.removeEventListener("scroll", onScroll, { capture: true })
  }, [pathname])

  const handleTabClick = (event: MouseEvent<HTMLButtonElement>, key: NavKey) => {
    event.stopPropagation()

    // 1) Sync upper SPA state if a callback exists.
    onTabChange?.(key)
    onSelect?.(key)

    // 2) Always sync URL routing so state and path never diverge.
    const href = toHref(key)
    if (pathname !== href || key === "home") {
      router.push(href)
    }
  }

  if (pathname === "/saved" || pathname.startsWith("/saved/")) return null
  return (
    <nav aria-label="주요 메뉴"
      style={{ bottom: "max(16px, env(safe-area-inset-bottom))", width: compact ? 210 : "calc(100% - 44px)", maxWidth: 396, padding: compact ? "4px 8px" : "6px 10px", transition: reduced ? "none" : "width 350ms cubic-bezier(.22,1,.36,1), padding 350ms cubic-bezier(.22,1,.36,1)" }}
      className="fixed inset-x-0 z-20 mx-auto rounded-[38px] border border-[#f6f7f6] bg-[#fffffff5] shadow-[0_5px_26px_#202a3210] backdrop-blur-[16px] md:hidden">
      <ul className="m-0 flex list-none items-center gap-[6px] p-0">
        {navItems.map(item => {
          const selected = item.key === active
          return <motion.li key={item.key} initial={false} animate={{ flex: selected && !compact ? 1.8 : 1 }} transition={{ duration: reduced ? 0 : .35, ease: [.22, 1, .36, 1] }} className="min-w-11">
            <motion.button type="button" aria-label={item.label} aria-current={selected ? "page" : undefined}
              onClick={event => handleTabClick(event, item.key)} whileTap={reduced ? undefined : { scale: .93 }}
              style={{ gap: selected && !compact ? 9 : 0 }}
              className="flex min-h-12 w-full min-w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-amber-400">
              <ReferenceNavIcon item={item} selected={selected} compact={compact} reduced={!!reduced} />
              <span style={{ maxWidth: selected && !compact ? 60 : 0, opacity: selected && !compact ? 1 : 0, transition: reduced ? "none" : "max-width 220ms, opacity 220ms" }} className="overflow-hidden text-[14px] font-[650] whitespace-nowrap text-[#182126]">{item.label}</span>
            </motion.button>
          </motion.li>
        })}
      </ul>
    </nav>
  )
}
