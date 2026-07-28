"use client"

import { useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Compass, Plus } from "lucide-react"

import { BottomNav, type NavKey } from "@/components/bottom-nav"
import { CreateTripDialog } from "@/components/create-trip-dialog"

function resolveActive(pathname: string, nav: string | null): NavKey {
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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const active = useMemo(
    () => resolveActive(pathname, searchParams.get("nav")),
    [pathname, searchParams]
  )

  const navigate = (key: NavKey) => {
    if (key === "home") {
      router.push("/")
      return
    }
    if (key === "settlement") {
      router.push("/settlement")
      return
    }
    router.push(`/?nav=${key}`)
  }

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

      <BottomNav active={active} onSelect={navigate} />
    </>
  )
}
