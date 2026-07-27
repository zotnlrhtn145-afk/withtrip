"use client"

import { useState } from "react"
import { ArrowLeft, Loader2, MailCheck } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { mapAuthError, resetPasswordForEmail } from "@/lib/auth-api"

export function ForgotPasswordView({ onBackToLogin }: { onBackToLogin: () => void }) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
      title="비밀번호 찾기"
      description="가입하신 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다."
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-secondary px-4 py-6 text-center animate-in fade-in zoom-in-95 duration-200 ease-out">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <MailCheck className="size-5" />
          </span>
          <p className="text-sm font-semibold">재설정 링크를 보냈어요</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {email} 으로 메일을 발송했습니다. 10분 내에 링크를 눌러 비밀번호를 변경해 주세요.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSent(false)}
            className="rounded-full font-semibold"
          >
            다른 이메일로 다시 받기
          </Button>
        </div>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reset-email">이메일</FieldLabel>
              <Input
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
              />
            </Field>
          </FieldGroup>

          {errorMessage ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <FieldError>{errorMessage}</FieldError>
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="w-full rounded-xl font-bold"
          >
            {isSubmitting ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin" />
                전송 중…
              </>
            ) : (
              "재설정 링크 받기"
            )}
          </Button>
        </form>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isSubmitting}
        onClick={onBackToLogin}
        className="self-center font-semibold text-muted-foreground"
      >
        <ArrowLeft data-icon="inline-start" />
        로그인으로 돌아가기
      </Button>
    </AuthShell>
  )
}
