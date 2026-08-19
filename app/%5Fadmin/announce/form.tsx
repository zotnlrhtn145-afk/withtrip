"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"

import { sendAnnouncementAction } from "../actions"

function Submit({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      className="wt-btn pr"
      type="submit"
      disabled={pending || !ready}
      style={{ padding: "8px 16px", fontSize: 13, fontWeight: 650, opacity: ready ? 1 : 0.45 }}
    >
      {pending ? "보내는 중…" : "모두에게 보내기"}
    </button>
  )
}

export function AnnounceForm() {
  const [state, action] = useActionState(sendAnnouncementAction, {})
  const [text, setText] = useState("")
  const [confirm, setConfirm] = useState("")

  /*
    ⚠️ 보낸 건 되돌릴 수 없다. 그래서 '보내기'를 손으로 적기 전에는 단추를
       누를 수 없게 한다 — 오타나 미완성 문장이 그대로 나가는 걸 막는다.
  */
  const ready = text.trim().length > 0 && confirm === "보내기"

  return (
    <div className="wt-card">
      <h2>내용</h2>
      <div className="cap">
        잠금화면에 <b>&lsquo;위드트립 공지&rsquo;</b>라는 제목으로 뜹니다. 한 번 나가면 되돌릴 수 없습니다.
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
      {state?.sent ? (
        <div
          style={{
            fontSize: 12,
            color: "var(--good)",
            background: "color-mix(in srgb, var(--good) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--good) 30%, transparent)",
            borderRadius: 7,
            padding: "7px 9px",
            marginBottom: 10,
          }}
        >
          {state.sent}명에게 보냈습니다.
        </div>
      ) : null}

      <form action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <textarea
            name="message"
            rows={4}
            maxLength={300}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="예) 이모티콘 2종이 새로 들어왔어요. 대화방에서 써 보세요!"
            aria-label="공지 내용"
          />
          <div style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 4, textAlign: "right" }}>
            {text.length}/300
            {text.length > 110 && <span style={{ color: "var(--warn)" }}> · 잠금화면에서는 잘려 보입니다</span>}
          </div>
        </div>

        {/* 실제로 어떻게 보이는지 — 보내기 전에 눈으로 확인하는 게 가장 확실하다 */}
        {text.trim() && (
          <div>
            <div style={{ fontSize: 11.5, color: "var(--tx-2)", marginBottom: 5 }}>이렇게 보입니다</div>
            <div
              style={{
                background: "var(--bg)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "10px 12px",
                display: "flex",
                gap: 9,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/admin-logo.png" alt="" width={28} height={28} style={{ borderRadius: 7, flex: "none" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>위드트립 공지</div>
                <div style={{ fontSize: 12.5, color: "var(--tx-2)", marginTop: 1 }}>
                  {text.length > 110 ? `${text.slice(0, 110)}…` : text}
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="confirm" style={{ fontSize: 11.5, color: "var(--tx-2)", display: "block", marginBottom: 4 }}>
            보내려면 아래에 <b>보내기</b> 라고 적어 주세요
          </label>
          <input
            id="confirm"
            name="confirm"
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="보내기"
            style={{ maxWidth: 140 }}
          />
        </div>

        <div>
          <Submit ready={ready} />
        </div>
      </form>
    </div>
  )
}
