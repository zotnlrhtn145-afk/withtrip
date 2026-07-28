"use client"

import { useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Compass, Plus } from "lucide-react"

import { BottomNav, type NavKey } from "@/components/bottom-nav"
import { CreateTripDialog } from "@/components/create-trip-dialog"

function resolveActive(pathname: string, nav: string | null): NavKey {
  if (pathname === "/around") return "spots"
  if (pathname === "/friends") return "friends"
  if (pathname === "/mypage") return "mypage"
  if (pathname.startsWith("/settlement")) return "settlement"
  if (pathname === "/") {
    if (nav === "spots") return "spots"
    if (nav === "friends") return "friends"
    if (nav === "mypage") return "mypage"
    return "home"
  }
  return "home"
}

export function MobileGlobalChrome() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const viewParam = searchParams.get("view")

  const active = useMemo(
    () => resolveActive(pathname, searchParams.get("nav")),
    [pathname, searchParams]
  )

  const hideBottomNav =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    viewParam === "login" ||
    viewParam === "signup" ||
    viewParam === "forgot-password"

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 md:hidden">
        <div className="mx-auto flex h-12 w-full max-w-md items-center justify-between border-b border-border/60 bg-background/90 px-3 backdrop-blur">
          <div className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
            <Compass className="size-4 text-primary" />
            WITHTRIP
          </div>
          <CreateTripDialog
            trigger={
              <button
                type="button"
                aria-label="새 여행 만들기"
                className="flex size-8 items-center justify-center rounded-full bg-secondary text-foreground transition active:scale-95"
              >
                <Plus className="size-4" />
              </button>
            }
          />
        </div>
      </header>

      {!hideBottomNav ? (
        <BottomNav
          active={active}
          onTabChange={(key: NavKey) => {
            // Keep explicit state callback channel for SPA shells.
            void key
          }}
        />
      ) : null}
    </>
  )
}
