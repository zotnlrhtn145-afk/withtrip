import { NextResponse } from "next/server"
import { placeRecommendationCopy } from "@/shared/place-recommendation-copy"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { buildPlacePhotoProxyUrl } from "@/lib/place-cover-image"
import { candidateTypes, selectVerifiedPlace, supportedTypes, type Candidate, type PlaceEvidence } from "@/lib/concierge-validation"
import { reviewRecommendationPhotos } from "@/lib/concierge-photos"
import { getCachedSearch, readPlacesByGoogleIds, putCachedSearch, writePlaces } from "@/lib/places-cache"
import { distanceMeters } from "@/lib/geo"

/**
 * AI 컨시어지 — **자유 문장**으로 묻는다 (회의 결정).
 *
 * "일월화수는 숙소 근처에서 럭셔리하게 — 와인, 루프탑, 스파" 같은 의도를
 * 제미나이가 큰 틀(후보)로 바꾸고, 우리는 그 큰 틀을 **검증하고 실행**한다:
 *   · 구글 Places 로 실존·좌표·평점 확인 (평점 4.0 미만 탈락 — 집 규칙)
 *   · 미쉐린 표(1,406곳)와 대조해 등급 뱃지
 *   · 숙소 좌표 기준 가까운 순
 * 앱 쪽 카드의 [찜에 담기]·[일정에 넣기]가 "사람의 손길" 자리다.
 *
 * ⚠️ suggest-attractions(관광명소 고정 프롬프트)의 일반화판이다. 그쪽과
 *    같은 그라운딩 전략(장소당 Text Search 1회)을 쓴다 — 상세 조회까지
 *    돌리면 타임아웃 위험.
 */
export const runtime = "nodejs"
export const maxDuration = 60

type LatLng = { lat: number; lng: number }

export type ConciergePick = {
  name: string
  localName: string
  highlight?: string
  reason: string
  kind: string
  address: string
  imageUrl: string
  photoLabel?: string
  photoDescription?: string
  photoAnalyzed?: boolean
  rating?: number
  reviewCount?: number
  lat: number
  lng: number
  distanceKm?: number
  michelin?: string | null
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s·・‧,.()[\]{}'"!?~\-–—_/]/g, "")
    .trim()
}

function getPlacesApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  ).trim()
}

const CITIES = new Map<string, {at:number;point:LatLng}>()
async function cityCenter(city:string,country:string,key:string):Promise<LatLng|null> {
  const cacheKey=JSON.stringify([city,country]);const hit=CITIES.get(cacheKey)
  if(hit&&Date.now()-hit.at<86400000)return hit.point
  try {
    const url=new URL("https://maps.googleapis.com/maps/api/geocode/json");url.searchParams.set("address",`${city} ${country}`);url.searchParams.set("key",key)
    const r=await fetch(url,{signal:AbortSignal.timeout(5000)});if(!r.ok)return null
    const data=await r.json();const candidates=(data.results??[]).filter((v:{types?:string[];partial_match?:boolean})=>!v.partial_match&&v.types?.some(t=>['locality','administrative_area_level_1','administrative_area_level_2'].includes(t)))
    if(candidates.length!==1)return null
    const point=candidates[0].geometry?.location
    if(!Number.isFinite(point?.lat)||!Number.isFinite(point?.lng)||Math.abs(point.lat)>90||Math.abs(point.lng)>180)return null
    CITIES.set(cacheKey,{at:Date.now(),point});while(CITIES.size>200)CITIES.delete(CITIES.keys().next().value!)
    return point
  }catch{return null}
}
async function ground(p:Candidate, query:string, city:string, country:string, center:LatLng, apiKey:string, origin:string) {
  try {
    const expected=candidateTypes(p,query);if(!expected.length)return null
    const search=`${p.name} ${p.localName||''} ${p.addressHint||''} ${city} ${country} ${expected.join(' ')}`
    const searchKey=JSON.stringify(['concierge-verified-v3',search])
    const ids=await getCachedSearch(searchKey)
    const cached=ids?.length?await readPlacesByGoogleIds(ids):null
    let rows:PlaceEvidence[]=[]
    if(ids?.length&&cached?.size===ids.length){rows=ids.map(id=>{const r=cached.get(id)!;return {place_id:id,name:r.name,formatted_address:r.address||'',types:r.google_types||[],business_status:r.is_closed?'CLOSED_PERMANENTLY':undefined,rating:r.rating??undefined,user_ratings_total:r.rating_count??undefined,photos:(r.photo_references||[]).map(photo_reference=>({photo_reference})),geometry:{location:{lat:r.lat,lng:r.lng}}}})}
    else {
      const url=new URL("https://maps.googleapis.com/maps/api/place/textsearch/json")
      url.searchParams.set('query',search);url.searchParams.set('key',apiKey);url.searchParams.set('language','ko')
      if(expected.length===1)url.searchParams.set('type',expected[0])
      url.searchParams.set('location',`${center.lat},${center.lng}`);url.searchParams.set('radius','50000')
      const r=await fetch(url,{signal:AbortSignal.timeout(6500)});if(!r.ok)return null
      const j=await r.json();rows=Array.isArray(j.results)?j.results:[]
    }
    const top=selectVerifiedPlace(p,query,rows,center,distanceMeters)
    if(!top)return null
    let refs=(top.photos||[]).map(v=>v.photo_reference||'').filter(Boolean).slice(0,2)
    if(refs.length<2){
      try{const u=new URL('https://maps.googleapis.com/maps/api/place/details/json');u.searchParams.set('place_id',top.place_id!);u.searchParams.set('fields','photos');u.searchParams.set('key',apiKey);const r=await fetch(u,{signal:AbortSignal.timeout(4000)});if(r.ok){const j=await r.json();const more=(j.result?.photos||[]).map((v:{photo_reference?:string})=>v.photo_reference).filter((v:unknown):v is string=>typeof v==='string');refs=[...new Set([...refs,...more])].slice(0,2)}}catch{}
    }
    const loc=top.geometry!.location!;const point={lat:loc.lat!,lng:loc.lng!}
    if(!cached?.size) {await writePlaces([{googlePlaceId:top.place_id!,name:top.name!,address:top.formatted_address,...point,rating:top.rating,ratingCount:top.user_ratings_total,googleTypes:top.types,photoReferences:refs}]);await putCachedSearch(searchKey,[top.place_id!])}
    return {name:top.name!,localName:top.name!,address:top.formatted_address!,imageUrl:refs[0]?buildPlacePhotoProxyUrl(refs[0],1200,origin):'',rating:top.rating,reviewCount:top.user_ratings_total,...point,photoRefs:refs,verifiedType:expected.find(t=>top.types?.includes(t))!}
  }catch{return null}
}

