"use client"
import { useState } from "react"
import { BEST_SCOPE_LABELS, worldBestFor, worldBestKey, worldBestLabel, worldBestStatus } from "@/shared/world-best"
/** Award history belongs in details only; Discovery never implies a rank or selection year. */
export function WorldBestBadges({ name, address, localName, googlePlaceId }: { name: string; address?: string | null; localName?: string | null; googlePlaceId?: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const rows = worldBestFor(name, address, googlePlaceId)
  const awards = rows.length ? rows : worldBestFor(localName || "", address, googlePlaceId)
  if (!awards.length) return null
  const ranked = awards.filter(r => r.recognition !== "discovery")
  const visible = [...(expanded ? ranked : ranked.slice(0, 3)), ...awards.filter(r => r.recognition === "discovery")]
  return <section aria-label="선정 이력" className="w-full">
    <h3 className="text-base font-semibold text-slate-900">선정 이력</h3>
    {visible.map(r => <a key={worldBestKey(r)} href={r.url} target="_blank" rel="noreferrer" aria-label={`${worldBestLabel(r)} 공식 목록 보기`} className="block border-b border-neutral-200 py-4 last:border-0">
      <span className="text-[11px] font-semibold text-neutral-500">{r.recognition === "discovery" ? "50 BEST DISCOVERY" : `50 BEST ${r.kind === "bars" ? "BARS" : "RESTAURANTS"} · ${worldBestStatus(r)}`}</span>
      <span className="mt-1.5 flex items-center justify-between gap-3 text-base font-semibold text-slate-900"><span>{r.recognition === "discovery" ? "소개 장소" : `${BEST_SCOPE_LABELS[r.scope ?? "world"]} · ${r.year}`}</span><span>{r.recognition !== "discovery" ? `${r.rank}위 ` : ""}↗</span></span>
      {r.recognition === "discovery" ? <span className="mt-1 block text-xs text-neutral-500">순위가 없는 공식 소개 목록이에요.</span> : null}
    </a>)}
    {ranked.length > 3 ? <button type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)} className="min-h-11 text-sm font-medium text-neutral-600">{expanded ? "이력 접기" : `선정 이력 ${ranked.length - 3}건 더 보기`}</button> : null}
  </section>
}
