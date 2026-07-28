"use client"

import { useEffect, useState, type MouseEvent } from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Home, MapPin, UserRound, Users, Wallet, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type NavKey = "home" | "friends" | "spots" | "settlement" | "mypage"

export const navItems: { key: NavKey; label: string; icon: LucideIcon }[] = [
  { key: "home", label: "홈", icon: Home },
  { key: "spots", label: "주변 스팟", icon: MapPin },
  { key: "friends", label: "친구", icon: Users },
  { key: "settlement", label: "정산", icon: Wallet },
  { key: "mypage", label: "마이", icon: UserRound },
]

function toHref(key: NavKey): string {
  if (key === "home") return "/"
  if (key === "spots") return "/around"
  if (key === "friends") return "/friends"
  if (key === "settlement") return "/settlement"
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

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 20)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

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

  return (
    <nav
      aria-label="주요 메뉴"
      style={{
        position: "fixed",
        bottom: "1rem",
        left: 0,
        right: 0,
        marginLeft: "auto",
        marginRight: "auto",
        zIndex: 99999,
        width: "calc(100% - 2rem)",
        maxWidth: "380px",
        pointerEvents: "auto",
      }}
      className={cn(
        "fixed bottom-4 inset-x-0 mx-auto z-[99999] w-[calc(100%-2rem)] max-w-[380px] md:hidden",
        "flex items-center justify-between px-3 py-2 pointer-events-auto",
        "rounded-full border border-white/30 bg-white/85 shadow-2xl backdrop-blur-md",
        "transition-all duration-300 ease-in-out transform",
        compact ? "scale-90 opacity-90 py-1.5" : "scale-100 opacity-100 py-3"
      )}
    >
      <ul className="relative m-0 flex w-full list-none items-center justify-between px-0 py-0">
        {navItems.map((item) => {
          const isActive = item.key === active
          return (
            <li key={item.key} className="relative m-0 list-none flex-1 p-0">
              <motion.button
                type="button"
                onClick={(event) => handleTabClick(event, item.key)}
                aria-current={isActive ? "page" : undefined}
                style={{ touchAction: "manipulation" }}
                whileTap={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 460, damping: 28 }}
                className={cn(
                  "relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium whitespace-nowrap",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {isActive ? (
                  <motion.div
                    layoutId="activeTabIndicator"
                    transition={{ type: "spring", stiffness: 520, damping: 34 }}
                    className="absolute inset-y-0 left-1/2 z-[-1] my-auto h-9 w-[3.1rem] -translate-x-1/2 rounded-full bg-primary/25"
                  />
                ) : null}
                <item.icon className="size-4.5 stroke-[1.8]" />
                <span>{item.label}</span>
              </motion.button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
