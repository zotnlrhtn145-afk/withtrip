"use client"

import { useState } from "react"

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

export function SignupView({
  onSignupComplete,
  onLogin,
}: {
  onSignupComplete: () => void
  onLogin: () => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const passwordMismatch = submitted && password !== passwordConfirm
  const agreementMissing = submitted && (!agreeTerms || !agreePrivacy)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (password !== passwordConfirm || !agreeTerms || !agreePrivacy) return
    onSignupComplete()
  }

  return (
    <AuthShell
      title="회원가입"
      description="이메일로 가입하고 친구들과 여행을 계획해 보세요."
      footer={
        <p className="text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Button variant="link" size="sm" onClick={onLogin} className="h-auto px-0 font-semibold">
            로그인
          </Button>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="signup-name">이름</FieldLabel>
            <Input
              id="signup-name"
              autoComplete="name"
              placeholder="오수환"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="signup-email">이메일</FieldLabel>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder="you@withtrip.kr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="signup-password">비밀번호</FieldLabel>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              placeholder="영문 · 숫자 조합 8자 이상"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <FieldDescription>영문, 숫자를 포함해 8자 이상 입력해 주세요.</FieldDescription>
          </Field>

          <Field data-invalid={passwordMismatch || undefined}>
            <FieldLabel htmlFor="signup-password-confirm">비밀번호 확인</FieldLabel>
            <Input
              id="signup-password-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="비밀번호를 다시 입력하세요"
              aria-invalid={passwordMismatch || undefined}
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              required
            />
            {passwordMismatch ? <FieldError>비밀번호가 일치하지 않습니다.</FieldError> : null}
          </Field>

          <FieldSet>
            <FieldLegend variant="label">약관 동의</FieldLegend>
            <Field orientation="horizontal">
              <Checkbox
                id="signup-terms"
                checked={agreeTerms}
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

        <Button type="submit" size="lg" className="w-full rounded-xl font-bold">
          회원가입 완료
        </Button>
      </form>
    </AuthShell>
  )
}
