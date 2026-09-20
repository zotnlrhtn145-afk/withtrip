import type { BestScope, WorldBest } from "./world-best"
export type SearchBounds = { n:number; s:number; e:number; w:number }
export type SearchRegion = { name:string; center:{lat:number;lng:number}; bounds:SearchBounds }
export type BestPlace = { google_place_id:string; name:string; address:string; lat:number; lng:number; award:WorldBest; photo?:string; rating?:number|null; rating_count?:number|null }
export function inSearchBounds(p:{lat?:number|null;lng?:number|null}, b:SearchBounds|null):boolean {
 if (!b) return true
 if (p.lat == null || p.lng == null || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false
 return p.lat >= b.s && p.lat <= b.n && (b.w <= b.e ? p.lng >= b.w && p.lng <= b.e : p.lng >= b.w || p.lng <= b.e)
}
export function boundsCenter(b:SearchBounds):{lat:number;lng:number} {
 const lng=b.w<=b.e?(b.w+b.e)/2:((b.w+b.e+360)/2+540)%360-180
 return {lat:(b.n+b.s)/2,lng}
}
/** One venue per place ID. This same array feeds the list, count and map. */
export function filterBestPlaces(rows:BestPlace[],kind:WorldBest["kind"],scope:BestScope|"all",bounds:SearchBounds|null):BestPlace[] {
 const seen=new Set<string>()
 return rows.filter(p=>{if(p.award.kind!==kind || (scope!=="all"&&(p.award.scope??"world")!==scope) || !inSearchBounds(p,bounds) || seen.has(p.google_place_id))return false;seen.add(p.google_place_id);return true})
}
