"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"

import { LoginLoadingScreen } from "@/components/login-loading-screen"

type LoginNavigationContextValue = {
  isNavigatingToLogin: boolean
  navigateToLogin: () => void
}

const LoginNavigationContext = createContext<LoginNavigationContextValue | null>(null)

export const LOGIN_NAVIGATE_EVENT = "withtrip:navigate-login"

export function LoginNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isNavigatingToLogin, setIsNavigatingToLogin] = useState(false)

  const navigateToLogin = useCallback(() => {
    setIsNavigatingToLogin(true)
    router.push("/login")
  }, [router])

  useEffect(() => {
    if (pathname === "/login" || pathname.startsWith("/login")) {
      // Route loading.tsx / page take over — drop the click-time overlay.
      setIsNavigatingToLogin(false)
    }
  }, [pathname])

  useEffect(() => {
    const onNavigate = () => navigateToLogin()
    window.addEventListener(LOGIN_NAVIGATE_EVENT, onNavigate)
    return () => window.removeEventListener(LOGIN_NAVIGATE_EVENT, onNavigate)
  }, [navigateToLogin])

  const value = useMemo(
    () => ({ isNavigatingToLogin, navigateToLogin }),
    [isNavigatingToLogin, navigateToLogin]
  )

  return (
    <LoginNavigationContext.Provider value={value}>
      {children}
      {isNavigatingToLogin ? <LoginLoadingScreen /> : null}
    </LoginNavigationContext.Provider>
  )
}

export function useNavigateToLogin() {
  const ctx = useContext(LoginNavigationContext)
  if (!ctx) {
    throw new Error("useNavigateToLogin must be used within LoginNavigationProvider")
  }
  return ctx
}

/** Fire-and-forget helper for modules that cannot use the hook. */
export function requestNavigateToLogin() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(LOGIN_NAVIGATE_EVENT))
}
