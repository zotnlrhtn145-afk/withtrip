"use client"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { animate, motion, useDragControls, useMotionValue, useReducedMotion, useTransform } from "framer-motion"
import { SavedDesignIcon } from "./saved-place-card"
import styles from "./saved-exact.module.css"

export function SavedMapSheet({ children, count, title = "전체보기", subtitle, resetKey, revealKey, collapseKey }: { children: ReactNode; count: number; title?: string; subtitle?: string; resetKey?: string; revealKey?: string | null; collapseKey?: number }) {
  const host = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(844), [stop, setStop] = useState(0)
  const controls = useDragControls(), y = useMotionValue(732), reduced = useReducedMotion(), moved = useRef(false)
  const top = [Math.max(0, height - 112), height * .54, height * .1]
  const sheetHeight = useTransform(y, value => Math.max(112, height - value))
  useEffect(() => { const parent = host.current?.parentElement; if (!parent) return; const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height)); observer.observe(parent); return () => observer.disconnect() }, [])
  useEffect(() => { setStop(0); if (body.current) body.current.scrollTop = 0 }, [resetKey, collapseKey])
  useEffect(() => { if (revealKey) setStop(value => Math.max(1, value)) }, [revealKey])
  useEffect(() => { const animation = animate(y, stop === 0 ? Math.max(0, height - 112) : stop === 1 ? height * .54 : height * .1, { duration: reduced ? 0 : .35, ease: [.22, 1, .36, 1] }); return () => animation.stop() }, [stop, height, reduced, y])
  const settle = (velocity: number) => { const next = Math.abs(velocity) > 420 ? Math.max(0, Math.min(2, stop + (velocity < 0 ? 1 : -1))) : top.reduce((best, value, index) => Math.abs(value - y.get()) < Math.abs(top[best] - y.get()) ? index : best, 0); setStop(next); animate(y, top[next], { duration: reduced ? 0 : .35, ease: [.22, 1, .36, 1] }) }
  const toggle = () => setStop(value => (value + 1) % 3)
  return <motion.section ref={host} aria-label="저장 장소 목록" data-saved-stop={["lip", "mid", "full"][stop]} className="absolute inset-x-0 top-0 z-30 flex flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[0_-5px_28px_#18243010]" style={{ y, height: sheetHeight }} drag="y" dragControls={controls} dragListener={false} dragConstraints={{ top: height * .1, bottom: Math.max(0, height - 112) }} dragElastic={0} dragMomentum={false} onDrag={() => { moved.current = true }} onDragEnd={(_, info) => settle(info.velocity.y)}>
    <button type="button" aria-label={`장소 ${count}곳, 목록 ${stop === 2 ? "접기" : "펼치기"}`} aria-expanded={stop > 0} className="flex h-11 shrink-0 touch-none items-center justify-center" onPointerDown={event => { moved.current = false; controls.start(event) }} onClick={event => { if (!moved.current || event.detail === 0) toggle() }}><span className="h-1 w-9 rounded-full bg-[#c3c7cd]" /></button>
    <div className={styles.sheetTitle}><button onClick={toggle}><h2>{title}</h2><p>{subtitle || `${count}곳`}</p></button><button className={styles.round} aria-label="목록 단계 변경" onClick={toggle}><SavedDesignIcon name="list" /></button></div>
    <div ref={body} inert={stop === 0} style={{ visibility: stop === 0 ? "hidden" : "visible" }} className={styles.sheetBody} onFocusCapture={event => { if ((event.target as HTMLElement).tagName === "INPUT") setStop(2) }} onPointerDown={event => { if (stop < 2 && !(event.target as HTMLElement).closest("input,button,a")) { moved.current = false; controls.start(event) } }}>{children}</div>
  </motion.section>
}
