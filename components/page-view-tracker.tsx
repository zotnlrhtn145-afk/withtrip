"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

import { supabase } from "@/lib/supabase"

/**
 * 화면이 바뀔 때마다 방문 한 줄을 남긴다.
 *
 * ⚠️ **화면을 막지 않는다.** `keepalive` 로 던져 놓고 결과를 안 기다린다 —
 *    통계 때문에 화면 전환이 늦어지면 안 된다.
 */
export function PageViewTracker() {
  const pathname = usePathname()
  const last = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return
    // 리렌더로 같은 경로가 다시 들어오는 경우가 있다 — 두 번 세지 않는다
    if (last.current === pathname) return
    last.current = pathname

    let cancelled = false
    const send = async () => {
      let userId: string | undefined
      try {
        const { data } = await supabase.auth.getUser()
        userId = data.user?.id
      } catch {
        /* 로그인 안 했으면 그냥 익명으로 센다 */
      }
      if (cancelled) return
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: pathname,
          source: "web",
          userId,
          referrer: document.referrer || undefined,
        }),
        keepalive: true,
      }).catch(() => {})
    }

    void send()
    return () => {
      cancelled = true
    }
  }, [pathname])

  return null
}
