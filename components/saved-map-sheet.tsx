"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { animate, motion, useDragControls, useMotionValue, useReducedMotion } from "framer-motion"

export function SavedMapSheet({ children, count, revealKey }: { children: ReactNode; count: number; revealKey?: string | null }) {
  const host = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(600)
  const [stop, setStop] = useState(0)
  useEffect(() => { if (revealKey) setStop(value => Math.max(1, value)) }, [revealKey])
  const controls = useDragControls()
  const y = useMotionValue(488)
  const reduced = useReducedMotion()
  const moved = useRef(false)
  const top = [Math.max(0, height - 112), height * .52, 0]
  useEffect(() => {
    const parent = host.current?.parentElement
    if (!parent) return
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height))
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const target = stop === 0 ? Math.max(0, height - 112) : stop === 1 ? height * .52 : 0
    const animation = animate(y, target, { duration: reduced ? 0 : .32, ease: [.22, 1, .36, 1] })
    return () => animation.stop()
  }, [stop, height, reduced, y])
  const settle = (velocity: number) => {
    const next = Math.abs(velocity) > 420
      ? Math.max(0, Math.min(2, stop + (velocity < 0 ? 1 : -1)))
      : top.reduce((best, value, index) => Math.abs(value - y.get()) < Math.abs(top[best] - y.get()) ? index : best, 0)
    setStop(next)
    // A drag can return to the same stop, so always settle even without a state change.
    animate(y, top[next], { duration: reduced ? 0 : .32, ease: [.22, 1, .36, 1] })
  }
  return <motion.section ref={host} aria-label="저장 장소 목록" className="absolute inset-x-0 top-0 z-10 flex h-full flex-col rounded-t-[28px] bg-white shadow-[0_-8px_30px_#0f172a14]"
    style={{ y }} drag="y" dragControls={controls} dragListener={false} dragConstraints={{ top: 0, bottom: Math.max(0, height - 112) }} dragElastic={0} dragMomentum={false}
    onDrag={() => { moved.current = true }} onDragEnd={(_, info) => settle(info.velocity.y)}>
    <button type="button" aria-label={`장소 ${count}곳, 목록 ${stop === 2 ? "접기" : "펼치기"}`} aria-expanded={stop > 0}
      className="flex min-h-20 shrink-0 touch-none flex-col items-center justify-center gap-3 rounded-t-[28px] outline-offset-[-4px]"
      onPointerDown={event => { moved.current = false; controls.start(event) }}
      onClick={event => { if (!moved.current || event.detail === 0) setStop(value => (value + 1) % 3) }}>
      <span className="h-1 w-10 rounded-full bg-slate-300" />
      <span className="text-sm font-semibold text-slate-900">저장한 장소 {count}곳</span>
    </button>
    <div inert={stop === 0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">{children}</div>
  </motion.section>
}
