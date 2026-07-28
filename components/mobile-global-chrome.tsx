"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { PlusSquare } from "lucide-react"

import { AccountMenu } from "@/components/account-menu"
import { BottomNav, type NavKey } from "@/components/bottom-nav"
import { CreateTripDialog } from "@/components/create-trip-dialog"
import { NotificationBellButton } from "@/components/notifications/NotificationBellButton"
import { createClient } from "@/utils/supabase/client"

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

function HeaderLoginButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-full bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-200"
    >
      로그인
    </button>
  )
}

function HeaderAuthControl() {
  const router = useRouter()
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    setSupabase(createClient())
  }, [])

  useEffect(() => {
    if (!supabase) return
    let mounted = true
    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setUser(data.user ?? null)
      setReady(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setReady(true)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const goLogin = () => router.push("/login")
  const goMyPage = () => router.push("/mypage")

  if (!ready) {
    return (
      <button
        type="button"
        disabled
        className="cursor-pointer rounded-full bg-slate-100 px-4 py-1.5 text-sm font-semibold text-slate-900 opacity-60 transition-all"
      >
        로그인
      </button>
    )
  }

  if (!user) {
    return <HeaderLoginButton onClick={goLogin} />
  }

  return (
    <AccountMenu compact onLoginClick={goLogin} onMyPageClick={goMyPage} />
  )
}

export function MobileGlobalChrome() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const viewParam = searchParams.get("view")

  const active = useMemo(
    () => resolveActive(pathname, searchParams.get("nav")),
    [pathname, searchParams]
  )

  const hideChrome =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    viewParam === "login" ||
    viewParam === "signup" ||
    viewParam === "forgot-password"

  const hideBottomNav = hideChrome

  return (
    <>
      {!hideChrome ? (
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <CreateTripDialog
              trigger={
                <button
                  type="button"
                  aria-label="새 여행 만들기"
                  className="flex size-9 items-center justify-center text-slate-800 transition-colors hover:text-black"
                >
                  <PlusSquare className="size-6 stroke-[1.5]" />
                </button>
              }
            />

            <div className="flex flex-row items-center gap-3">
              <HeaderAuthControl />
              <NotificationBellButton className="size-9" iconClassName="size-5" />
            </div>
          </div>
        </header>
      ) : null}

      {!hideBottomNav ? (
        <BottomNav
          active={active}
          onTabChange={(key: NavKey) =>
            window.dispatchEvent(
              new CustomEvent("withtrip:bottom-nav-tab", { detail: { key } })
            )
          }
        />
      ) : null}
    </>
  )
}
