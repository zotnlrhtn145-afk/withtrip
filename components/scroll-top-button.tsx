"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUp } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * 맨 위로.
 *
 * ⚠️ 저장한 곳이 수백 개가 되면 손가락으로 되짚어 올라오는 게 고통스럽다.
 *    앱에는 진작 있었는데 웹에만 없었다 — 같은 기능은 양쪽에 있어야 한다.
 *
 * ⚠️ scroll 이벤트는 손가락 한 번에 수십 번 온다. 매번 setState 하면 목록이 버벅인다.
 *    **문턱을 넘는 순간에만** 바꾼다(앱과 같은 방식).
 */
export function ScrollTopButton({ threshold = 600 }: { threshold?: number }) {
  const [show, setShow] = useState(false)
  const shownRef = useRef(false)

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > threshold
      if (next === shownRef.current) return
      shownRef.current = next
      setShow(next)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [threshold])

  return (
    <button
      type="button"
      aria-label="맨 위로"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        // 떠 있는 하단 탭(bottom-4, 높이 약 56) 바로 위. 데스크톱엔 탭이 없어 더 내린다.
        "fixed bottom-[88px] right-5 z-30 flex size-11 items-center justify-center rounded-full",
        "border border-slate-100 bg-white text-slate-900 shadow-lg",
        "transition-all duration-200 active:scale-95 md:bottom-6",
        show ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      )}
    >
      <ArrowUp className="size-5" />
    </button>
  )
}
