"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import styles from "./login-quiet.module.css"

/** 승인 시안의 경로와 실제 로고. 배경/시트 뒤에서는 프레임을 멈춥니다. */
export function LoginMotionArt({ paused }: { paused: boolean }) {
  const art = useRef<HTMLButtonElement>(null)
  const route = useRef<SVGPathElement>(null)
  const dot = useRef<SVGCircleElement>(null)
  const emblem = useRef<HTMLSpanElement>(null)
  const elapsed = useRef(0)
  const [replay, setReplay] = useState(0)

  useEffect(() => {
    const button = art.current
    const path = route.current
    const marker = dot.current
    const logo = emblem.current
    if (!button || !path || !marker || !logo) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    const length = path.getTotalLength()
    const ease = (p: number) => 1 - Math.pow(1 - p, 3)
    const clamp = (p: number) => Math.max(0, Math.min(1, p))
    let inView = true
    let frame = 0
    let last = 0
    const paint = () => {
      const t = elapsed.current
      const p = reduced.matches ? 1 : clamp((t - 350) / 1500)
      const point = path.getPointAtLength(ease(p) * length)
      path.style.strokeDashoffset = String(1 - ease(p))
      marker.setAttribute("cx", String(point.x))
      marker.setAttribute("cy", String(point.y))
      marker.style.opacity = p > 0 ? "1" : "0"
      const enter = reduced.matches ? 1 : ease(clamp(t / 650))
      const drift = reduced.matches ? 0 : Math.sin(Math.max(0, t - 2000) / 4200 * Math.PI * 2) * 1.8
      const tilt = reduced.matches ? 0 : Math.sin(Math.max(0, t - 2000) / 5400 * Math.PI * 2) * 1.2
      logo.style.transform = `translateY(${(1 - enter) * 6 + drift}px) rotate(${(1 - enter) * -18 + tilt}deg) scale(${.94 + .06 * enter})`
      logo.style.opacity = String(.45 + .55 * enter)
    }
    const tick = (now: number) => {
      frame = 0
      if (!inView || document.hidden || reduced.matches || paused) return
      elapsed.current += last ? Math.min(now - last, 50) : 0
      last = now
      paint()
      frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      cancelAnimationFrame(frame)
      frame = 0
      last = 0
      paint()
      if (inView && !document.hidden && !reduced.matches && !paused) frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync() }, { threshold: .1 })
    observer.observe(button)
    document.addEventListener("visibilitychange", sync)
    reduced.addEventListener("change", sync)
    sync()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener("visibilitychange", sync)
      reduced.removeEventListener("change", sync)
    }
  }, [paused, replay])

  return <button ref={art} className={styles.art} type="button" aria-label="나침반과 여행 경로 움직임 다시 보기" onClick={() => { elapsed.current = 0; setReplay(v => v + 1) }}>
    <svg className={styles.routeArt} viewBox="0 0 280 172" aria-hidden="true">
      <path d="M28 123 C65 155 201 143 244 57" fill="none" stroke="#e9ecef" strokeWidth="1.4" />
      <path ref={route} d="M28 123 C65 155 201 143 244 57" pathLength="1" fill="none" stroke="#fbbf24" strokeWidth="1.7" strokeLinecap="round" strokeDasharray="1" strokeDashoffset="1" />
      <circle cx="28" cy="123" r="3" fill="#fff" stroke="#cbd1d6" strokeWidth="1.4" />
      <circle cx="244" cy="57" r="3" fill="#fff" stroke="#cbd1d6" strokeWidth="1.4" />
      <circle ref={dot} cx="244" cy="57" r="3.3" fill="#fbbf24" opacity="0" />
    </svg>
    <span ref={emblem} className={styles.emblem}><Image src="/withtrip-logo.png" alt="" width={123} height={123} priority /></span>
  </button>
}
