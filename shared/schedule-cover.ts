/** Existing search API, shared by app/web. Never substitute a nearby business's photo. */
import { straightKm } from './trip-distance'
type Stop = { name: string; lat?: number | null; lng?: number | null }
const cache = new Map<string, { until: number; value: Promise<string | undefined> }>()
const normalize = (s: string) => s.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
export async function findScheduleCover(stop: Stop, origin = ''): Promise<string | undefined> {
  if (!stop.name.trim() || stop.lat == null || stop.lng == null) return undefined
  const key = JSON.stringify([origin, normalize(stop.name), stop.lat.toFixed(4), stop.lng.toFixed(4)])
  const hit = cache.get(key)
  if (hit && hit.until > Date.now()) return hit.value
  const value = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    try {
      const params = new URLSearchParams({ q: stop.name, lat: String(stop.lat), lng: String(stop.lng) })
      const response = await fetch(`${origin}/api/places/search?${params}`, { signal: controller.signal })
      if (!response.ok) return undefined
      const data = await response.json() as { results?: { placeName: string; imageUrl?: string; photoUrls?: string[]; lat?: number; lng?: number }[] }
      const exact = data.results?.find(p => normalize(p.placeName) === normalize(stop.name)
        && p.lat != null && p.lng != null && straightKm({ lat: stop.lat!, lng: stop.lng! }, { lat: p.lat, lng: p.lng }) <= 0.5)
      return exact?.photoUrls?.[0] || undefined
    } catch { return undefined } finally { clearTimeout(timer) }
  })()
  if (cache.size >= 200) cache.delete(cache.keys().next().value!)
  cache.set(key, { value, until: Date.now() + 30 * 60 * 1000 })
  return value
}
