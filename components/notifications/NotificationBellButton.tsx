"use client"

import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"

import { useNotifications } from "@/components/notifications/notifications-provider"
import { cn } from "@/lib/utils"

/**
 * Bell trigger: desktop opens the Instagram-style drawer;
 * mobile routes to `/notifications`.
 */
export function NotificationBellButton({
  className,
  iconClassName,
}: {
  className?: string
  iconClassName?: string
}) {
  const router = useRouter()
  const { openDrawer, unreadCount } = useNotifications()

  const handleClick = () => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      openDrawer()
      return
    }
    router.push("/notifications")
  }

  return (
    <button
      type="button"
      aria-label={unreadCount > 0 ? `알림 ${unreadCount}개` : "알림"}
      onClick={handleClick}
      className={cn(
        "relative flex size-9 items-center justify-center rounded-full text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900",
        className
      )}
    >
      <Bell className={cn("size-5", iconClassName)} />
      {unreadCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white"
        />
      ) : null}
    </button>
  )
}
