export type PlaceEvidence = {
  place_id?: string; name?: string; formatted_address?: string; types?: string[];
  business_status?: string; rating?: number; user_ratings_total?: number;
  photos?: { photo_reference?: string }[];
  geometry?: { location?: { lat?: number; lng?: number } };
}
export type Candidate = { name: string; localName?: string; addressHint?: string; placeType?: string; kind: string; highlight: string; reason: string }
const categoryTypes: Record<string, string[]> = {
  클럽: ['night_club'], 헬스장: ['gym'], 식당: ['restaurant'], 바: ['bar'], 카페: ['cafe'], 스파: ['spa'], 쇼핑: ['shopping_mall','department_store','store'], 명소: ['tourist_attraction','park','museum','zoo','aquarium','art_gallery','church','hindu_temple','mosque','synagogue'],
}
export const supportedTypes = [...new Set(Object.values(categoryTypes).flat())]
export function requestedTypes(query: string): string[] {
  const out: string[] = []
  if (/나이트\s*클럽|night\s*club|댄스\s*클럽|클럽/i.test(query) && !/헬스\s*클럽|health\s*club|골프\s*클럽/i.test(query)) out.push('night_club')
  if (/헬스|피트니스|fitness|\bgym\b/i.test(query)) out.push('gym')
  if (/식당|맛집|restaurant/i.test(query)) out.push('restaurant')
  if (/카페|cafe|coffee/i.test(query)) out.push('cafe')
  if (/술집|칵테일|\bbar\b/i.test(query)) out.push('bar')
  if (/스파|마사지|\bspa\b/i.test(query)) out.push('spa')
  return out
}
export function candidateTypes(p: Candidate, query: string): string[] {
  const requested = requestedTypes(query)
  if (requested.length === 1) return requested
  const own = supportedTypes.includes(p.placeType || '') ? [p.placeType!] : categoryTypes[p.kind] || []
  return requested.length ? own.filter(t => requested.includes(t)) : own
}
export function normalizedPlaceName(s: string) {
  return s.normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/gi,'d').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
}
function nameMatches(expected: string, found: string) {
  const a = normalizedPlaceName(expected), b = normalizedPlaceName(found)
  return a.length >= 3 && (a === b || (Math.min(a.length,b.length)/Math.max(a.length,b.length) >= .65 && (a.includes(b)||b.includes(a))))
}
export function selectVerifiedPlace(p: Candidate, query: string, results: PlaceEvidence[], center: { lat: number; lng: number }, distance: (a: {lat:number;lng:number}, b: {lat:number;lng:number})=>number) {
  const types = candidateTypes(p, query)
  if (!types.length) return null // An unverified “other” is not evidence of the requested business.
  const matches = results.filter(r => {
    const {lat,lng} = r.geometry?.location || {}
    if (!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat!)>90||Math.abs(lng!)>180 || !r.place_id || !r.formatted_address) return false
    if (r.business_status?.startsWith('CLOSED') || !Number.isFinite(r.rating) || (r.rating ?? 0)<4) return false
    if (!types.some(t => r.types?.includes(t))) return false
    if (![p.name,p.localName||''].some(n=>nameMatches(n,r.name||''))) return false
    if (distance(center,{lat:lat!,lng:lng!}) > 80000) return false
    // AI address is only a disambiguation hint, never returned as verified data.
    const expectedNo=p.addressHint?.trim().match(/^\d+[a-z]?(?:[/-]\d+)?\b/i)?.[0]?.toLowerCase()
    const actualNo=r.formatted_address.trim().match(/^\d+[a-z]?(?:[/-]\d+)?\b/i)?.[0]?.toLowerCase()
    return !expectedNo || (!!actualNo && expectedNo===actualNo)
  })
  // Similar named branches remain ambiguous; do not silently choose the first one.
  const ids=new Set(matches.map(r=>r.place_id))
  return ids.size===1 ? matches[0] : null
}
