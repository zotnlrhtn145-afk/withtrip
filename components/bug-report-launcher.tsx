"use client"

import { useEffect, useRef, useState } from "react"

/** 테스트 기간 임시 진입점. 부모 화면을 유지하고 닫을 때 다시 라우팅하지 않습니다. */
export function BugReportLauncher() {
  const dialog = useRef<HTMLDialogElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close() }, [open])
  const close = () => {
    let writing = false
    try { writing = frame.current?.contentWindow?.location.pathname === "/_buglist/new" } catch { /* 외부 로그인 화면 */ }
    if (writing && !window.confirm("아직 올리지 않은 내용은 사라질 수 있어요. 원래 화면으로 돌아갈까요?")) return
    setOpen(false)
  }
  return <>
    <button type="button" aria-label="버그 신고" onClick={() => setOpen(true)}
      style={{ position: "fixed", right: 12, top: "calc(env(safe-area-inset-top, 0px) + 100px)", zIndex: 70, width: 48, height: 48, borderRadius: 24, background: "#fbbf24", color: "#0f172a", display: "grid", placeItems: "center" }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 7V5l-2-2m10 4V5l2-2M8 8h8a2 2 0 0 1 2 2v6a6 6 0 0 1-12 0v-6a2 2 0 0 1 2-2ZM12 8v13M3 10l3 2m12 0 3-2M3 16h3m12 0h3M4 22l3-3m10 0 3 3" />
      </svg>
    </button>
    <dialog ref={dialog} aria-label="버그 신고 게시판" onCancel={e => { e.preventDefault(); close() }}
      onClick={e => { if (e.target === dialog.current) close() }}
      style={{ padding: 0, margin: "auto", width: "min(100%, 720px)", height: "90dvh", maxHeight: "100dvh", border: "1px solid #e2e8f0", borderRadius: 20, overflow: "hidden" }}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "white" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 16, borderBottom: "1px solid #f1f5f9" }}>
          <strong>버그 신고</strong>
          <button type="button" onClick={close} style={{ borderRadius: 24, padding: "12px 14px", background: "#fef3c7", color: "#0f172a", fontWeight: 600 }}>원래 화면으로</button>
        </header>
        {open && <iframe ref={frame} title="기존 버그 신고 게시판" src="/_buglist" style={{ width: "100%", flex: 1, minHeight: 0, border: 0 }} />}
      </div>
    </dialog>
  </>
}
