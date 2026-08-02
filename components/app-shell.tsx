"use client"

import { Suspense, useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"

import { MobileGlobalChrome } from "@/components/mobile-global-chrome"
import { LoginNavigationProvider } from "@/components/login-navigation"
import { MobileNotificationDrawer } from "@/components/notifications/MobileNotificationDrawer"
import { NotificationDrawer } from "@/components/notifications/NotificationDrawer"
import { NotificationsProvider } from "@/components/notifications/notifications-provider"
import { GlobalQuickAdd } from "@/components/quick-register/global-quick-add"
import { Sidebar, SIDEBAR_WIDTH_PX } from "@/components/sidebar"
import { TripsProvider } from "@/components/trips-store"
import { clearDocumentScrollLock } from "@/lib/clear-scroll-lock"

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  // Drop stuck dialog/modal scroll locks so mouse wheel works again.
  useEffect(() => {
    clearDocumentScrollLock()
    const timer = window.setTimeout(() => clearDocumentScrollLock(), 0)
    return () => window.clearTimeout(timer)
  }, [pathname])

  return (
    <>
      {/*
        Keep the proven flex shell: reserved w-20 rail on desktop + flexible main.
        Do NOT use overflow-x-hidden here — it can trap overflow-y and kill wheel scroll.
      */}
      <div className="flex min-h-screen w-full bg-white">
        {/* Desktop rail spacer — keeps layout width while Sidebar is position:fixed */}
        <div
          className="relative hidden w-20 shrink-0 md:block"
          style={{ width: SIDEBAR_WIDTH_PX }}
        >
          <Sidebar />
        </div>

        <div
          className="flex min-h-screen min-w-0 flex-1 flex-col bg-white"
          style={{ ["--app-sidebar-width" as string]: `${SIDEBAR_WIDTH_PX}px` }}
        >
          <MobileGlobalChrome />
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname.split("/")[1] || "home"}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="w-full flex-1 pb-24 md:pt-0 md:pb-0"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <NotificationDrawer
        onSelectTrip={(trip) => {
          router.push(`/trips/${trip.id}`)
        }}
      />
      <MobileNotificationDrawer
        onSelectTrip={(trip) => {
          router.push(`/trips/${trip.id}`)
        }}
      />
      <GlobalQuickAdd />
    </>
  )
}

/** Global shell: slim icon sidebar + main content. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TripsProvider>
      <NotificationsProvider>
        <Suspense
          fallback={
            <div className="flex min-h-screen w-full bg-white">
              <div
                className="hidden h-screen w-20 shrink-0 border-r border-border/80 bg-[#F7F4EE] md:block"
                style={{ width: SIDEBAR_WIDTH_PX }}
                aria-hidden
              />
              <div className="min-h-screen min-w-0 flex-1 bg-white">{children}</div>
            </div>
          }
        >
          <LoginNavigationProvider>
            <AppShellInner>{children}</AppShellInner>
          </LoginNavigationProvider>
        </Suspense>
      </NotificationsProvider>
    </TripsProvider>
  )
}
