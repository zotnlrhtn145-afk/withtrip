"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Compass } from "lucide-react"

import { navItems, type NavKey } from "@/components/bottom-nav"
import { useNotifications } from "@/components/notifications/notifications-provider"
import { cn } from "@/lib/utils"

/** Global primary sidebar width — sub-panels should start at this offset. */
export const SIDEBAR_WIDTH_PX = 80

function hrefFor(key: NavKey): string {
  if (key === "home") return "/"
  if (key === "spots") return "/spots"
  if (key === "friends") return "/friends"
  if (key === "settlement") return "/settlement"
  return "/mypage"
}

function isActiveNav(pathname: string, key: NavKey): boolean {
  if (key === "home") return pathname === "/"
  if (key === "spots") return pathname.startsWith("/spots") || pathname.startsWith("/around")
  if (key === "friends") return pathname.startsWith("/friends")
  if (key === "settlement") {
    return pathname.startsWith("/settlement") || pathname.startsWith("/bills")
  }
  return pathname.startsWith("/mypage") || pathname.startsWith("/login")
}

export function Sidebar() {
  const pathname = usePathname()
  const { openDrawer, openMobileNotifications, drawerOpen, isMobileNotificationOpen, unreadCount } =
    useNotifications()

  const handleOpenNotifications = () => {
    // Sidebar itself is visible from md: (768px) up, but the desktop slide-in
    // drawer only renders from lg: (1024px) up — below that, fall back to the
    // mobile full-screen drawer so the click actually shows something.
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      openDrawer()
      return
    }
    openMobileNotifications()
  }

  const notificationsActive = drawerOpen || isMobileNotificationOpen

  return (
    <aside
      aria-label="메인 메뉴"
      className="pointer-events-auto fixed top-0 left-0 z-50 flex h-screen w-20 flex-col items-center border-r border-border/80 bg-[#F7F4EE]/95 py-4 backdrop-blur-md max-md:hidden"
      style={{ width: SIDEBAR_WIDTH_PX }}
    >
      {/* Brand */}
      <Link
        href="/"
        aria-label="WITHTRIP 홈으로"
        className="mb-5 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_14px_rgba(255,193,7,0.45)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
      >
        <Compass className="size-5 stroke-[1.6]" />
      </Link>

      {/* Main nav */}
      <nav className="flex w-full flex-1 flex-col items-center gap-1.5 px-2">
        {navItems.map((item) => {
          const isActive = isActiveNav(pathname, item.key)
          return (
            <Link
              key={item.key}
              href={hrefFor(item.key)}
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
            </Link>
          )
        })}

        <button
          type="button"
          aria-label={unreadCount > 0 ? `알림 ${unreadCount}개` : "알림"}
          title="알림"
          onClick={handleOpenNotifications}
          className={cn(
            "relative mt-1 flex w-full flex-col items-center gap-1 rounded-[1.35rem] px-1 py-2.5 transition-all duration-200",
            notificationsActive
              ? "bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(255,193,7,0.38)]"
              : "text-[#5C5346] hover:bg-primary/25 hover:text-[#3D3428]"
          )}
        >
          <Bell className={cn("size-[1.15rem]", notificationsActive ? "stroke-[1.7]" : "stroke-[1.35]")} />
          <span className="text-[10px] font-semibold leading-none tracking-tight">알림</span>
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-2 right-3 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-[#F7F4EE]"
            />
          ) : null}
        </button>
      </nav>
    </aside>
  )
}
