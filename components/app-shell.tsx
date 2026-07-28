"use client"

import { Suspense, useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"

import { MobileGlobalChrome } from "@/components/mobile-global-chrome"
import { NotificationDrawer } from "@/components/notifications/NotificationDrawer"
import { NotificationsProvider } from "@/components/notifications/notifications-provider"
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
          className="relative hidden w-20 shrink-0 lg:block"
          style={{ width: SIDEBAR_WIDTH_PX }}
        >
          <Sidebar />
        </div>

        <div
          className="flex min-h-screen min-w-0 flex-1 flex-col bg-white"
          style={{ ["--app-sidebar-width" as string]: `${SIDEBAR_WIDTH_PX}px` }}
        >
          <MobileGlobalChrome />
          <div
            className={
              pathname === "/notifications"
                ? "w-full flex-1"
                : "w-full flex-1 pt-12 pb-24 md:pt-0 md:pb-0"
            }
          >
            {children}
          </div>
        </div>
      </div>

      <NotificationDrawer
        onSelectTrip={(trip) => {
          router.push(`/trips/${trip.id}`)
        }}
      />
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
                className="hidden h-screen w-20 shrink-0 border-r border-border/80 bg-[#F7F4EE] lg:block"
                style={{ width: SIDEBAR_WIDTH_PX }}
                aria-hidden
              />
              <div className="min-h-screen min-w-0 flex-1 bg-white">{children}</div>
            </div>
          }
        >
          <AppShellInner>{children}</AppShellInner>
        </Suspense>
      </NotificationsProvider>
    </TripsProvider>
  )
}
