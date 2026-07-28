"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Compass } from "lucide-react"

import { AccountMenu } from "@/components/account-menu"
import { navItems, type NavKey } from "@/components/bottom-nav"
import { cn } from "@/lib/utils"

/** Global primary sidebar width — sub-panels should start at this offset. */
export const SIDEBAR_WIDTH_PX = 80

function resolveActiveNav(pathname: string, navParam: string | null): NavKey {
  if (pathname === "/around") return "spots"
  if (pathname === "/friends") return "friends"
  if (pathname === "/mypage") return "mypage"
  if (pathname === "/login" || pathname === "/signup" || pathname === "/forgot-password") {
    return "mypage"
  }
  if (pathname.startsWith("/settlement")) return "settlement"
  if (pathname.startsWith("/trips")) return "home"
  if (
    navParam === "friends" ||
    navParam === "spots" ||
    navParam === "mypage" ||
    navParam === "settlement" ||
    navParam === "home"
  ) {
    return navParam
  }
  return "home"
}

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = useMemo(
    () => resolveActiveNav(pathname, searchParams.get("nav")),
    [pathname, searchParams]
  )

  const go = (key: NavKey) => {
    // Keep URL routing authoritative across all desktop pages.
    if (key === "home") {
      router.push("/")
      return
    }
    if (key === "spots") {
      router.push("/around")
      return
    }
    if (key === "friends") {
      router.push("/friends")
      return
    }
    if (key === "settlement") {
      router.push("/settlement")
      return
    }
    if (key === "mypage") {
      router.push("/mypage")
      return
    }
  }

  return (
    <aside
      aria-label="메인 메뉴"
      className="sticky top-0 z-50 flex h-dvh w-20 shrink-0 flex-col items-center border-r border-border/80 bg-[#F7F4EE]/95 py-4 backdrop-blur-md"
      style={{ width: SIDEBAR_WIDTH_PX }}
    >
      {/* Brand */}
      <button
        type="button"
        onClick={() => go("home")}
        aria-label="WITHTRIP 홈으로"
        className="mb-5 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_14px_rgba(255,193,7,0.45)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
      >
        <Compass className="size-5 stroke-[1.6]" />
      </button>

      {/* Main nav */}
      <nav className="flex w-full flex-1 flex-col items-center gap-1.5 px-2">
        {navItems.map((item) => {
          const isActive = item.key === active
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => go(item.key)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              title={item.label}
              className={cn(
                "flex w-full flex-col items-center gap-1 rounded-[1.35rem] px-1 py-2.5 transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(255,193,7,0.38)]"
                  : "text-[#5C5346] hover:bg-primary/25 hover:text-[#3D3428]"
              )}
            >
              <item.icon
                className={cn(
                  "size-[1.15rem]",
                  isActive ? "stroke-[1.7]" : "stroke-[1.35]"
                )}
              />
              <span className="text-[10px] font-semibold leading-none tracking-tight">
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Profile / account */}
      <div className="mt-auto flex flex-col items-center gap-2 pb-1">
        <AccountMenu
          rail
          onLoginClick={() => router.push("/?view=login")}
          onMyPageClick={() => go("mypage")}
        />
      </div>
    </aside>
  )
}
