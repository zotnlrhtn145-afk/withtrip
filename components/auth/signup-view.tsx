"use client"

import { useState } from "react"
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { mapAuthError, signUpWithEmailPassword } from "@/lib/auth-api"

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
            <Button variant="link" size="sm" onClick={onLogin} className="font-semibold">
              로그인으로 이동
            </Button>
          ) : null
        }
      >
        <div
          role="status"
          className="flex flex-col items-center gap-3 rounded-xl bg-secondary px-4 py-6 text-center animate-in fade-in zoom-in-95 duration-200 ease-out"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <MailCheck className="size-5" />
          </span>
          <p className="text-sm font-semibold">
            {needsConfirm ? "가입 확인 이메일을 확인해주세요" : "회원가입이 완료되었습니다"}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
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
        <p className="text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Button
            variant="link"
            size="sm"
            type="button"
            disabled={isSubmitting}
            onClick={onLogin}
            className="h-auto px-0 font-semibold"
          >
            로그인
          </Button>
        </p>
      }
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-5">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="signup-name">이름</FieldLabel>
            <Input
              id="signup-name"
              autoComplete="name"
              placeholder="오수환"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="signup-email">이메일</FieldLabel>
            <Input
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
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="signup-password">비밀번호</FieldLabel>
            <InputGroup>
              <InputGroupInput
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
            <FieldDescription>영문, 숫자를 포함해 8자 이상 입력해 주세요.</FieldDescription>
          </Field>

          <Field data-invalid={passwordMismatch || undefined}>
            <FieldLabel htmlFor="signup-password-confirm">비밀번호 확인</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="signup-password-confirm"
                type={showPasswordConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="비밀번호를 다시 입력하세요"
                aria-invalid={passwordMismatch || undefined}
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                disabled={isSubmitting}
                required
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  aria-label={showPasswordConfirm ? "비밀번호 숨기기" : "비밀번호 보기"}
                  disabled={isSubmitting}
                  onClick={() => setShowPasswordConfirm((current) => !current)}
                >
                  {showPasswordConfirm ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {passwordMismatch ? <FieldError>비밀번호가 일치하지 않습니다.</FieldError> : null}
          </Field>

          <FieldSet>
            <FieldLegend variant="label">약관 동의</FieldLegend>
            <Field orientation="horizontal">
              <Checkbox
                id="signup-terms"
                checked={agreeTerms}
                disabled={isSubmitting}
                onCheckedChange={(checked) => setAgreeTerms(checked === true)}
              />
              <FieldLabel htmlFor="signup-terms" className="font-normal">
                (필수) 서비스 이용약관에 동의합니다.
              </FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="signup-privacy"
                checked={agreePrivacy}
                disabled={isSubmitting}
                onCheckedChange={(checked) => setAgreePrivacy(checked === true)}
              />
              <FieldLabel htmlFor="signup-privacy" className="font-normal">
                (필수) 개인정보 수집 및 이용에 동의합니다.
              </FieldLabel>
            </Field>
            {agreementMissing ? (
              <FieldError>필수 약관에 모두 동의해 주세요.</FieldError>
            ) : null}
          </FieldSet>
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
              가입 중…
            </>
          ) : (
            "회원가입 완료"
          )}
        </Button>
      </form>
    </AuthShell>
  )
}
