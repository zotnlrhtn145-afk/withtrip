"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { SocialLoginButtons } from "@/components/auth/social-login-buttons"
import { AuthShell } from "@/components/auth/auth-shell"
import { mapAuthError, signInWithEmailPassword } from "@/lib/auth-api"

const inputClass =
  "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
const labelClass = "mb-1.5 block text-xs font-bold text-slate-700"

export function LoginView({
  onLogin,
  onSignup,
  onForgotPassword,
}: {
  onLogin: () => void
  onSignup: () => void
  onForgotPassword: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setErrorMessage("이메일과 비밀번호를 입력해 주세요.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await signInWithEmailPassword(trimmedEmail, password)
      onLogin()
      /*
        ⚠️ 늘 홈으로 보내면 안 된다. 버그 신고처럼 **다른 곳에서 넘어온 사람**이
           로그인하고 나서 홈에 떨어지면, 원래 하려던 일을 처음부터 다시 찾아야 한다.
           `?next=` 로 온 곳만 허용한다 — 바깥 주소를 그대로 받으면 남의 사이트로
           튕겨 보내는 발판이 된다.
      */
      const next = searchParams?.get("next")
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/")
    } catch (err) {
      console.error("[LoginView] signIn failed:", err)
      setErrorMessage(mapAuthError(err as Error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="로그인"
      description="여행 일정과 멤버를 한 곳에서 관리해 보세요."
      footer={
        <p className="text-sm text-slate-400">
          아직 계정이 없으신가요?{" "}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onSignup}
            className="font-bold text-slate-900 underline-offset-2 hover:underline disabled:opacity-60"
          >
            회원가입
          </button>
        </p>
      }
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <div>
          <label htmlFor="login-email" className={labelClass}>
            이메일
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@withtrip.app"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (errorMessage) setErrorMessage(null)
            }}
            disabled={isSubmitting}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="login-password" className={labelClass}>
            비밀번호
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                if (errorMessage) setErrorMessage(null)
              }}
              disabled={isSubmitting}
              required
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              disabled={isSubmitting}
              onClick={() => setShowPassword((current) => !current)}
              className="absolute top-1/2 right-3 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-500"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-amber-400 text-sm font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                로그인 중…
              </>
            ) : (
              "로그인"
            )}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onForgotPassword}
            className="self-center text-sm font-semibold text-slate-400 transition-colors hover:text-slate-700 disabled:opacity-60"
          >
            비밀번호 찾기
          </button>
        </div>
      </form>

      <SocialLoginButtons disabled={isSubmitting} />
    </AuthShell>
  )
}
