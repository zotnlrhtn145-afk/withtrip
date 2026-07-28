"use client"

import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"

import { NotificationList } from "@/components/notifications/NotificationList"
import { useNotifications } from "@/components/notifications/notifications-provider"

/**
 * Mobile full-screen notification panel — slides in from the right.
 */
export function MobileNotificationDrawer({
  onSelectTrip,
}: {
  onSelectTrip?: (trip: { id: string }) => void
}) {
  const {
    isMobileNotificationOpen,
    closeMobileNotifications,
    setMobileNotificationOpen,
  } = useNotifications()

  useEffect(() => {
    if (!isMobileNotificationOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileNotifications()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKey)
    }
  }, [isMobileNotificationOpen, closeMobileNotifications])

  return (
    <AnimatePresence>
      {isMobileNotificationOpen ? (
        <>
          <motion.button
            key="mobile-notification-backdrop"
            type="button"
            aria-label="알림 닫기"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[55] bg-black/25 lg:hidden"
            onClick={() => setMobileNotificationOpen(false)}
          />
          <motion.aside
            key="mobile-notification-panel"
            role="dialog"
            aria-modal="true"
            aria-label="알림"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed top-0 right-0 z-[60] flex h-[100dvh] w-full max-w-md flex-col bg-white shadow-2xl lg:hidden"
          >
            <header className="relative flex items-center justify-between border-b border-slate-100 px-2 py-3">
              <button
                type="button"
                aria-label="뒤로가기"
                onClick={closeMobileNotifications}
                className="flex size-10 items-center justify-center rounded-full text-slate-800 transition-colors hover:bg-slate-100"
              >
                <ArrowLeft className="size-5" />
              </button>
              <h2 className="pointer-events-none absolute inset-x-0 text-center text-base font-bold text-slate-900">
                알림
              </h2>
              <span className="size-10 shrink-0" aria-hidden />
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <NotificationList
                onSelectTrip={(trip) => {
                  closeMobileNotifications()
                  onSelectTrip?.(trip)
                }}
              />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
