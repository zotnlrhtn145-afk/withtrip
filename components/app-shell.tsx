"use client"

import { Suspense, type ReactNode } from "react"

import { MobileGlobalChrome } from "@/components/mobile-global-chrome"
import { Sidebar, SIDEBAR_WIDTH_PX } from "@/components/sidebar"
import { TripsProvider } from "@/components/trips-store"

function AppShellInner({ children }: { children: ReactNode }) {
  return (
    <TripsProvider>
      <div className="flex min-h-dvh max-w-full overflow-x-hidden bg-background">
        {/* Desktop / tablet primary rail */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <div
          className="flex min-h-dvh min-w-0 max-w-full flex-1 flex-col overflow-x-hidden"
          style={{ ["--app-sidebar-width" as string]: `${SIDEBAR_WIDTH_PX}px` }}
        >
          {/* Mobile-only global top/bottom chrome */}
          <MobileGlobalChrome />
          <div className="max-w-full overflow-x-hidden pt-12 pb-24 md:pt-0 md:pb-0">
            {children}
          </div>
        </div>
      </div>
    </TripsProvider>
  )
}

/** Global shell: slim icon sidebar + main content. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <TripsProvider>
          <div className="flex min-h-dvh max-w-full overflow-x-hidden bg-background">
            <div
              className="hidden h-dvh w-20 shrink-0 border-r border-border/80 bg-[#F7F4EE] lg:block"
              aria-hidden
            />
            <div className="min-w-0 max-w-full flex-1 overflow-x-hidden">{children}</div>
          </div>
        </TripsProvider>
      }
    >
      <AppShellInner>{children}</AppShellInner>
    </Suspense>
  )
}
