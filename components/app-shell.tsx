"use client"

import { Suspense, type ReactNode } from "react"

import { Sidebar, SIDEBAR_WIDTH_PX } from "@/components/sidebar"

function AppShellInner({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop / tablet primary rail — mobile keeps BottomNav in page shells */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div
        className="flex min-h-dvh min-w-0 flex-1 flex-col"
        style={{ ["--app-sidebar-width" as string]: `${SIDEBAR_WIDTH_PX}px` }}
      >
        {children}
      </div>
    </div>
  )
}

/** Global shell: slim icon sidebar + main content. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh bg-background">
          <div
            className="hidden h-dvh w-20 shrink-0 border-r border-border/80 bg-[#F7F4EE] lg:block"
            aria-hidden
          />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      }
    >
      <AppShellInner>{children}</AppShellInner>
    </Suspense>
  )
}
