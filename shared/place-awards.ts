import { worldBestFor } from "./world-best"
export type PlaceAwards = { michelin?: boolean; michelinYear?: number | null; worldBest?: boolean; bestYear?: number | null; discovery?: boolean }
/** Use known award years only. Discovery is a directory, not a ranked edition. */
export function bestAwardSummary(name: string, address?: string | null, googlePlaceId?: string | null, localName?: string | null): PlaceAwards {
  const rows = worldBestFor(name, address, googlePlaceId)
  const awards = rows.length ? rows : worldBestFor(localName || "", address, googlePlaceId)
  const ranked = awards.filter(a => a.recognition !== "discovery")
  return { worldBest: awards.length > 0, bestYear: ranked.length ? Math.max(...ranked.map(a => a.year)) : null, discovery: awards.length > 0 && !ranked.length }
}
