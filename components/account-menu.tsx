"use client";

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { LogIn, LogOut, UserRound } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { clearWithTripClientCaches } from "@/lib/client-session-reset"
import { createClient } from "@/utils/supabase/client"

type AccountProfile = {
  name: string
  email: string
  initials: string
  avatarUrl: string | null
}

function profileFromUser(user: User): AccountProfile {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const metaName = [meta.full_name, meta.name, meta.preferred_username, meta.nickname]
    .map((value) => String(value ?? "").trim())
    .find(Boolean)
  const email = String(user.email ?? meta.email ?? "").trim()
  const name = metaName || (email ? email.split("@")[0] : "") || "회원"
  const avatarUrl =
    [meta.avatar_url, meta.picture, meta.profile_image]
      .map((value) => String(value ?? "").trim())
      .find(Boolean) || null

  const initialsSource = name.replace(/\s+/g, "")
  const initials =
    initialsSource.length >= 2
      ? initialsSource.slice(0, 2).toUpperCase()
      : (initialsSource || "WT").toUpperCase()

  return { name, email, initials, avatarUrl }
}

export function AccountMenu({
  compact = false,
  rail = false,
  onLoginClick,
  onMyPageClick,
  onLogout,
}: {
  compact?: boolean
  /** Slim sidebar avatar trigger (dark circle + initials). */
  rail?: boolean
  /** @deprecated Auth state is read from Supabase; kept for optional parent sync. */
  isLoggedIn?: boolean
  onLoginClick: () => void
  onMyPageClick: () => void
  onLogout?: () => void
}) {
  const router = useRouter()
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    setSupabase(createClient())
  }, [])

  useEffect(() => {
    if (!supabase) return
    let mounted = true

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return
      // "Auth session missing" is normal when logged out — don't treat as hard error.
      if (error && error.message !== "Auth session missing!") {
        console.warn("[AccountMenu] getUser:", error.message)
      }
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

  const handleLogout = async () => {
    if (!supabase) return
    if (signingOut) return
    setSigningOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      clearWithTripClientCaches()
      setUser(null)
      onLogout?.()
      router.push("/")
      router.refresh()
    } catch (err) {
      console.error("[AccountMenu] signOut failed:", err)
    } finally {
      setSigningOut(false)
    }
  }

  if (!ready) {
    if (rail) {
      return (
        <span
          className="flex size-10 items-center justify-center rounded-full bg-[#2A2418]/80 text-[11px] font-bold text-[#F5F0E6] opacity-70"
          aria-hidden
        >
          …
        </span>
      )
    }
    return (
      <Button
        size={compact ? "sm" : "default"}
        variant="outline"
        disabled
        className="rounded-full font-bold opacity-70"
      >
        <LogIn data-icon="inline-start" />
        {compact ? "…" : "확인 중…"}
      </Button>
    )
  }

  if (!user) {
    if (rail) {
      return (
        <button
          type="button"
          onClick={onLoginClick}
          aria-label="로그인"
          className="flex size-10 items-center justify-center rounded-full bg-[#2A2418] text-[12px] font-bold text-[#F5F0E6] shadow-md transition-transform hover:scale-[1.04] active:scale-[0.98]"
        >
          N
        </button>
      )
    }
    return (
      <Button
        size={compact ? "sm" : "default"}
        onClick={onLoginClick}
        className="rounded-full font-bold"
      >
        <LogIn data-icon="inline-start" />
        {compact ? "로그인" : "로그인 / 회원가입"}
      </Button>
    )
  }

  const profile = profileFromUser(user)
  const railInitial =
    profile.initials.slice(0, 1).toUpperCase() || "N"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          rail ? (
            <button
              type="button"
              className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-[#2A2418] text-[12px] font-bold text-[#F5F0E6] shadow-md outline-none transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.98]"
              aria-label="내 계정 메뉴"
            >
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                railInitial
              )}
            </button>
          ) : (
            <Button
              variant="ghost"
              className="h-auto gap-2 rounded-full py-1 pr-3 pl-1 font-semibold"
              aria-label="내 계정 메뉴"
            >
              <Avatar className="size-7">
                {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt="" /> : null}
                <AvatarFallback className="bg-primary text-[11px] font-bold text-primary-foreground">
                  {profile.initials}
                </AvatarFallback>
              </Avatar>
              {compact ? null : <span className="text-sm">{profile.name} 님</span>}
            </Button>
          )
        }
      />
      <DropdownMenuContent align="end" side={rail ? "right" : "bottom"} className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{profile.name} 님</span>
            {profile.email ? (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {profile.email}
              </span>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onMyPageClick}>
            <UserRound />
            마이페이지
          </DropdownMenuItem>
          <DropdownMenuItem disabled={signingOut} onClick={() => void handleLogout()}>
            <LogOut />
            {signingOut ? "로그아웃 중…" : "로그아웃"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
