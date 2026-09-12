"use client"
import { useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"
import styles from "./travel-start-art.module.css"

/** frozen empty.html의 SVG·CSS·키프레임을 그대로 사용합니다. */
export function TravelStartArt() {
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(true)
  const [replay, setReplay] = useState(0)
  useEffect(() => {
    const change = () => setVisible(!document.hidden)
    change()
    document.addEventListener("visibilitychange", change)
    return () => document.removeEventListener("visibilitychange", change)
  }, [])
  return <button key={replay} type="button" aria-label="여행 일러스트 애니메이션 다시 재생" className={styles.art} data-paused={!visible} data-reduced={!!reduced} onClick={() => setReplay(value => value + 1)}>
    <div className={styles.map}>
      <div className={`${styles.fold} ${styles.f1}`} /><div className={`${styles.fold} ${styles.f2}`} /><div className={`${styles.fold} ${styles.f3}`} />
      <div className={`${styles.land} ${styles.l1}`} /><div className={`${styles.land} ${styles.l2}`} />
      <div className={styles.route}><div /></div>
      <div className={styles.pin}><img src="/design/empty/MapPin.svg" width={49} height={59} alt="" /></div>
    </div>
    <div className={styles.airtrail} /><div className={styles.flight}><div className={styles.plane}><img src="/design/empty/Send.svg" width={64} height={64} alt="" /></div></div>
  </button>
}
