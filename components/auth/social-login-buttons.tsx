"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import {
  mapAuthError,
  signInWithOAuthProvider,
  type AuthProviderId,
} from "@/lib/auth-api"
import { cn } from "@/lib/utils"

const providers: {
  id: AuthProviderId
  label: string
  icon: string
  className: string
}[] = [
  {
    id: "kakao",
    label: "카카오로 계속하기",
    icon: "/icons/kakao.svg",
    className: "border-transparent bg-[#FEE500] text-[#191600] hover:bg-[#FADA00]",
  },
  {
    id: "google",
    label: "구글로 계속하기",
    icon: "/icons/google.svg",
    className: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  },
]

export function SocialLoginButtons({ disabled = false }: { disabled?: boolean }) {
  const [pending, setPending] = useState<AuthProviderId | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleOAuth = async (provider: AuthProviderId) => {
    if (disabled || pending) return
    setPending(provider)
    setErrorMessage(null)
    try {
      const { url } = await signInWithOAuthProvider(provider)
      if (url) {
        window.location.assign(url)
        return
      }
      setErrorMessage("소셜 로그인 주소를 받지 못했어요.")
      setPending(null)
    } catch (err) {
      console.error("[SocialLoginButtons] OAuth failed:", err)
      setErrorMessage(mapAuthError(err as Error))
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-100" />
        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          또는
        </span>
        <span className="h-px flex-1 bg-slate-100" />
      </div>

      <div className="flex flex-col gap-2.5">
        {providers.map((provider) => {
          const loading = pending === provider.id
          return (
            <button
              key={provider.id}
              type="button"
              disabled={disabled || pending !== null}
              onClick={() => void handleOAuth(provider.id)}
              className={cn(
                "flex h-12 w-full items-center justify-center gap-2.5 rounded-full border text-sm font-bold shadow-sm transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
                provider.className
              )}
            >
              {loading ? (
                <Loader2 className="size-4.5 shrink-0 animate-spin" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={provider.icon || "/placeholder.svg"}
                  alt=""
                  width={18}
                  height={18}
                  aria-hidden="true"
                  className="size-4.5 shrink-0"
                />
              )}
              {provider.label}
            </button>
          )
        })}
      </div>

      {errorMessage ? (
        <p role="alert" className="text-center text-xs font-medium text-red-500">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
