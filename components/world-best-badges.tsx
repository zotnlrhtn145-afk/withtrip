"use client"
import { useState } from "react"
import { BEST_SCOPE_LABELS, worldBestFor, worldBestKey, worldBestLabel, worldBestStatus, type WorldBest } from "@/shared/world-best"
import { WORLD_BEST_LOGO_SVG } from "@/shared/world-best-logo"
const logo = `data:image/svg+xml,${encodeURIComponent(WORLD_BEST_LOGO_SVG)}`
function AwardBadge({ award }: { award: WorldBest }) {
  const discovery = award.recognition === "discovery"
  return <a href={award.url} target="_blank" rel="noreferrer" aria-label={`${worldBestLabel(award)} · ${worldBestStatus(award)} · 공식 출처 보기`} title={worldBestLabel(award)} className="inline-flex min-h-11 max-w-full items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400">
    <span className="inline-flex min-h-[30px] max-w-full items-center gap-2 overflow-hidden rounded-md border border-neutral-200 bg-white pr-2.5">
      <span className="flex w-11 shrink-0 self-stretch items-center justify-center bg-[#182430]"><img src={logo} alt="" width={32} height={19} /></span>
      <span className="min-w-0 break-words py-1 text-[11px] leading-4 text-neutral-500">{discovery ? "Discovery" : `${BEST_SCOPE_LABELS[award.scope ?? "world"]} · ${award.year}`}</span>
      <span className="shrink-0 text-xs font-semibold text-[#182430]">{discovery ? "소개" : `${award.rank}위`}</span>
    </span>
  </a>
}
/** Figma382:4898: 30px visible mark, 44px touch target; additional history stays collapsed. */
export function WorldBestBadges({ name, address, localName, googlePlaceId }: { name: string; address?: string | null; localName?: string | null; googlePlaceId?: string | null }) {
  const [expandedFor, setExpandedFor] = useState<string | null>(null)
  const identity = googlePlaceId || `${name}:${address ?? ""}`
  const expanded = expandedFor === identity
  const rows = worldBestFor(name, address, googlePlaceId)
  const awards = rows.length ? rows : worldBestFor(localName || "", address, googlePlaceId)
  if (!awards.length) return null
  const [first, ...rest] = awards
  return <div aria-label="50 BEST 선정 이력">
    <div className="flex flex-wrap items-center gap-x-2">
      <AwardBadge award={first} />
      {rest.length ? <button type="button" aria-label={expanded ? "다른 선정 이력 접기" : `다른 선정 이력 ${rest.length}건 보기`} aria-expanded={expanded} onClick={() => setExpandedFor(expanded ? null : identity)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-amber-400"><span className="rounded-md bg-neutral-100 px-2.5 py-1.5 text-xs font-medium text-neutral-600">{expanded ? "접기" : `+${rest.length}`}</span></button> : null}
    </div>
    {expanded ? <div className="flex flex-wrap gap-x-2">{rest.map(award => <AwardBadge key={worldBestKey(award)} award={award} />)}</div> : null}
  </div>
}
