"use client"

import { useEffect, useState, type MouseEvent } from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion, useReducedMotion } from "framer-motion"
import { Compass, Heart, CircleUserRound, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

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
    let previousY = window.scrollY
    setCompact(false)
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - previousY
      previousY = y
      if (y < 20) setCompact(false)
      else if (Math.abs(delta) > 4) setCompact(delta > 0)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
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
    <motion.nav aria-label="주요 메뉴" initial={false}
      animate={{ width: compact ? 210 : 350 }}
      transition={{ duration: reduced ? 0 : .3, ease: [.22, 1, .36, 1] }}
      style={{ bottom: "max(16px, env(safe-area-inset-bottom))", maxWidth: "calc(100% - 44px)" }}
      className="fixed inset-x-0 z-20 mx-auto rounded-full border border-slate-100 bg-white/95 px-3 py-2 shadow-[0_6px_28px_#0f172a14] backdrop-blur-xl md:hidden">
      <ul className="m-0 flex list-none items-center justify-around p-0">
        {navItems.map(item => {
          const selected = item.key === active
          return <li key={item.key}>
            <motion.button type="button" aria-label={item.label} aria-current={selected ? "page" : undefined}
              onClick={event => handleTabClick(event, item.key)} whileTap={reduced ? undefined : { scale: .92 }}
              className="flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full px-2 focus-visible:outline-2 focus-visible:outline-amber-400">
              <item.icon className={cn("size-7 stroke-[1.8]", selected ? "fill-amber-400 text-slate-900" : "text-slate-500")} />
              {selected && !compact ? <span className="text-[13px] font-bold text-slate-900">{item.label}</span> : null}
            </motion.button>
          </li>
        })}
      </ul>
    </motion.nav>
  )
}
