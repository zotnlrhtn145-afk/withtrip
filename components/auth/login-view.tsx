"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Dialog } from "@base-ui/react/dialog"
import { Eye, EyeOff, Loader2, Mail, X } from "lucide-react"

import { SocialLoginButtons } from "@/components/auth/social-login-buttons"
import { SignupView } from "@/components/auth/signup-view"
import { ForgotPasswordView } from "@/components/auth/forgot-password-view"
import { LoginMotionArt } from "@/components/auth/login-motion-art"
import { mapAuthError, signInWithEmailPassword } from "@/lib/auth-api"
import styles from "./login-quiet.module.css"

export function LoginView({
  view = "login",
  onLogin,
  onSignup,
  onForgotPassword,
  onBackToLogin,
}: {
  view?: "login" | "signup" | "forgot-password"
  onLogin: () => void
  onSignup: () => void
  onForgotPassword: () => void
  onBackToLogin: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailTrigger = useRef<HTMLButtonElement>(null)
  const signupTrigger = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef<HTMLButtonElement | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [childSubmitting, setChildSubmitting] = useState(false)
  const [socialPending, setSocialPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const open = emailOpen || view !== "login"
  const busy = isSubmitting || childSubmitting
  const backToLogin = () => { setEmailOpen(true); onBackToLogin() }
  const title = view === "signup" ? "회원가입" : view === "forgot-password" ? "비밀번호 찾기" : "이메일 로그인"

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


  return <div className={styles.page}>
    <main className={`${styles.entry} ${open ? styles.entryOpen : ""}`}>
      <div className={styles.wordmark}><Image className={styles.smallMark} src="/withtrip-logo.png" width={27} height={27} alt="" priority />WITHTRIP</div>
      <section className={styles.hero} aria-label="위드트립 브랜드 움직임">
        <LoginMotionArt paused={open || socialPending} />
        <h1>함께 떠나요.</h1>
      </section>
      <button ref={emailTrigger} type="button" className={styles.primary} disabled={socialPending} onClick={() => { restoreFocus.current = emailTrigger.current; setEmailOpen(true) }}><Mail aria-hidden="true" />이메일로 시작하기</button>
      <SocialLoginButtons quiet disabled={busy || open} onPendingChange={setSocialPending} />
      <div className={styles.signupLine}><span>처음 오셨나요?</span><button ref={signupTrigger} type="button" className={styles.textAction} disabled={socialPending} onClick={() => { restoreFocus.current = signupTrigger.current; onSignup() }}>회원가입</button></div>
    </main>
    <Dialog.Root open={open} onOpenChange={(next) => {
      if (busy) return
      setEmailOpen(next)
      if (!next && view !== "login") onBackToLogin()
    }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.sheet} initialFocus={closeButton} finalFocus={() => restoreFocus.current || emailTrigger.current}>
          <div className={styles.handle} aria-hidden="true" />
          <header className={styles.sheetHead}>
            <Dialog.Title className={styles.sheetTitle}>{title}</Dialog.Title>
            <Dialog.Close ref={closeButton} className={styles.iconButton} disabled={busy} aria-label="닫기"><X aria-hidden="true" /></Dialog.Close>
          </header>
          <div className={styles.sheetBody} key={view}>
            {view === "signup" ? <SignupView embedded onSubmittingChange={setChildSubmitting} onSignupComplete={onLogin} onLogin={backToLogin} /> : view === "forgot-password" ? <ForgotPasswordView embedded onSubmittingChange={setChildSubmitting} onBackToLogin={backToLogin} /> : <div className={styles.pane}>
              <h2 className={styles.paneTitle}>다시 만나 반가워요.</h2>
              <form onSubmit={event => void handleSubmit(event)} className={styles.form} aria-busy={isSubmitting}>
                <div>
                  <label htmlFor="login-email" className={styles.label}>이메일</label>
                  <input id="login-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="이메일 주소" value={email} onChange={event => { setEmail(event.target.value); if (errorMessage) setErrorMessage(null) }} disabled={isSubmitting} required className={styles.input} />
                </div>
                <div>
                  <label htmlFor="login-password" className={styles.label}>비밀번호</label>
                  <div className={styles.passwordWrap}>
                    <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="비밀번호" value={password} onChange={event => { setPassword(event.target.value); if (errorMessage) setErrorMessage(null) }} disabled={isSubmitting} required className={styles.input} />
                    <button type="button" className={styles.iconButton} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"} aria-pressed={showPassword} disabled={isSubmitting} onClick={() => setShowPassword(current => !current)}>{showPassword ? <EyeOff /> : <Eye />}</button>
                  </div>
                </div>
                {errorMessage ? <p role="alert" className={styles.error}>{errorMessage}</p> : null}
                <button type="submit" disabled={isSubmitting} className={styles.primary}>{isSubmitting ? <><Loader2 className="animate-spin" />로그인 중…</> : "로그인"}</button>
              </form>
              <div className={styles.alternatives}><button type="button" disabled={isSubmitting} onClick={onForgotPassword} className={styles.textAction}>비밀번호 찾기</button></div>
              <div className={styles.footer}>아직 계정이 없으신가요?{" "}<button type="button" disabled={isSubmitting} onClick={onSignup} className={styles.textAction}>회원가입</button></div>
            </div>}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </div>
}
