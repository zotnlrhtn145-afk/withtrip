"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, MessageCircle, RotateCw, X } from "lucide-react"
import { ensureKakaoReady } from "@/lib/kakao-share"
import { kakaoPlaceFeed, type PlaceShare } from "@/shared/place-share"
import { PlaceShareCard } from "./place-share-card"

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void }
    __withtripSendKakao?: () => void
  }
}

const postNative = (type: "withtrip:kakao-ready" | "withtrip:kakao-error") => {
  window.ReactNativeWebView?.postMessage(JSON.stringify({ type }))
}

/** Figma 317:4888. The app keeps this bridge hidden and renders the same card natively. */
export function KakaoPlaceBridge({ share, origin }: { share: PlaceShare; origin: string }) {
  const handoff = useRef(false)
  const left = useRef(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const leave = () => { if (handoff.current) left.current = true }
    const resume = () => {
      if (!handoff.current || !left.current || document.hidden) return
      handoff.current = false
      const requested = new URLSearchParams(window.location.search).get("returnTo")
      let path = "/saved"
      try {
        const target = new URL(requested || path, window.location.origin)
        if (target.origin === window.location.origin && !target.pathname.startsWith("/share/")) path = target.pathname + target.search
      } catch { /* use saved list fallback */ }
      window.location.replace(path)
    }
    const visibility = () => { if (document.hidden) leave(); else resume() }
    window.addEventListener("blur", leave)
    window.addEventListener("focus", resume)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      window.removeEventListener("blur", leave)
      window.removeEventListener("focus", resume)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [])

  const send = useCallback(() => {
    try {
      if (!window.Kakao) {
        setError("카카오톡 공유 연결을 다시 준비하고 있어요.")
        postNative("withtrip:kakao-error")
        return
      }
      handoff.current = true
      left.current = false
      window.Kakao.Share.sendDefault(kakaoPlaceFeed(share, origin, process.env.NEXT_PUBLIC_KAKAO_NATIVE_SHARE_ENABLED === "true"))
    } catch {
      handoff.current = false
      setError("카카오톡을 열지 못했어요. 다시 눌러 주세요.")
      postNative("withtrip:kakao-error")
    }
  }, [origin, share])

  useEffect(() => {
    let active = true
    void ensureKakaoReady().then(kakao => {
      if (!active) return
      if (!kakao) {
        setReady(false)
        setError("카카오톡 공유 연결을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.")
        postNative("withtrip:kakao-error")
        return
      }
      setReady(true)
      setError("")
      window.__withtripSendKakao = send
      postNative("withtrip:kakao-ready")
    })
    return () => {
      active = false
      if (window.__withtripSendKakao === send) delete window.__withtripSendKakao
    }
  }, [send])

  const sceneEnter = reduceMotion ? {} : {
    initial: { opacity: 0, x: 48 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: .38, ease: [0, 0, .58, 1] as [number, number, number, number] },
  }
  return <motion.main {...sceneEnter} className="mx-auto flex min-h-dvh max-w-[390px] flex-col bg-white px-5 text-slate-900">
    <header className="flex h-[60px] shrink-0 items-center justify-between">
      <h1 className="text-[22px] font-extrabold">장소 공유</h1>
      <button type="button" aria-label="닫기" onClick={() => window.location.replace("/saved")} className="flex size-9 items-center justify-center rounded-full bg-slate-100 active:opacity-70"><X size={22} /></button>
    </header>
    <div className="flex flex-1 flex-col justify-center py-6">
    <motion.div aria-label="위드트립에서 카카오톡으로 공유" className="flex h-[58px] items-center gap-3" initial={reduceMotion ? undefined : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .31, delay: .07, ease: "easeOut" }}>
      <img src="/design/withtrip-share-logo.png" width="26" height="26" alt="" className="rounded-[7px]" />
      <motion.span initial={reduceMotion ? undefined : { x: -5 }} animate={{ x: 0 }} transition={{ duration: .35, delay: .09, ease: "easeOut" }}><ArrowRight className="size-8 text-slate-400" strokeWidth={1.4} /></motion.span>
      <motion.span initial={reduceMotion ? undefined : { scale: .85 }} animate={{ scale: [1, 1.06, 1] }} transition={{ duration: .4, delay: .09, times: [0, .65, 1], ease: "easeOut" }}><MessageCircle className="size-6 fill-slate-900 text-slate-900" strokeWidth={1.4} /></motion.span>
    </motion.div>
    <PlaceShareCard share={share} />
    <motion.button initial={reduceMotion ? undefined : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35, delay: .17, ease: "easeOut" }} type="button" disabled={!ready} onClick={send} whileTap={reduceMotion ? undefined : { scale: .975 }} className="mt-6 flex h-[76px] w-full items-center gap-3.5 rounded-[24px] border border-slate-200 bg-white px-3.5 text-left shadow-[0_6px_18px_rgba(15,23,42,.055)] disabled:opacity-60">
      <motion.span initial={reduceMotion ? undefined : { scale: .94 }} animate={{ scale: [1, 1.03, 1] }} transition={{ duration: .36, delay: .25, times: [0, .68, 1], ease: "easeOut" }} className="flex size-12 shrink-0 items-center justify-center rounded-[17px] bg-[#fbbf24]">
        {ready ? <MessageCircle className="size-[23px] fill-slate-900 text-slate-900" strokeWidth={1.4} /> : <RotateCw className="size-[23px] animate-spin motion-reduce:animate-none" />}
      </motion.span>
      <span className="min-w-0 flex-1 truncate text-[17px] font-extrabold">카카오톡 공유</span>
      <motion.span initial={reduceMotion ? undefined : { x: -6 }} animate={{ x: [-6, 0, 3, 0] }} transition={{ duration: .72, delay: .25, times: [0, .56, .78, 1], ease: "easeOut" }}><ArrowRight size={27} /></motion.span>
    </motion.button>
    {error && <p role="status" className="mt-3.5 text-center text-xs leading-[18px] text-slate-500">{error}</p>}
    </div>
  </motion.main>
}
