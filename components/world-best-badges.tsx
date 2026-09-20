import { worldBestFor, worldBestLabel } from "@/shared/world-best"
export function WorldBestBadges({ name, address, localName, googlePlaceId }: { name: string; address?: string | null; localName?: string | null; googlePlaceId?: string | null }) {
  const rows = worldBestFor(name, address, googlePlaceId)
  const awards = rows.length ? rows : worldBestFor(localName || "", address, googlePlaceId)
  if (!awards.length) return null
  return <div className="mt-2 flex flex-wrap gap-1.5">{awards.map(r => <a key={r.kind} href={r.url} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center rounded-lg border border-[#FBBF24] px-2 py-1 text-[11px] font-bold text-[#182430]" aria-label={`${worldBestLabel(r)} 공식 목록 보기`}>{worldBestLabel(r)} ↗</a>)}</div>
}