/*
  비용 안전장치 (v3.2 GO 확정):
  ① 같은 도시+비슷한 질문 1시간 캐시 — 위디의 방에서 같은 걸 다시 물어도 0원
  ② 그라운딩 후보 10 → 6곳 (Text Search 회당 $0.032)
  ③ 여행당 일 상한 — 폭주 방지 뚜껑 (넘으면 정중히 내일로)
  서버리스 메모리 캐시라 인스턴스마다 따로지만, 같은 사용자의 연타는 대부분
  같은 인스턴스에 떨어진다 — 완벽보다 뚜껑이 목적이다.
*/
const CACHE = new Map<string, { at: number; results: ConciergePick[] }>()
const CACHE_TTL = 60 * 60 * 1000
const DAILY = new Map<string, { day: string; n: number }>()
const DAILY_CAP = 10

export async function POST(request: Request) {
  try {
    const geminiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim()
    const placesKey = getPlacesApiKey()
    if (!geminiKey || !placesKey) {
      return NextResponse.json({ results: [], error: "서버 설정이 없어요." }, { status: 200 })
    }

    const body = (await request.json()) as {
      query?: string
      city?: string
      country?: string
      accommodation?: LatLng | null
      existingNames?: string[]
    }
    const query = String(body.query ?? "").trim().slice(0, 300)
    const city = String(body.city ?? "").trim()
    if (!query || !city) {
      return NextResponse.json({ results: [], error: "무엇을 찾는지 적어 주세요." }, { status: 200 })
    }
    const tripId = String((body as { tripId?: string }).tripId ?? "").trim()
    const country = String(body.country ?? "").trim()

    /* ① 캐시 — 같은 도시+질문이면 그대로 돌려준다 */
    const cacheKey = JSON.stringify(["verified-v3", city, country, query, body.accommodation ?? null, Array.isArray(body.existingNames) ? [...body.existingNames].sort() : [], tripId])
    const hit = CACHE.get(cacheKey)
    if (hit && Date.now() - hit.at < CACHE_TTL) {
      return NextResponse.json({ results: hit.results, cached: true })
    }

    /* ③ 여행당 일 상한 */
    if (tripId) {
      const today = new Date().toISOString().slice(0, 10)
      const d = DAILY.get(tripId)
      const n = d && d.day === today ? d.n : 0
      if (n >= DAILY_CAP) {
        return NextResponse.json(
          { results: [], error: "오늘은 위디가 많이 뛰었어요 — 내일 다시 물어봐 주세요." },
          { status: 200 }
        )
      }
      DAILY.set(tripId, { day: today, n: n + 1 })
    }
    const destination = country ? `${city}, ${country}` : city
    const existingNames = Array.isArray(body.existingNames)
      ? body.existingNames.map((n) => String(n ?? "").trim()).filter(Boolean)
      : []
    const accommodation: LatLng | null =
      body.accommodation && typeof body.accommodation.lat === "number" && typeof body.accommodation.lng === "number"
        ? body.accommodation
        : null

    /*
      의도를 그대로 준다 — 요약하거나 고치지 않는다. 사람이 쓴 문장이 곧 스펙이다.
      ⚠️ 숙소 좌표가 있으면 "그 근처 우선"을 명시한다 — 제미나이 앱과 우리의
         차이가 여기서 시작된다(제미나이는 내 숙소를 모른다).
    */
    const promptText =
      `${destination} 여행 중인 사용자의 요청: "${query}"\n` +
      (accommodation ? `사용자의 숙소 좌표는 (${accommodation.lat}, ${accommodation.lng}) — 이 근처를 우선해라.\n` : "") +
      `이 요청에 딱 맞는 실제 장소 10곳을 추천해줘. 실존하는, 지도에서 검색되는 정확한 상호만.\n` +
      `서로 겹치지 않는 다른 장소여야 하고, 관광객 함정보다 현지에서 평가가 좋은 곳을 골라라.\n` +
      (existingNames.length > 0 ? `이미 목록에 있어 제외할 곳: ${existingNames.join(", ")}\n` : "") +
      `각 장소마다 highlight는 핵심 특징 하나를 8~24자 한국어로, reason은 이 사용자의 요청과 그 특징이 어떻게 맞는지 2~3문장(80~180자)으로 각각 작성해라.\n` +
      `reason에서 highlight를 그대로 반복하지 말고, 어떤 활동이나 상황에 적합한지 구체적으로 설명해라. 모든 장소에 같은 문장을 복사하지 마라.\n` +
      `확인되지 않은 시설, 가격, 운영시간, 예약/일일 입장 가능 여부, 자격/수상은 단정하지 마라. 불확실한 방문 조건은 확인이 필요하다고 밝혀라. 근거가 부족하면 빈칸을 채우려고 사실을 만들지 마라. 최고급·럭셔리·프라이빗 같은 품질이나 독점성 표현을 근거 없이 사용하지 마라.\n` +
      `정확한 현지 상호 localName, 아는 경우 주소 addressHint(모르면 빈 문자열), 실제 업종 placeType을 ${supportedTypes.join("/")} 중 하나로 명시해라. 헬스클럽은 gym, 나이트클럽은 night_club이며 동명 화장품 매장은 제외.\n` +
      `종류는 헬스장/식당/바/카페/스파/클럽/명소/쇼핑/기타. 반드시 JSON만: {"picks":[{"name":"정확한 상호","localName":"현지 상호","addressHint":"주소 또는 빈 문자열","placeType":"gym","highlight":"핵심 특징","reason":"요청과 연결한 상세 추천 이유","kind":"종류"}]}`

    let picks: Candidate[] = []
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      let response: Response
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }
      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        const rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").replace(/```json|```/g, "").trim()
        const parsed = JSON.parse(rawText) as { picks?: Array<{ name?: string; localName?: string; addressHint?: string; placeType?: string; highlight?: string; reason?: string; kind?: string }> }
        picks = (parsed.picks ?? [])
          .map((p) => ({
            name: String(p.name ?? "").trim(),
            localName: typeof p.localName === "string" ? p.localName.trim() : "",
            addressHint: typeof p.addressHint === "string" ? p.addressHint.trim() : "",
            placeType: typeof p.placeType === "string" ? p.placeType.trim() : "",
            ...placeRecommendationCopy(p),
            kind: String(p.kind ?? "기타").trim(),
          }))
          .filter((p) => p.name)
      }
    } catch {
      /* 아래에서 빈 결과로 처리 */
    }
    if (picks.length === 0) {
      return NextResponse.json({ results: [], error: "추천을 만들지 못했어요. 다시 물어봐 주세요." }, { status: 200 })
    }
    /* ② 그라운딩은 6곳까지 — Text Search 가 회당 돈이다 */
    picks = picks.slice(0, 6)

    /* 그라운딩 — 실존·좌표·평점. 평점 4.0 미만은 탈락(집 규칙) */
    const origin = new URL(request.url).origin
    const center=await cityCenter(city,country,placesKey)
    if(!center)return NextResponse.json({results:[],error:"여행 지역을 정확히 확인하지 못했어요. 도시와 국가를 확인해 주세요."})
    const grounded = await Promise.all(picks.map((p) => ground(p, query, city, country, center, placesKey, origin)))
    const photos=await reviewRecommendationPhotos(grounded.map(g=>({refs:g?.photoRefs||[],type:g?.verifiedType||''})),geminiKey)
    let results: ConciergePick[] = []
    for (let i = 0; i < picks.length; i++) {
      const g = grounded[i]
      if (!g) continue
      if ((g.rating ?? 0) < 4.0) continue
      results.push({
        name:g.name,localName:g.localName,address:g.address,lat:g.lat,lng:g.lng,rating:g.rating,reviewCount:g.reviewCount,
        ...photos[i],
        ...placeRecommendationCopy(picks[i]),
        reason: [placeRecommendationCopy(picks[i]).reason, photos[i].imageUrl
          ? `사진 안내: ${photos[i].photoAnalyzed ? `${photos[i].photoLabel} (AI 분류). ${photos[i].photoDescription} 사진만으로 시설 품질이나 현재 이용 조건은 확인할 수 없어요.` : photos[i].photoDescription}`
          : '등록된 장소 사진을 확인하지 못했어요.'].filter(Boolean).join('\n\n'),
        kind: ({gym:'헬스장',night_club:'클럽',restaurant:'식당',cafe:'카페',bar:'바',spa:'스파'} as Record<string,string>)[g.verifiedType] || picks[i].kind,
        distanceKm: accommodation
          ? Math.round((distanceMeters(accommodation, { lat: g.lat, lng: g.lng }) / 1000) * 10) / 10
          : undefined,
        michelin: null,
      })
    }

    /* 겹침 제거 (같은 이름·120m 안) */
    const dedup: ConciergePick[] = []
    for (const item of results) {
      const norm = normalizeName(item.name)
      const dup = dedup.some((kept) => {
        const keptNorm = normalizeName(kept.name)
        if (norm === keptNorm) return true
        if (norm.length >= 3 && (norm.includes(keptNorm) || keptNorm.includes(norm))) return true
        return distanceMeters({ lat: item.lat, lng: item.lng }, { lat: kept.lat, lng: kept.lng }) < 120
      })
      if (!dup) dedup.push(item)
    }
    results = dedup

    /* 미쉐린 대조 — 이름 또는 150m 근접. 우리만 붙일 수 있는 뱃지 */
    const admin = getSupabaseAdmin()
    if (admin && results.length > 0) {
      const lats = results.map((r) => r.lat)
      const lngs = results.map((r) => r.lng)
      const { data: mich } = await admin
        .from("michelin_places")
        .select("name, distinction, lat, lng")
        .gte("lat", Math.min(...lats) - 0.05)
        .lte("lat", Math.max(...lats) + 0.05)
        .gte("lng", Math.min(...lngs) - 0.05)
        .lte("lng", Math.max(...lngs) + 0.05)
      for (const r of results) {
        /*
          ⚠️ 근접만으로 붙이면 안 된다 — 미쉐린 식당 옆 스파에 뱃지가 붙었다(실측).
             이름이 같거나, (식당이면서 60m 안)일 때만 인정한다.
        */
        const hit = ((mich ?? []) as { name: string; distinction: string | null; lat: number | null; lng: number | null }[]).find(
          (m) =>
            normalizeName(m.name) === normalizeName(r.name) ||
            (r.kind === "식당" &&
              m.lat != null &&
              m.lng != null &&
              distanceMeters({ lat: m.lat, lng: m.lng }, { lat: r.lat, lng: r.lng }) < 60)
        )
        if (hit) r.michelin = hit.distinction ?? "가이드 등재"
      }
    }

    /* 숙소 가까운 순 */
    if (accommodation) results.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))

    const out = results.slice(0, 6)
    if(!out.length)return NextResponse.json({results:[],error:"요청하신 업종과 위치가 확인된 장소를 찾지 못했어요. 조건을 조금 바꿔 주세요."})
    CACHE.set(cacheKey, { at: Date.now(), results: out })
    if (CACHE.size > 300) {
      const oldest = [...CACHE.entries()].sort((x, y) => x[1].at - y[1].at)[0]
      if (oldest) CACHE.delete(oldest[0])
    }
    return NextResponse.json({ results: out })
  } catch (error) {
    console.error("[concierge] error:", error)
    return NextResponse.json({ results: [], error: "추천 중 오류가 났어요." }, { status: 200 })
  }
}
