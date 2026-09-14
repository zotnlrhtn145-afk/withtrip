"use client"
import { useRef, useState } from "react"
import { Share2 } from "lucide-react"
import { externalPlaceShare, type ExternalPlace } from "@/shared/external-place-share"
export function ExternalPlaceShare({ place }: { place: ExternalPlace }) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")
  const share = async () => {
    if (lock.current) return
    lock.current = true; setBusy(true); setStatus("")
    const data = externalPlaceShare(place)
    try {
      if (navigator.share) await navigator.share(data)
      else { await navigator.clipboard.writeText(data.text); setStatus("장소 정보를 복사했어요. 카카오톡 대화에 붙여넣어 주세요.") }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) setStatus("공유창을 열지 못했어요. 다시 시도해 주세요.")
    } finally { lock.current = false; setBusy(false) }
  }
  return <div className="my-4"><button type="button" onClick={() => void share()} disabled={busy} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left active:scale-[.98] motion-reduce:transform-none transition-transform disabled:opacity-60"><Share2 size={22} className="shrink-0" /><span><strong className="block text-base">카카오톡 등 다른 앱으로 공유</strong><span className="text-xs text-slate-500">공유창에서 카카오톡을 선택해 주세요</span></span></button><p role="status" className="mt-2 text-sm text-slate-600">{status}</p></div>
}
