"use client"

import { useState } from "react"
import { ArrowLeft, MailCheck } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function ForgotPasswordView({ onBackToLogin }: { onBackToLogin: () => void }) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)

  return (
    <AuthShell
      title="비밀번호 찾기"
      description="가입하신 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다."
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-secondary px-4 py-6 text-center">
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
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setSent(true)
          }}
          className="flex flex-col gap-5"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="reset-email">이메일</FieldLabel>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                placeholder="you@withtrip.kr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
          </FieldGroup>

          <Button type="submit" size="lg" className="w-full rounded-xl font-bold">
            재설정 링크 받기
          </Button>
        </form>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBackToLogin}
        className="self-center font-semibold text-muted-foreground"
      >
        <ArrowLeft data-icon="inline-start" />
        로그인으로 돌아가기
      </Button>
    </AuthShell>
  )
}
