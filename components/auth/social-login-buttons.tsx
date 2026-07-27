"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FieldSeparator } from "@/components/ui/field"
import {
  mapAuthError,
  signInWithOAuthProvider,
  type AuthProviderId,
} from "@/lib/auth-api"

const providers: { id: AuthProviderId; label: string; icon: string }[] = [
  { id: "kakao", label: "카카오로 계속하기", icon: "/icons/kakao.svg" },
  { id: "google", label: "구글로 계속하기", icon: "/icons/google.svg" },
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
      <FieldSeparator>또는</FieldSeparator>

      <div className="flex flex-col gap-2">
        {providers.map((provider) => {
          const loading = pending === provider.id
          return (
            <Button
              key={provider.id}
              type="button"
              variant="outline"
              size="lg"
              disabled={disabled || pending !== null}
              onClick={() => void handleOAuth(provider.id)}
              className="w-full justify-center rounded-xl font-semibold"
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
            </Button>
          )
        })}
      </div>

      {errorMessage ? (
        <p role="alert" className="text-center text-xs text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
