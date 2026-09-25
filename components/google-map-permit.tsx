"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

/** One reservation per mounted map; never load Maps JS before approval. */
export function GoogleMapPermit({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const permit = useRef<Promise<boolean> | null>(null)
  useEffect(() => {
    let active = true
    permit.current ??= fetch("/api/maps/permit", { method: "POST", cache: "no-store" })
      .then(r => r.ok).catch(() => false)
    void permit.current.then(ok => { if (active) setAllowed(ok) })
    return () => { active = false }
  }, [])
  if (allowed !== true) return <div role="status" className="flex h-full min-h-32 items-center justify-center p-6 text-center text-sm text-muted-foreground">
    {allowed === null ? "지도를 준비하고 있어요." : "지도 조회가 일시 중지되었습니다. 장소 목록은 계속 볼 수 있어요."}
  </div>
  return children
}
