"use client"

import { useState } from "react"

/**
 * 내가 쓴 신고를 고치거나 지우는 자리.
 *
 * ⚠️ 지우기는 되돌릴 수 없다 — 한 번 더 묻는다.
 */
export function OwnerTools({
  id,
  body,
  editAction,
  deleteAction,
}: {
  id: string
  body: string
  editAction: (form: FormData) => Promise<void>
  deleteAction: (form: FormData) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <form action={editAction} style={{ marginTop: 18 }}>
        <span className="bl-lbl">내 글 고치기</span>
        <textarea name="body" defaultValue={body} required maxLength={4000} rows={6} />
        <input type="hidden" name="id" value={id} />
        <button className="bl-btn" type="submit">
          저장
        </button>
        <button type="button" className="bl-btn line" onClick={() => setEditing(false)}>
          취소
        </button>
      </form>
    )
  }

  return (
    <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
      <button
        type="button"
        className="bl-btn line"
        style={{ marginTop: 0, flex: 1 }}
        onClick={() => setEditing(true)}
      >
        내 글 고치기
      </button>
      <form
        action={deleteAction}
        style={{ flex: 1 }}
        onSubmit={(e) => {
          if (!window.confirm("이 신고를 지울까요?\n되돌릴 수 없습니다.")) e.preventDefault()
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button className="bl-btn line" type="submit" style={{ marginTop: 0, width: "100%" }}>
          지우기
        </button>
      </form>
    </div>
  )
}
