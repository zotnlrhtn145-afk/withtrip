"use client"
import { useRef, useState } from "react"
import { Link, Share2, Loader2 } from "lucide-react"
import { type SharePlace, validShareToken } from "@/shared/place-share"
export function ExternalPlaceShare({ place, sourceId }: { place: SharePlace; sourceId?: string | null }) {
 const lock = useRef(false)
 const [busy, setBusy] = useState(false)
 const [status, setStatus] = useState("")
 async function run(copy: boolean) {
  if (lock.current) return
  lock.current = true; setBusy(true); setStatus("")
  try {
   const res = await fetch("/api/place-shares", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ place, sourceId }) })
   if (!res.ok) throw new Error("공유 링크를 준비하지 못했어요. 로그인 후 다시 시도해 주세요.")
   const data = await res.json()
   if (!validShareToken(data.token)) throw new Error("공유 주소를 확인하지 못했어요.")
   if (copy) { await navigator.clipboard.writeText(data.url); setStatus("장소 링크를 복사했어요.") }
   else window.location.assign(`/share/place/${data.token}`)
  } catch (e) { setStatus(e instanceof Error ? e.message : "다시 시도해 주세요.") }
  finally { lock.current = false; setBusy(false) }
 }
 return <div className="my-5"><div className="flex justify-center gap-8">{[false,true].map(copy => <button key={String(copy)} type="button" disabled={busy} onClick={() => void run(copy)} className="flex w-28 flex-col items-center gap-2 text-sm font-medium active:opacity-60"><span className={`flex size-[54px] items-center justify-center rounded-[18px] ${copy ? "border border-slate-200" : "bg-[#ffc217]"}`}>{busy ? <Loader2 className="size-6 animate-spin motion-reduce:animate-none"/> : copy ? <Link size={23}/> : <Share2 size={23}/>}</span>{copy ? "링크 복사" : "카카오톡 공유"}</button>)}</div><p role="status" className="mt-4 text-xs leading-5 text-slate-500">{status || "사진과 장소 정보를 확인한 뒤 공유해 주세요."}</p></div>
}
