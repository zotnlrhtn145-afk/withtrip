"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"

import { loginAction } from "../actions"

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button className="go" type="submit" disabled={pending}>
      {pending ? "확인 중…" : "들어가기"}
    </button>
  )
}

export default function AdminLogin() {
  const [state, action] = useActionState(loginAction, {})

  return (
    <div className="wt-login">
      <form action={action}>
        <div className="head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/admin-logo.png" alt="" width={30} height={30} />
          <div>
            <b style={{ fontSize: 15 }}>위드트립 관리자</b>
            <div style={{ fontSize: 11.5, color: "var(--tx-2)" }}>관리자만 들어올 수 있습니다</div>
          </div>
        </div>

        {state?.error && <div className="err">{state.error}</div>}

        <div>
          <label htmlFor="user">아이디</label>
          <input id="user" name="user" type="text" autoComplete="username" autoFocus required />
        </div>
        <div>
          <label htmlFor="password">비밀번호</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>

        <Submit />
      </form>
    </div>
  )
}
