"use client"

import { Home, MapPin, Plus, UserRound, Users, Wallet, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type NavKey = "home" | "friends" | "spots" | "settlement" | "mypage"

export const navItems: { key: NavKey; label: string; icon: LucideIcon }[] = [
  { key: "home", label: "홈", icon: Home },
  { key: "spots", label: "주변 스팟", icon: MapPin },
  { key: "friends", label: "친구", icon: Users },
  { key: "settlement", label: "정산", icon: Wallet },
  { key: "mypage", label: "마이", icon: UserRound },
]

export function BottomNav({
  active,
  onSelect,
  onQuickAdd,
}: {
  active: NavKey
  onSelect: (key: NavKey) => void
  onQuickAdd?: () => void
}) {
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="relative px-1">
        <button
          type="button"
          onClick={onQuickAdd}
          aria-label="퀵 등록"
          className={cn(
            "absolute left-1/2 z-10 flex size-[3.75rem] -translate-x-1/2 -translate-y-[55%] items-center justify-center rounded-full",
            "bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(255,193,7,0.45)]",
            "ring-[6px] ring-card transform-gpu transition-transform duration-150 ease-out active:scale-[0.97]",
            "hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
          )}
        >
          <Plus className="size-7 stroke-[2.5]" />
        </button>

        <ul className="flex items-stretch pt-3">
          {navItems.map((item) => {
            const isActive = item.key === active
            return (
              <li key={item.key} className="flex-1">
                <button
                  type="button"
                  onClick={() => onSelect(item.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex w-full flex-col items-center gap-1 py-2 text-[10px] font-medium transform-gpu transition-[color,transform] duration-150 ease-out active:scale-[0.97] sm:text-[11px]",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "bg-transparent"
                    )}
                  >
                    <item.icon className="size-4 stroke-[1.35]" />
                  </span>
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
