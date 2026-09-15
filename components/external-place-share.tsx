"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Link, Loader2, MessageCircle } from "lucide-react"
import { type PlaceShare, type SharePlace, validShareToken } from "@/shared/place-share"

type PreparedShare = PlaceShare & { key: string; url: string }

export function ExternalPlaceShare({ place, sourceId, onNavigate }: { place: SharePlace; sourceId?: string | null; onNavigate?: () => void }) {
  const lock = useRef(false)
  const cache = useRef<PreparedShare | null>(null)
  const pending = useRef<{ key: string; promise: Promise<PreparedShare> } | null>(null)
  const [busy, setBusy] = useState<"share" | "copy" | null>(null)
  const [status, setStatus] = useState("")
  const reduceMotion = useReducedMotion()
  const payloadKey = JSON.stringify([sourceId, place])

  const prepareShare = useCallback(async () => {
    const payload = { place, sourceId }
    const key = JSON.stringify(payload)
    if (cache.current?.key === key) return cache.current
    if (pending.current?.key === key) return pending.current.promise
    const promise = (async () => {
      const res = await fetch("/api/place-shares", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error("공유 링크를 준비하지 못했어요. 로그인 후 다시 시도해 주세요.")
      const data = await res.json() as PlaceShare & { url?: string }
      if (!validShareToken(data.token) || typeof data.url !== "string") throw new Error("공유 주소를 확인하지 못했어요.")
      const prepared = { ...data, key, url: data.url }
      cache.current = prepared
      return prepared
    })()
    pending.current = { key, promise }
    try { return await promise }
    finally { if (pending.current?.promise === promise) pending.current = null }
  // The serialized payload is the prewarm boundary for this place.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey])

  useEffect(() => { void prepareShare().catch(() => {}) }, [prepareShare])

  async function run(action: "share" | "copy") {
    if (lock.current) return
    lock.current = true; setBusy(action); setStatus("")
    try {
      const data = await prepareShare()
      if (action === "copy") {
        await navigator.clipboard.writeText(data.url)
        setStatus("장소 링크를 복사했어요.")
      } else {
        onNavigate?.()
        window.location.assign(`/share/place/${data.token}?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "다시 시도해 주세요.")
    } finally {
      lock.current = false; setBusy(null)
    }
  }

  return <div className="my-5">
    <div className="flex justify-center gap-8">
      {(["share", "copy"] as const).map((action, index) => <motion.button key={action} type="button" disabled={!!busy} onClick={() => void run(action)} initial={reduceMotion ? undefined : { opacity: 0, y: 8, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .26, delay: .07 + index * .07, ease: [0, 0, .58, 1] }} whileTap={reduceMotion ? undefined : { scale: .97 }} className="flex w-28 flex-col items-center gap-2 text-sm font-semibold disabled:opacity-60">
        <span className={`flex size-[54px] items-center justify-center rounded-[18px] ${action === "copy" ? "border border-slate-200 bg-white" : "bg-[#fbbf24]"}`}>
          {busy === action ? <Loader2 className="size-6 animate-spin motion-reduce:animate-none" /> : action === "copy" ? <Link size={23} /> : <MessageCircle className="size-[25px] fill-slate-900 text-slate-900" strokeWidth={1.4} />}
        </span>
        {action === "copy" ? "링크 복사" : "카카오톡 공유"}
      </motion.button>)}
    </div>
    <p role="status" className="mt-4 text-xs leading-5 text-slate-500">{status || "사진과 장소 정보를 확인한 뒤 공유해 주세요."}</p>
  </div>
}
