"use client"
import { motion, useReducedMotion } from "framer-motion"
import { MapPin, Plane } from "lucide-react"
import { useEffect, useState } from "react"

export function TravelStartArt() {
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const change = () => setVisible(!document.hidden)
    change()
    document.addEventListener("visibilitychange", change)
    return () => document.removeEventListener("visibilitychange", change)
  }, [])
  const moving = !reduced && visible
  return <div role="img" aria-label="펼쳐진 여행 지도와 비행기" className="relative h-[210px] w-[270px]">
    <motion.div initial={false} animate={{ rotate: -8, scale: 1 }} className="absolute left-4 top-20 flex h-[120px] w-[228px] drop-shadow-xl">
      {[0, 1, 2].map(i => <div key={i} className="flex-1 border border-slate-200 bg-white" style={{ transform: `skewY(${i === 1 ? 8 : -8}deg)` }} />)}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 228 120" fill="none"><path d="M20 87 C54 8 102 115 142 45 S199 28 212 35" stroke="#fbbf24" strokeWidth="4" strokeDasharray="5 7" /></svg>
      <MapPin className="absolute left-[110px] top-4 size-9 fill-amber-400 text-slate-900" />
    </motion.div>
    <motion.div className="absolute right-7 top-6" animate={{ x: moving ? [0, -18, 0] : 0, y: moving ? [0, -24, 0] : 0, rotate: -20 }} transition={{ duration: 4.6, repeat: moving ? Infinity : 0, ease: "easeInOut" }}><Plane className="size-12 fill-slate-900 text-slate-900" /></motion.div>
  </div>
}
