"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

import { SocialLoginButtons } from "@/components/auth/social-login-buttons"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { demoUser } from "@/lib/auth-data"

export function LoginView({
  onLogin,
  onSignup,
  onForgotPassword,
}: {
  onLogin: () => void
  onSignup: () => void
  onForgotPassword: () => void
}) {
  const [email, setEmail] = useState(demoUser.email)
  const [password, setPassword] = useState("withtrip1234")
  const [showPassword, setShowPassword] = useState(false)

  return (
    <AuthShell
      title="로그인"
      description="여행 일정과 멤버를 한 곳에서 관리해 보세요."
      footer={
        <p className="text-sm text-muted-foreground">
          아직 계정이 없으신가요?{" "}
          <Button variant="link" size="sm" onClick={onSignup} className="h-auto px-0 font-semibold">
            회원가입
          </Button>
        </p>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onLogin()
        }}
        className="flex flex-col gap-5"
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="login-email">이메일</FieldLabel>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@withtrip.kr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </FieldGroup>

        <div className="flex flex-col gap-3">
          <Button type="submit" size="lg" className="w-full rounded-xl font-bold">
            로그인
          </Button>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={onForgotPassword}
            className="self-center font-medium text-muted-foreground"
          >
            비밀번호 찾기
          </Button>
        </div>
      </form>

      <SocialLoginButtons onSocialLogin={onLogin} />
    </AuthShell>
  )
}
