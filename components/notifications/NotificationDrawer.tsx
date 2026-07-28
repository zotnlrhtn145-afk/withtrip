"use client"

import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"

import { NotificationList } from "@/components/notifications/NotificationList"
import { useNotifications } from "@/components/notifications/notifications-provider"
import { SIDEBAR_WIDTH_PX } from "@/components/sidebar"

export function NotificationDrawer({
  onSelectTrip,
}: {
  onSelectTrip?: (trip: { id: string }) => void
}) {
  const { drawerOpen, closeDrawer, setDrawerOpen } = useNotifications()

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [drawerOpen, closeDrawer])

  return (
    <AnimatePresence>
      {drawerOpen ? (
        <>
          <motion.button
            key="notification-drawer-backdrop"
            type="button"
            aria-label="알림 닫기"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 hidden bg-black/20 backdrop-blur-[1px] lg:block"
            style={{ left: SIDEBAR_WIDTH_PX }}
            onClick={() => setDrawerOpen(false)}
          />
          <motion.aside
            key="notification-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="알림"
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 z-40 hidden h-screen w-[380px] flex-col border-r border-slate-100 bg-white/95 shadow-2xl backdrop-blur-xl lg:flex"
            style={{ left: SIDEBAR_WIDTH_PX }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold tracking-tight text-slate-900">알림</h2>
              <button
                type="button"
                aria-label="닫기"
                onClick={closeDrawer}
                className="flex size-8 items-center justify-center rounded-full text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <NotificationList onSelectTrip={onSelectTrip} compact />
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
