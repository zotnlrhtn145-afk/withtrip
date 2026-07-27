"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { SocialLoginButtons } from "@/components/auth/social-login-buttons"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { mapAuthError, signInWithEmailPassword } from "@/lib/auth-api"

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
      router.push("/")
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
        <p className="text-sm text-muted-foreground">
          아직 계정이 없으신가요?{" "}
          <Button
            variant="link"
            size="sm"
            type="button"
            disabled={isSubmitting}
            onClick={onSignup}
            className="h-auto px-0 font-semibold"
          >
            회원가입
          </Button>
        </p>
      }
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-5">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="login-email">이메일</FieldLabel>
            <Input
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
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="login-password">비밀번호</FieldLabel>
            <InputGroup>
              <InputGroupInput
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
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  disabled={isSubmitting}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
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

        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="w-full rounded-xl font-bold"
          >
            {isSubmitting ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin" />
                로그인 중…
              </>
            ) : (
              "로그인"
            )}
          </Button>
          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={isSubmitting}
            onClick={onForgotPassword}
            className="self-center font-medium text-muted-foreground"
          >
            비밀번호 찾기
          </Button>
        </div>
      </form>

      <SocialLoginButtons disabled={isSubmitting} />
    </AuthShell>
  )
}
