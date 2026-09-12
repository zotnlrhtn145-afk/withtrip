"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/** 기존 /join 라우트가 로그인·유효성·참여를 처리합니다. */
export function JoinTripDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [value, setValue] = useState("")
  const [error, setError] = useState("")
  const submit = () => {
    try {
      const raw = value.match(/https?:\/\/[^\s]+/)?.[0]
      if (!raw) throw new Error("invalid")
      const input = new URL(raw)
      const code = input.searchParams.get("code")?.trim()
      if (!["www.withtrip.co.kr", "withtrip.co.kr", window.location.hostname].includes(input.hostname) || input.pathname !== "/join" || !code) throw new Error("invalid")
      window.location.assign(`/join?code=${encodeURIComponent(code)}`)
    } catch { setError("친구에게 받은 위드트립 초대 링크를 붙여넣어 주세요.") }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="rounded-[28px] bg-white p-6">
    <DialogHeader><DialogTitle className="text-[22px] font-semibold">초대 링크로 참여</DialogTitle><DialogDescription className="text-sm leading-6">친구에게 받은 초대 링크를 붙여넣어 주세요.</DialogDescription></DialogHeader>
    <form onSubmit={event => { event.preventDefault(); submit() }}>
      <label className="mt-3 block text-[13px] text-slate-500" htmlFor="join-trip-link">여행 초대 링크</label>
      <input id="join-trip-link" type="text" autoCapitalize="none" autoComplete="off" value={value} onChange={event => { setValue(event.target.value); setError("") }} placeholder="https://www.withtrip.co.kr/join?code=…" className="mt-2 min-h-12 w-full border-0 border-b border-slate-200 bg-white text-[17px] text-slate-900 outline-none focus:border-amber-400" />
      {error ? <p role="alert" className="mt-3 text-[13px] leading-5 text-red-600">{error}</p> : null}
      <button type="submit" disabled={!value.trim()} className="mt-6 min-h-14 w-full rounded-full bg-[#fbbf24] text-[17px] font-semibold text-[#182126] disabled:opacity-40">초대 링크 열기</button>
    </form>
  </DialogContent></Dialog>
}
