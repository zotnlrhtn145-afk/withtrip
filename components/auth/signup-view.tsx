"use client"

import { useState } from "react"
import { Check, Eye, EyeOff, Loader2, MailCheck } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { mapAuthError, signUpWithEmailPassword } from "@/lib/auth-api"
import { cn } from "@/lib/utils"

const inputClass =
  "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
const labelClass = "mb-1.5 block text-xs font-bold text-slate-700"

export function SignupView({
  onSignupComplete,
  onLogin,
}: {
  /** Called when signup yields an immediate session (email confirm off). */
  onSignupComplete: () => void
  onLogin: () => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMode, setSuccessMode] = useState<"session" | "confirm" | null>(null)

  const passwordMismatch = submitted && password !== passwordConfirm
  const agreementMissing = submitted && (!agreeTerms || !agreePrivacy)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    setSubmitted(true)
    setErrorMessage(null)

    if (password !== passwordConfirm) return
    if (!agreeTerms || !agreePrivacy) return
    if (password.length < 8) {
      setErrorMessage("비밀번호는 영문·숫자를 포함해 8자 이상이어야 해요.")
      return
    }

    setIsSubmitting(true)
    try {
      const data = await signUpWithEmailPassword(email, password, { name })
      if (data.session) {
        setSuccessMode("session")
        window.setTimeout(() => {
          onSignupComplete()
        }, 900)
      } else {
        setSuccessMode("confirm")
      }
    } catch (err) {
      console.error("[SignupView] signUp failed:", err)
      setErrorMessage(mapAuthError(err as Error))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (successMode) {
    const needsConfirm = successMode === "confirm"
    return (
      <AuthShell
        title={needsConfirm ? "이메일을 확인해 주세요" : "회원가입 완료"}
        description={
          needsConfirm
            ? "가입 확인 메일의 링크를 누르면 로그인이 활성화돼요."
            : "WITHTRIP에 오신 것을 환영해요."
        }
        footer={
          needsConfirm ? (
            <button
              type="button"
              onClick={onLogin}
              className="text-sm font-bold text-slate-900 underline-offset-2 hover:underline"
            >
              로그인으로 이동
            </button>
          ) : null
        }
      >
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-amber-50/70 px-4 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-amber-300 to-amber-200 text-slate-950 shadow-[0_8px_20px_rgba(255,193,7,0.35)]">
            <MailCheck className="size-6" />
          </span>
          <p className="text-sm font-bold text-slate-900">
            {needsConfirm ? "가입 확인 이메일을 보냈어요" : "회원가입이 완료되었습니다"}
          </p>
          <p className="text-sm leading-relaxed text-slate-400">
            {needsConfirm
              ? `${email.trim()} 으로 확인 메일을 보냈어요. 메일함(스팸함 포함)을 확인해 주세요.`
              : "잠시 후 여행 목록으로 이동해요."}
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="회원가입"
      description="이메일로 가입하고 친구들과 여행을 계획해 보세요."
      footer={
        <p className="text-sm text-slate-400">
          이미 계정이 있으신가요?{" "}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onLogin}
            className="font-bold text-slate-900 underline-offset-2 hover:underline disabled:opacity-60"
          >
            로그인
          </button>
        </p>
      }
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <div>
          <label htmlFor="signup-name" className={labelClass}>
            이름
          </label>
          <input
            id="signup-name"
            autoComplete="name"
            placeholder="오수환"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="signup-email" className={labelClass}>
            이메일
          </label>
          <input
            id="signup-email"
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
          <label htmlFor="signup-password" className={labelClass}>
            비밀번호
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="영문 · 숫자 조합 8자 이상"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                if (errorMessage) setErrorMessage(null)
              }}
              disabled={isSubmitting}
              required
              minLength={8}
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
          <p className="mt-1.5 text-[11px] text-slate-400">영문, 숫자를 포함해 8자 이상 입력해 주세요.</p>
        </div>

        <div>
          <label htmlFor="signup-password-confirm" className={labelClass}>
            비밀번호 확인
          </label>
          <div className="relative">
            <input
              id="signup-password-confirm"
              type={showPasswordConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="비밀번호를 다시 입력하세요"
              aria-invalid={passwordMismatch || undefined}
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              disabled={isSubmitting}
              required
              className={cn(
                inputClass,
                "pr-11",
                passwordMismatch && "border-red-300 focus:border-red-400 focus:ring-red-400/15"
              )}
            />
            <button
              type="button"
              aria-label={showPasswordConfirm ? "비밀번호 숨기기" : "비밀번호 보기"}
              disabled={isSubmitting}
              onClick={() => setShowPasswordConfirm((current) => !current)}
              className="absolute top-1/2 right-3 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              {showPasswordConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {passwordMismatch ? (
            <p className="mt-1.5 text-[11px] font-semibold text-red-500">비밀번호가 일치하지 않습니다.</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2.5 rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">약관 동의</p>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
            <button
              type="button"
              role="checkbox"
              aria-checked={agreeTerms}
              disabled={isSubmitting}
              onClick={() => setAgreeTerms((v) => !v)}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-md border transition-all",
                agreeTerms
                  ? "border-amber-400 bg-amber-400 text-slate-950"
                  : "border-slate-300 bg-white text-transparent"
              )}
            >
              <Check className="size-3.5 stroke-[3]" />
            </button>
            (필수) 서비스 이용약관에 동의합니다.
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
            <button
              type="button"
              role="checkbox"
              aria-checked={agreePrivacy}
              disabled={isSubmitting}
              onClick={() => setAgreePrivacy((v) => !v)}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-md border transition-all",
                agreePrivacy
                  ? "border-amber-400 bg-amber-400 text-slate-950"
                  : "border-slate-300 bg-white text-transparent"
              )}
            >
              <Check className="size-3.5 stroke-[3]" />
            </button>
            (필수) 개인정보 수집 및 이용에 동의합니다.
          </label>
          {agreementMissing ? (
            <p className="text-[11px] font-semibold text-red-500">필수 약관에 모두 동의해 주세요.</p>
          ) : null}
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-500"
          >
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-amber-400 text-sm font-bold text-slate-950 shadow-sm transition-all hover:bg-amber-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              가입 중…
            </>
          ) : (
            "회원가입 완료"
          )}
        </button>
      </form>
    </AuthShell>
  )
}
