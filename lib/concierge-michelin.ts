import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { readPlacesByGoogleIds } from "@/lib/places-cache"
import { buildPlacePhotoProxyUrl } from "@/lib/place-cover-image"
import { distanceMeters } from "@/lib/geo"
import type { ConciergePick } from "@/app/api/concierge/route"

/** null means not a Michelin question; [] means every verified distinction. */
export function requestedMichelinStars(query: string): number[] | null {
  if (!/미[쉐슐셀]린|미쉘린|michelin/i.test(query)) return null
  if (/미(?:쉐|슐|셀|쉘)린\s*(?:말고|제외|아닌)/.test(query)) return null
  if (!/스타|stars?|별/i.test(query)) return []
  const stars = new Set<number>()
  for (const match of query.matchAll(/([123])\s*(?:스타|stars?|별)/gi)) stars.add(Number(match[1]))
  for (const [word, n] of [["원", 1], ["투", 2], ["쓰리", 3], ["one", 1], ["two", 2], ["three", 3]] as const) {
    if (new RegExp(`${word}\\s*(?:스타|stars?)`, "i").test(query)) stars.add(n)
  }
  // “1, 2, 3 스타” lists and an unqualified “스타” both include the listed/all stars.
  if (/[123]\s*[,·/]\s*[123]/.test(query)) for (const n of query.match(/[123]/g) ?? []) stars.add(Number(n))
  if (/원\s*투\s*쓰리|one\s*two\s*three/i.test(query)) return [1,2,3]
  const bound = query.match(/([123])\s*(?:스타|별)\s*(이상|이하)/)
  if (bound) return [1,2,3].filter(n=>bound[2]==="이상" ? n>=Number(bound[1]) : n<=Number(bound[1]))
  return stars.size ? [...stars].sort() : [1, 2, 3]
}

export async function michelinRecommendations(query: string, center: {lat:number;lng:number}, accommodation: {lat:number;lng:number}|null, existingNames: string[], origin: string) {
  const stars = requestedMichelinStars(query)
  if (stars === null) return null
  const db = getSupabaseAdmin()
  if (!db) throw new Error("Michelin database unavailable")
  const lngRange = Math.min(180, .8 / Math.max(.1, Math.cos(center.lat * Math.PI / 180)))
  let lookup = db.from("michelin_places").select("name,address,lat,lng,distinction,award_year,google_place_id,cuisine,url")
    .gte("lat", center.lat-.8).lte("lat", center.lat+.8).gte("lng",center.lng-lngRange).lte("lng",center.lng+lngRange)
  if (stars.length) lookup = lookup.in("distinction", stars.map(n=>`${n}스타`))
  const {data,error} = await lookup.limit(1000)
  if (error) throw error
  const names = new Set(existingNames.map(n=>n.trim().toLowerCase()))
  const rows = (data ?? []).filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng)&&distanceMeters(center,r)<80000&&!names.has(r.name.trim().toLowerCase()))
    .sort((a,b)=>distanceMeters(accommodation??center,a)-distanceMeters(accommodation??center,b))
  const page = rows.slice(0,12)
  const cache = await readPlacesByGoogleIds(page.map(r=>r.google_place_id).filter((id):id is string=>!!id))
  const results: ConciergePick[] = page.map(r=>{
    const p=r.google_place_id ? cache.get(r.google_place_id) : undefined
    return {name:r.name,localName:r.name,kind:"식당",subCategory:r.cuisine||p?.sub_category||undefined,
      address:r.address||p?.address||"",lat:r.lat,lng:r.lng,rating:p?.rating??undefined,reviewCount:p?.rating_count??undefined,
      imageUrl:p?.photo_references?.[0]?buildPlacePhotoProxyUrl(p.photo_references[0],1200,origin):"",
      michelin:r.distinction,highlight:[r.award_year?`${r.award_year}년`:null,r.distinction||"미쉐린 가이드 등재"].filter(Boolean).join(" "),
      reason:`요청하신 미쉐린 등급과 등록 위치를 확인한 식당이에요.${r.cuisine?` ${r.cuisine} 요리를 제공하는 곳으로 등록되어 있어요.`:""} 방문 전 최신 영업시간과 예약 가능 여부를 확인해 주세요.`,
      distanceKm:accommodation?Math.round(distanceMeters(accommodation,r)/100)/10:undefined}
  })
  return {results,total:rows.length,notice:rows.length>12?`등록 자료에서 ${rows.length}곳을 찾았어요. 가까운 12곳부터 보여드려요.`:"등록된 미쉐린 등급과 위치를 기준으로 찾았어요.",error:results.length?undefined:"이 지역의 등록 자료에서 요청하신 미쉐린 등급을 찾지 못했어요. 다른 등급을 대신 보여드리지는 않았어요."}
}
