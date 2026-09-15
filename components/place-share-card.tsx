"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ImageIcon } from "lucide-react"
import { shareQuestionText, scheduleShareWhen, type PlaceShare } from "@/shared/place-share"

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 7 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: .24, delay, ease: [0, 0, .58, 1] as [number, number, number, number] },
})

/** Figma 317:4888. Authenticated preview; only public place fields are rendered. */
export function PlaceShareCard({ share }: { share: PlaceShare }) {
  const reduceMotion = useReducedMotion()
  const p = share.place
  const enter = reduceMotion ? {} : { initial: { opacity: .86, y: 18, scale: .985 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: .34, ease: [0, 0, .58, 1] as [number, number, number, number] } }
  const item = (delay: number) => reduceMotion ? {} : rise(delay)
  return <motion.article {...enter} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white text-left shadow-[0_12px_28px_-8px_rgba(15,23,42,.10)]">
    <motion.div {...(reduceMotion ? {} : { initial: { opacity: .72, scale: 1.04 }, animate: { opacity: 1, scale: 1 }, transition: { duration: .52, ease: [0, 0, .58, 1] } })} className="relative h-[220px] overflow-hidden bg-slate-50">
      {p.imageUrl
        ? <img src={p.imageUrl} alt={p.name || "장소"} className="h-full w-full object-cover" decoding="async" fetchPriority="high" />
        : <div className="flex h-full items-center justify-center"><ImageIcon className="size-8 text-slate-400" aria-hidden="true" /></div>}
    </motion.div>
    <div className="space-y-[9px] px-[18px] pb-[14px] pt-4">
      <motion.div {...item(.10)} className="flex h-[22px] min-w-0 items-center gap-2">
        <img src="/design/withtrip-share-logo.png" width="22" height="22" alt="" className="rounded-[7px]" />
        <p className="truncate text-[13px] font-semibold text-slate-900">{share.sender}님이 {p.schedule ? "여행 일정을" : "이 장소를"} 공유합니다</p>
      </motion.div>
      {p.schedule && <div className="rounded-2xl bg-slate-50 p-3 text-sm leading-6">
        <p className="font-bold">{shareQuestionText(p.schedule.question)}</p>
        <p>{p.schedule.tripTitle}</p><p className="text-slate-500">{scheduleShareWhen(p.schedule)}</p>
      </div>}
      <motion.h1 {...item(.18)} className="line-clamp-2 text-[22px] font-extrabold leading-[29px] text-slate-900">{p.name}</motion.h1>
      <motion.div {...item(.26)} className="flex min-h-7 flex-wrap items-center gap-2">
        {p.category && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-900">{p.category}</span>}
        {p.rating != null && <span className="rounded-full bg-[#fff7db] px-2.5 py-1 text-xs font-bold text-slate-900">★ {p.rating}{p.reviewCount != null ? `  ·  리뷰 ${p.reviewCount.toLocaleString("ko-KR")}` : ""}</span>}
      </motion.div>
      <motion.p {...item(.34)} className="line-clamp-2 text-[13px] leading-[19px] text-slate-500">{p.address}</motion.p>
      {p.description && <motion.p {...item(.40)} className="line-clamp-2 text-[13px] leading-5 text-slate-900">{p.description}</motion.p>}
      <div className="h-px bg-slate-200" />
      <motion.div {...item(.42)} className="flex h-5 items-center gap-[7px]">
        <img src="/design/withtrip-share-logo.png" width="18" height="18" alt="" className="rounded-[5px]" />
        <strong className="text-[11px] tracking-[.2px] text-slate-900">WITHTRIP</strong>
      </motion.div>
    </div>
  </motion.article>
}
