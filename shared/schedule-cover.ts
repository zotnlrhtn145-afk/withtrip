/** Existing search API, shared by app/web. Never substitute a nearby business's photo. */
import { straightKm } from './trip-distance'
type Stop = { name: string; lat?: number | null; lng?: number | null }
const cache = new Map<string, { until: number; value: Promise<string | undefined> }>()
const normalize = (s: string) => s.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
// Only automatic airport action suffixes are removed; ordinary business names stay intact.
export function schedulePlaceName(name: string) {
  return /공항|airport/i.test(name) ? name.replace(/\s+(출발|도착)\s*$/, '').replace(/\([^)]*\)/g, '').trim() : name.trim()
}
function identity(name: string) {
  let value = schedulePlaceName(name)
  if (/공항|airport/i.test(value)) value = value.replace(/\([^)]*\)/g, '').trim()
  const key = normalize(value)
  // Korean transliterations used by our airport preset and Google Places for SGN.
  return ['탄손넛국제공항', '떤선녓국제공항', '탄손누트국제공항'].includes(key) ? 'airport:SGN' : key
}
export async function findScheduleCover(stop: Stop, origin = ''): Promise<string | undefined> {
  if (!stop.name.trim() || stop.lat == null || stop.lng == null) return undefined
  const key = JSON.stringify([origin, normalize(stop.name), stop.lat.toFixed(4), stop.lng.toFixed(4)])
  const hit = cache.get(key)
  if (hit && hit.until > Date.now()) return hit.value
  const value = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    try {
      const query = schedulePlaceName(stop.name)
      const params = new URLSearchParams({ q: query, lat: String(stop.lat), lng: String(stop.lng) })
      const response = await fetch(`${origin}/api/places/search?${params}`, { signal: controller.signal })
      if (!response.ok) return undefined
      const data = await response.json() as { results?: { placeName: string; imageUrl?: string; photoUrls?: string[]; lat?: number; lng?: number }[] }
      const matches = (p: { name: string; lat?: number | null; lng?: number | null }) => identity(p.name) === identity(query)
        && p.lat != null && p.lng != null && straightKm({ lat: stop.lat!, lng: stop.lng! }, { lat: p.lat, lng: p.lng }) <= (/공항|airport/i.test(query) ? 2 : 0.5)
      const exact = data.results?.find(p => matches({ ...p, name: p.placeName }))
      if (exact?.photoUrls?.length) return exact.photoUrls[0]
      // Search often supplies no real photoUrls. Details has the registered venue photos.
      const detailsResponse = await fetch(`${origin}/api/places/details?${params}`, { signal: controller.signal })
      if (!detailsResponse.ok) return undefined
      const { detail } = await detailsResponse.json() as { detail?: { name: string; lat?: number; lng?: number; photos?: string[] } }
      return detail && matches(detail) ? detail.photos?.[0] : undefined
    } catch { return undefined } finally { clearTimeout(timer) }
  })()
  if (cache.size >= 200) cache.delete(cache.keys().next().value!)
  cache.set(key, { value, until: Date.now() + 30 * 60 * 1000 })
  void value.then(uri => { if (!uri && cache.get(key)?.value === value) cache.delete(key) })
  return value
}
