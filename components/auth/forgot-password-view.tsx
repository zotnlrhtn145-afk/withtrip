"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Loader2, MailCheck } from "lucide-react"

import styles from "./login-quiet.module.css"
import { AuthShell } from "@/components/auth/auth-shell"
import { mapAuthError, resetPasswordForEmail } from "@/lib/auth-api"

const inputClass = styles.input
const labelClass = styles.label

export function ForgotPasswordView({ onBackToLogin, embedded = false, onSubmittingChange }: { onBackToLogin: () => void; embedded?: boolean; onSubmittingChange?: (pending: boolean) => void }) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => { onSubmittingChange?.(isSubmitting); return () => onSubmittingChange?.(false) }, [isSubmitting, onSubmittingChange])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    const trimmed = email.trim()
    if (!trimmed) {
      setErrorMessage("이메일을 입력해 주세요.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await resetPasswordForEmail(trimmed)
      setSent(true)
    } catch (err) {
      console.error("[ForgotPasswordView] reset failed:", err)
      setErrorMessage(mapAuthError(err as Error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      embedded={embedded}
      title="비밀번호 찾기"
      description="가입하신 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다."
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 bg-white py-6 text-center">
          <span className={styles.successIcon}>
            <MailCheck className="size-6" />
          </span>
          <p className="text-sm font-bold text-slate-900">재설정 링크를 보냈어요</p>
          <p className="text-sm leading-relaxed text-slate-400">
            {email} 으로 메일을 발송했습니다. 10분 내에 링크를 눌러 비밀번호를 변경해 주세요.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            다른 이메일로 다시 받기
          </button>
        </div>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
          <div>
            <label htmlFor="reset-email" className={labelClass}>
              이메일
            </label>
            <input
              id="reset-email"
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

          {errorMessage ? (
            <div
              role="alert"
              className={styles.error}
            >
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className={styles.primary}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                전송 중…
              </>
            ) : (
              "재설정 링크 받기"
            )}
          </button>
        </form>
      )}

      <button
        type="button"
        disabled={isSubmitting}
        onClick={onBackToLogin}
        className="flex items-center justify-center gap-1.5 self-center text-sm font-semibold text-slate-400 transition-colors hover:text-slate-700 disabled:opacity-60"
      >
        <ArrowLeft className="size-4" />
        로그인으로 돌아가기
      </button>
    </AuthShell>
  )
}
