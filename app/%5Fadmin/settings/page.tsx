"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"

import { changePasswordAction } from "../actions"

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button className="wt-btn pr" type="submit" disabled={pending} style={{ padding: "7px 14px", fontSize: 12.5 }}>
      {pending ? "바꾸는 중…" : "비밀번호 바꾸기"}
    </button>
  )
}

export default function SettingsPage() {
  const [state, action] = useActionState(changePasswordAction, {})

  return (
    <>
      <div className="wt-top">
        <div>
          <h1>설정</h1>
          <div className="wt-sub">관리자 계정</div>
        </div>
      </div>

      <div className="wt-split">
        <div className="wt-card">
          <h2>비밀번호 바꾸기</h2>
          <div className="cap">
            바꾸면 <b>지금 열려 있는 로그인이 모두 끊깁니다</b> — 나도 포함입니다. 다시 로그인해 주세요.
          </div>

          {state?.error && (
            <div
              style={{
                fontSize: 12,
                color: "var(--crit)",
                background: "color-mix(in srgb, var(--crit) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--crit) 30%, transparent)",
                borderRadius: 7,
                padding: "7px 9px",
                marginBottom: 10,
              }}
            >
              {state.error}
            </div>
          )}

          <form action={action} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 300 }}>
            <div>
              <label htmlFor="current" style={{ fontSize: 11.5, color: "var(--tx-2)", display: "block", marginBottom: 4 }}>
                지금 비밀번호
              </label>
              <input id="current" name="current" type="password" autoComplete="current-password" required />
            </div>
            <div>
              <label htmlFor="next" style={{ fontSize: 11.5, color: "var(--tx-2)", display: "block", marginBottom: 4 }}>
                새 비밀번호 (10자 이상)
              </label>
              <input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required />
            </div>
            <div>
              <label htmlFor="again" style={{ fontSize: 11.5, color: "var(--tx-2)", display: "block", marginBottom: 4 }}>
                새 비밀번호 다시
              </label>
              <input id="again" name="again" type="password" autoComplete="new-password" minLength={10} required />
            </div>
            <div>
              <Submit />
            </div>
          </form>
        </div>

        <div className="wt-card">
          <h2>이 화면은 어떻게 지켜지나</h2>
          <div className="cap">궁금하실 때 보시라고 적어 둡니다</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.8, color: "var(--tx-2)" }}>
            <li>
              비밀번호는 <b>원문으로 저장되지 않습니다.</b> 21만 번 돌린 해시만 남아 거꾸로 풀 수 없습니다.
            </li>
            <li>
              <code>/_admin</code> 아래는 <b>입구 한 곳</b>에서 막습니다. 화면을 새로 만들어도 이 검사를 거칩니다.
            </li>
            <li>값을 바꾸는 동작(가리기·지우기·정지)은 저마다 한 번 더 확인합니다.</li>
            <li>세션은 8시간이면 저절로 끊깁니다. 쿠키는 서명돼 있어 손으로 고칠 수 없습니다.</li>
            <li>비밀번호를 다섯 번 틀리면 기다리는 시간이 점점 길어집니다.</li>
            <li>검색엔진이 이 주소를 담아 가지 않도록 막아 두었습니다.</li>
          </ul>
        </div>
      </div>
    </>
  )
}
