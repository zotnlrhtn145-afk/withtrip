"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Compass, Home, MapPin, Plus, UserRound, Users, Wallet } from "lucide-react"

import { CreateTripDialog } from "@/components/create-trip-dialog"
import { cn } from "@/lib/utils"

type TabKey = "home" | "spots" | "friends" | "settlement" | "mypage"

const items: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "home", label: "홈", icon: Home },
  { key: "spots", label: "주변", icon: MapPin },
  { key: "friends", label: "친구", icon: Users },
  { key: "settlement", label: "정산", icon: Wallet },
  { key: "mypage", label: "마이", icon: UserRound },
]

function resolveActive(pathname: string, nav: string | null): TabKey {
  if (pathname.startsWith("/settlement")) return "settlement"
  if (pathname === "/") {
    if (nav === "spots") return "spots"
    if (nav === "friends") return "friends"
    if (nav === "mypage") return "mypage"
    return "home"
  }
  return "home"
}

export function MobileGlobalChrome() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [compact, setCompact] = useState(false)

  const active = useMemo(
    () => resolveActive(pathname, searchParams.get("nav")),
    [pathname, searchParams]
  )

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 20)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const navigate = (key: TabKey) => {
    if (key === "home") {
      router.push("/")
      return
    }
    if (key === "settlement") {
      router.push("/settlement")
      return
    }
    router.push(`/?nav=${key}`)
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 md:hidden">
        <div className="mx-auto flex h-12 w-full max-w-md items-center justify-between border-b border-border/60 bg-background/90 px-3 backdrop-blur">
          <div className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
            <Compass className="size-4 text-primary" />
            WITHTRIP
          </div>
          <CreateTripDialog
            trigger={
              <button
                type="button"
                aria-label="새 여행 만들기"
                className="flex size-8 items-center justify-center rounded-full bg-secondary text-foreground transition active:scale-95"
              >
                <Plus className="size-4" />
              </button>
            }
          />
        </div>
      </header>

      <nav
        aria-label="주요 메뉴"
        className={cn(
          "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 md:hidden",
          "rounded-full border border-white/20 bg-white/80 shadow-xl backdrop-blur-md",
          "transition-all duration-300 ease-in-out transform",
          compact
            ? "scale-90 opacity-90 py-1.5"
            : "scale-100 opacity-100 py-3"
        )}
      >
        <ul className="relative flex items-center justify-around px-2">
          {items.map((item) => {
            const isActive = active === item.key
            return (
              <li key={item.key} className="relative flex-1">
                <motion.button
                  type="button"
                  onClick={() => navigate(item.key)}
                  aria-current={isActive ? "page" : undefined}
                  whileTap={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 460, damping: 28 }}
                  className={cn(
                    "relative z-10 flex w-full flex-col items-center gap-1 py-1 text-[10px] font-medium",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {isActive ? (
                    <motion.div
                      layoutId="activeTabIndicator"
                      transition={{ type: "spring", stiffness: 520, damping: 34 }}
                      className="absolute top-0 left-1/2 -z-10 h-9 w-[3.1rem] -translate-x-1/2 rounded-full bg-primary/25"
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
    </>
  )
}
