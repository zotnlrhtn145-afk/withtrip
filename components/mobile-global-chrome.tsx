"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { LogIn, PlusSquare } from "lucide-react"

import { AccountMenu } from "@/components/account-menu"
import { BottomNav, type NavKey } from "@/components/bottom-nav"
import { useNavigateToLogin } from "@/components/login-navigation"
import { NotificationBellButton } from "@/components/notifications/NotificationBellButton"
import { createClient } from "@/utils/supabase/client"

function resolveActive(pathname: string, nav: string | null): NavKey {
  if (pathname === "/around") return "spots"
  if (pathname === "/friends") return "friends"
  if (pathname === "/mypage") return "mypage"
  if (pathname === "/saved") return "saved"
  if (pathname.startsWith("/settlement")) return "settlement"
  if (pathname === "/") {
    if (nav === "spots") return "spots"
    if (nav === "friends") return "friends"
    if (nav === "mypage") return "mypage"
    if (nav === "saved") return "saved"
    return "home"
  }
  return "home"
}

const loginIconButtonClassName =
  "cursor-pointer rounded-full p-2 text-slate-800 transition-all hover:bg-slate-100/80 hover:text-black active:scale-95"

function HeaderLoginButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="로그인"
      className={loginIconButtonClassName}
    >
      <LogIn className="size-5 stroke-[1.5]" />
    </button>
  )
}

function HeaderAuthControl() {
  const router = useRouter()
  const { navigateToLogin } = useNavigateToLogin()
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

  const goMyPage = () => router.push("/mypage")

  if (!ready) {
    return (
      <button
        type="button"
        disabled
        aria-label="로그인"
        className={`${loginIconButtonClassName} opacity-60`}
      >
        <LogIn className="size-5 stroke-[1.5]" />
      </button>
    )
  }

  if (!user) {
    return <HeaderLoginButton onClick={navigateToLogin} />
  }

  return (
    <AccountMenu
      compact
      onLoginClick={navigateToLogin}
      onMyPageClick={goMyPage}
    />
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

  // The trip detail page (/trips/[id]) renders its own header (with a "목록으로"
  // back button), so the global mobile header would stack a second bar on top of
  // it. Hide the global header there — but keep the bottom nav.
  const hideHeader = hideChrome || pathname.startsWith("/trips/")

  const hideBottomNav = hideChrome

  return (
    <>
      {!hideHeader ? (
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              aria-label="퀵 등록"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("withtrip:open-quick-menu"))
              }
              className="flex size-9 items-center justify-center text-slate-800 transition-colors hover:text-black"
            >
              <PlusSquare className="size-6 stroke-[1.5]" />
            </button>

            <div className="flex flex-row items-center gap-1.5">
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
