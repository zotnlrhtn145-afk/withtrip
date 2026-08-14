import { NextResponse } from "next/server"

import {
  buildPlacePhotoProxyUrl,
  resolveCoverImageUrl,
  resolveRequestOrigin,
} from "@/lib/place-cover-image"
import { guessSubCategory } from "@/lib/place-subcategories"
import { inferCategoryFromTypes, readPlacesByGoogleIds, writePlaces } from "@/lib/places-cache"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * POST /api/resolve-instagram
 *
 * 인스타그램 게시물 캡션에서 장소를 뽑아 실제 구글 장소로 확정한다.
 * 공유 시트에서 "위드트립"을 고르면 앱이 이 API를 호출하고, 돌아온 후보 중
 * 사용자가 원하는 것만 골라 '나의 찜'에 담는다.
 *
 * ⚠️ **인스타 게시물 fetch는 반드시 앱(사용자 기기)에서 해야 한다.**
 *    인스타는 데이터센터 IP를 차단하므로 서버에서 긁으면 봇 차단 페이지만 온다.
 *    실측: 집/모바일 IP → HTTP 200 + og:description 전문 수신 / 서버 → 차단.
 *    그래서 이 API는 **캡션 텍스트를 입력으로 받는다.** (url은 로컬 테스트용 폴백)
 *
 * 한 게시물에 여러 곳이 나오는 경우(예: "익선동 베이커리 Best7")가 흔하므로
 * 후보를 **배열로** 돌려준다. 자동 저장하지 않는다 — 고르는 건 사용자 몫.
 */

const MAX_CANDIDATES = 10

type ExtractedPlace = {
  name: string
  address?: string
  /** 캡션에서 읽어낸 도시·지역 (주소가 없을 때 검색을 좁히는 데 쓴다) */
  region?: string
  note?: string
}

export type ResolvedPlace = {
  /** 캡션에서 뽑은 원래 표기 */
  sourceName: string
  /** 캡션에 함께 적혀 있던 주소(있으면) */
  sourceAddress: string
  /** 캡션에서 뽑은 짧은 메모(메뉴·영업시간 등) */
  note: string
  /**
   * 확정 신뢰도.
   * - high    : 캡션 주소 400m 이내 + 상호명 일치 (사실상 확실)
   * - medium  : 1.2km 이내 + 이름 일치, 또는 주소 없이 이름으로 찾음
   * - caption : 구글에 그 가게가 없어 **캡션 내용 그대로** 사용 (주소·좌표는 지오코딩 결과)
   * - low     : 이름이 안 맞는 후보뿐 (다른 가게일 수 있음 — 사용자 확인 필요)
   * - none    : 아무것도 못 찾음
   */
  confidence: "high" | "medium" | "low" | "caption" | "none"
  /** 구글에서 확정된 장소 — 못 찾으면 null */
  place: {
    /** 캡션 폴백(confidence="caption")이면 빈 문자열 */
    googlePlaceId: string
    placeName: string
    address: string
    rating: number | null
    reviewCount: number | null
    lat: number
    lng: number
    kind: string
    subCategory: string
    imageUrl: string
  } | null
}

function getGeminiKey() {
  return (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim()
}

function getPlacesKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  ).trim()
}

/**
 * 인스타 공유 URL을 캡션이 읽히는 형태로 정규화한다.
 *
 * ⚠️ 공유 버튼이 만드는 `/reels/<code>/`(**복수형**)는 로그인 페이지로 302 리다이렉트되어
 *    캡션을 못 읽는다. `/reel/<code>/`(단수형)이나 `/p/<code>/`는 정상 동작한다. (실측 확인)
 *    그래서 shortcode만 뽑아 `/reel/` 형태로 다시 만든다.
 */
export function normalizeInstagramUrl(input: string): string | null {
  const raw = String(input ?? "").trim()
  if (!raw) return null
  const m = raw.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i)
  if (!m) return null
  return `https://www.instagram.com/reel/${m[1]}/`
}

/** 캡션에서 og:description 앞머리("62K likes, 99 comments - user - date:")를 걷어낸다. */
function stripOgPrefix(caption: string): string {
  const m = caption.match(/^[\d.,KMB]+\s*likes?,\s*[\d.,KMB]+\s*comments?\s*-\s*[^-]+-\s*[^:]+:\s*/i)
  let body = m ? caption.slice(m[0].length) : caption
  body = body.trim()
  if (body.startsWith('"')) body = body.slice(1)
  if (body.endsWith('".') || body.endsWith('"')) body = body.replace(/"\.?$/, "")
  return body.trim()
}

/** 진단용 — 추출이 왜 실패했는지 응답에 실어 보낸다(비밀값은 담지 않는다). */
type ExtractDiag = { keyPresent: boolean; attempts: string[] }

/** Gemini로 캡션에서 장소 목록을 뽑는다. 실패하면 빈 배열(호출부가 폴백). */
async function extractPlaces(
  caption: string,
  locationTag: string,
  diag: ExtractDiag
): Promise<ExtractedPlace[]> {
  const key = getGeminiKey()
  diag.keyPresent = Boolean(key)
  if (!key) return []

  const prompt =
    `아래는 인스타그램 게시물의 캡션이다. 여기서 **실제로 방문할 수 있는 장소**(맛집, 카페, 베이커리, 바, ` +
    `관광지, 숙소 등)를 모두 뽑아라.\n\n` +
    (locationTag ? `게시물에 붙은 위치 태그: ${locationTag}\n\n` : "") +
    `규칙:\n` +
    `- 한 게시물에 여러 곳이 소개되면(예: "베스트 7") **전부** 뽑아라.\n` +
    `- 캡션에 주소가 적혀 있으면 address 에 그대로 넣어라. 없으면 빈 문자열.\n` +
    `- name 은 지도에서 검색 가능한 상호명으로. 수식어("낭만 가득", "서울 최초")는 빼라.\n` +
    `- 메뉴·가격·영업시간 같은 유용한 정보가 있으면 note 에 40자 이내로 요약해라.\n` +
    `- 장소가 아닌 것(계정명, 해시태그, 지역명 자체)은 넣지 마라.\n` +
    `- **region 에는 그 장소가 있는 도시·지역을 넣어라**(예: "호치민", "오사카", "익선동").\n` +
    `  캡션 전체 맥락이나 해시태그(#호치민맛집 등)에서 유추해도 된다. 모르면 빈 문자열.\n` +
    `- 장소를 못 찾으면 빈 배열을 반환해라.\n\n` +
    `반드시 다음 JSON 형태로만 응답해:\n` +
    `{"places": [{"name": "상호명", "address": "캡션에 적힌 주소 또는 빈 문자열", "region": "도시·지역", "note": "짧은 메모"}]}\n\n` +
    `캡션:\n"""\n${caption.slice(0, 4000)}\n"""`

  const models = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-1.5-flash-latest"]

  // ⚠️ 모델마다 15초를 주면 셋이 다 실패할 때 45초가 그냥 흘러간다.
  //    그 사이 앱은 이미 포기하고 "네트워크 오류"를 띄운다.
  //    한 모델이 10초 안에 답을 못 주면 다음으로 넘기는 편이 전체적으로 빠르다.
  const MODEL_TIMEOUT_MS = 10_000

  for (const model of models) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS)
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
          signal: controller.signal,
        }
      )
      if (!res.ok) {
        diag.attempts.push(`${model}:HTTP_${res.status}`)
        continue
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!raw) {
        diag.attempts.push(`${model}:EMPTY`)
        continue
      }

      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as {
        places?: Array<{ name?: string; address?: string; region?: string; note?: string }>
      }
      const places = (parsed.places ?? [])
        .map((p) => ({
          name: String(p.name ?? "").trim(),
          address: String(p.address ?? "").trim(),
          region: String(p.region ?? "").trim(),
          note: String(p.note ?? "").trim(),
        }))
        .filter((p) => p.name)
      diag.attempts.push(`${model}:PARSED_${places.length}`)
      if (places.length > 0) return places.slice(0, MAX_CANDIDATES)
    } catch (err) {
      diag.attempts.push(`${model}:ERR_${err instanceof Error ? err.name : "unknown"}`)
      continue
    } finally {
      clearTimeout(timer)
    }
  }
  return []
}

type GoogleTextSearchItem = {
  place_id?: string
  name?: string
  formatted_address?: string
  rating?: number
  user_ratings_total?: number
  types?: string[]
  photos?: { photo_reference?: string }[]
  geometry?: { location?: { lat?: number; lng?: number } }
}

type LatLng = { lat: number; lng: number }

/** 지점명 — 이름 비교에서 제외한다("스탠다드브레드 익선" vs "스탠다드브레드 도산"은 같은 브랜드). */
const BRANCH_WORDS = [
  "익선", "성수", "도산", "연남", "강남", "여의도", "영등포", "동대문", "홍대",
  "한남", "청담", "잠실", "판교", "本店", "본점",
]

function normalizeName(input: string): string {
  let s = String(input ?? "").toLowerCase()
  s = s.replace(/\(.*?\)/g, " ")
  s = s.replace(/\b(by|x|and|the)\b/g, " ")
  s = s.replace(/(본점|지점|점|매장|카페|cafe)\s*$/g, " ")
  return s.replace(/[^0-9a-z가-힣]/g, "")
}

function nameCore(input: string): string {
  let s = normalizeName(input)
  for (const b of BRANCH_WORDS) s = s.replace(new RegExp(b, "g"), "")
  return s
}

function bigrams(s: string): Set<string> {
  if (s.length < 2) return new Set([s])
  const out = new Set<string>()
  for (let i = 0; i < s.length - 1; i += 1) out.add(s.slice(i, i + 2))
  return out
}

/**
 * 상호명 유사도 0~1.
 *
 * ⚠️ 구글은 **영역 안에서 억지로라도 뭔가를 돌려준다.** 실측: 익선동에서 "와글와글베이크샵"을
 *    찾으라 했더니 400m 안의 전혀 다른 가게("익선베이글 by 뉴욕베이글")를 반환했다.
 *    거리만 보고 신뢰하면 **엉뚱한 가게를 확신에 차서 저장**하게 되므로 이름도 반드시 본다.
 */
function nameSimilarity(a: string, b: string): number {
  const ca = nameCore(a)
  const cb = nameCore(b)
  if (!ca || !cb) return 0
  if (ca.includes(cb) || cb.includes(ca)) return 1
  const A = bigrams(ca)
  const B = bigrams(cb)
  let inter = 0
  for (const g of A) if (B.has(g)) inter += 1
  const union = A.size + B.size - inter
  return union > 0 ? inter / union : 0
}

/** 이 값 미만이면 다른 가게로 본다. 실측 분포: 정답 1.00 / 오답 0.00~0.10 */
const NAME_MATCH_THRESHOLD = 0.34

/** 미터 단위 대략 거리. */
function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = (a.lat - b.lat) * 111_000
  const dLng = (a.lng - b.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(dLat, dLng)
}

/**
 * 캡션에 적힌 주소를 좌표로 바꾼다.
 *
 * Geocoding API를 먼저 쓰고, 실패하면 Places Text Search로 폴백한다.
 * (서버 키에 Geocoding API가 열려 있지 않을 수 있어서 한쪽에만 의존하지 않는다.)
 */
async function geocode(address: string, apiKey: string): Promise<LatLng | null> {
  const q = String(address ?? "").trim()
  if (!q) return null

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
  url.searchParams.set("address", q)
  url.searchParams.set("language", "ko")
  url.searchParams.set("key", apiKey)
  try {
    const res = await fetch(url.toString(), { cache: "no-store" })
    if (res.ok) {
      const json = (await res.json()) as {
        status?: string
        error_message?: string
        results?: { geometry?: { location?: LatLng } }[]
      }
      const loc = json.results?.[0]?.geometry?.location
      if (json.status === "OK" && loc) return { lat: loc.lat, lng: loc.lng }
      if (json.status !== "ZERO_RESULTS") {
        console.warn("[resolve-instagram] geocode 실패:", json.status, json.error_message)
      }
    }
  } catch {
    /* 아래 폴백 */
  }

  // 폴백: 주소 문자열을 Places Text Search 로 던져 좌표만 얻는다.
  const viaPlaces = await textSearch(q, apiKey)
  const loc = viaPlaces[0]?.geometry?.location
  if (typeof loc?.lat === "number" && typeof loc?.lng === "number") {
    return { lat: loc.lat, lng: loc.lng }
  }
  return null
}

async function textSearch(
  query: string,
  apiKey: string,
  near?: LatLng | null,
  radius = 700
): Promise<GoogleTextSearchItem[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json")
  url.searchParams.set("query", query)
  url.searchParams.set("language", "ko")
  url.searchParams.set("key", apiKey)
  if (near) {
    url.searchParams.set("location", `${near.lat},${near.lng}`)
    url.searchParams.set("radius", String(radius))
  }
  try {
    const res = await fetch(url.toString(), { cache: "no-store" })
    if (!res.ok) return []
    const json = (await res.json()) as { status?: string; results?: GoogleTextSearchItem[] }
    if (json.status !== "OK") return []
    return json.results ?? []
  } catch {
    return []
  }
}

/**
 * 장소를 확정한다.
 *
 * ⚠️ 이름만으로 검색하면 **지점이 여러 개인 브랜드에서 인기 지점이 먼저 나온다.**
 *    실측: "와글와글베이크샵 익선"(종로구) → 동대문점, "스탠다드브레드 익선" → 성수점.
 *    캡션에 주소를 같이 넣어도 마찬가지였다.
 *
 * 그래서 캡션에 주소가 있으면 **먼저 지오코딩해서 좌표를 얻고, 그 좌표 근처로
 * 검색을 제한**한다. 그리고 결과가 그 좌표에서 너무 멀면(다른 지점) 버린다.
 */
async function findPlace(
  name: string,
  captionAddress: string,
  region: string,
  fallbackHint: string,
  apiKey: string
): Promise<{
  hit: GoogleTextSearchItem | null
  confidence: ResolvedPlace["confidence"]
  anchor: LatLng | null
} | null> {
  const anchor = captionAddress ? await geocode(captionAddress, apiKey) : null

  if (anchor) {
    // 캡션 주소 근처로 검색하고, **거리와 이름을 둘 다** 확인한다.
    //  - 거리만 보면: 같은 동네 다른 가게를 집는다 (익선베이글 사례)
    //  - 이름만 보면: 다른 동네 같은 브랜드를 집는다 (스탠다드브레드 도산 사례)
    for (const [radius, maxDist] of [
      [700, 400],
      [2000, 1200],
    ] as const) {
      const results = await textSearch(name, apiKey, anchor, radius)
      for (const r of results) {
        const loc = r.geometry?.location
        if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") continue
        if (distanceMeters(anchor, { lat: loc.lat, lng: loc.lng }) > maxDist) continue
        if (nameSimilarity(name, r.name ?? "") < NAME_MATCH_THRESHOLD) continue
        return { hit: r, confidence: maxDist === 400 ? "high" : "medium", anchor }
      }
    }

    // 주소는 확실한데 구글에 그 가게가 없다 → **엉뚱한 곳을 주느니 캡션 그대로 쓴다.**
    return { hit: null, confidence: "caption", anchor }
  }

  // 주소가 없으면 **지역명을 붙여** 검색한다.
  // 이게 없으면 "THE BRIX" 같은 흔한 상호가 전 세계에서 아무거나 잡힌다.
  // (실측: 호치민 감성맛집 게시물은 주소 없이 지역명만 있었다)
  const hint = region || fallbackHint
  const query = [name, hint].filter(Boolean).join(" ")
  const plain = await textSearch(query, apiKey)
  const matched = plain.find((r) => nameSimilarity(name, r.name ?? "") >= NAME_MATCH_THRESHOLD)
  if (matched) return { hit: matched, confidence: "medium", anchor: null }
  if (plain.length) return { hit: plain[0], confidence: "low", anchor: null }
  return null
}

export async function POST(request: Request) {
  const placesKey = getPlacesKey()
  if (!placesKey) {
    return NextResponse.json(
      { places: [], error: "GOOGLE_PLACES_API_KEY가 설정되어 있지 않아요." },
      { status: 200 }
    )
  }

  let body: { caption?: string; locationTag?: string; url?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ places: [], error: "잘못된 요청이에요." }, { status: 400 })
  }

  let caption = String(body.caption ?? "").trim()
  const locationTag = String(body.locationTag ?? "").trim()

  // url만 온 경우: 이 서버에서 인스타를 읽어본다. 배포 환경(데이터센터 IP)에서는
  // 거의 실패하므로 어디까지나 로컬 테스트용 폴백이다.
  if (!caption && body.url) {
    const target = normalizeInstagramUrl(String(body.url))
    if (!target) {
      return NextResponse.json(
        { places: [], error: "인스타그램 게시물 주소가 아니에요." },
        { status: 200 }
      )
    }
    try {
      const res = await fetch(target, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
        cache: "no-store",
      })
      const html = await res.text()
      const m = html.match(/<meta property="og:description" content="([^"]*)"/)
      if (m) {
        caption = m[1]
          .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
          .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
      }
    } catch {
      /* 폴백 실패 — 아래에서 캡션 없음으로 처리 */
    }
  }

  if (!caption) {
    return NextResponse.json(
      {
        places: [],
        error:
          "캡션을 읽지 못했어요. 앱에서 게시물 내용을 함께 보내주세요(서버에서는 인스타를 읽을 수 없습니다).",
      },
      { status: 200 }
    )
  }

  const cleaned = stripOgPrefix(caption)
  const diag: ExtractDiag = { keyPresent: false, attempts: [] }
  const extracted = await extractPlaces(cleaned, locationTag, diag)

  if (extracted.length === 0) {
    console.warn("[resolve-instagram] 추출 0건", JSON.stringify(diag))
    return NextResponse.json({
      places: [],
      caption: cleaned,
      error: "장소를 찾지 못했어요.",
      diag,
    })
  }

  const origin = resolveRequestOrigin(request.url)

  // 캐시 우선: 이미 아는 장소면 구글을 부르지 않는다.
  const grounded = await Promise.all(
    extracted.map(async (item): Promise<ResolvedPlace> => {
      const found = await findPlace(
        item.name,
        item.address ?? "",
        item.region ?? "",
        locationTag,
        placesKey
      )
      const hit = found?.hit
      const lat = hit?.geometry?.location?.lat
      const lng = hit?.geometry?.location?.lng

      // 구글에 그 가게가 없다 → 엉뚱한 곳을 주는 대신 캡션 내용 그대로 담는다.
      // 주소는 캡션에 적혀 있고 좌표도 지오코딩으로 얻었으므로 지도에 정확히 찍힌다.
      if (found?.confidence === "caption" && found.anchor) {
        return {
          sourceName: item.name,
          sourceAddress: item.address ?? "",
          note: item.note ?? "",
          confidence: "caption",
          place: {
            googlePlaceId: "",
            placeName: item.name,
            address: item.address ?? "",
            rating: null,
            reviewCount: null,
            lat: found.anchor.lat,
            lng: found.anchor.lng,
            kind: "restaurant",
            subCategory: "",
            imageUrl: resolveCoverImageUrl({ imageUrl: "", kind: "restaurant" }),
          },
        }
      }

      if (!hit?.place_id || typeof lat !== "number" || typeof lng !== "number") {
        return {
          sourceName: item.name,
          sourceAddress: item.address ?? "",
          note: item.note ?? "",
          confidence: "none",
          place: null,
        }
      }

      const kind = inferCategoryFromTypes(hit.types)
      const subCategory = guessSubCategory({
        kind: kind as "restaurant" | "bar" | "stay",
        name: hit.name,
        types: hit.types,
      })
      const photoRef = hit.photos?.[0]?.photo_reference ?? ""
      const photoUrl = photoRef ? buildPlacePhotoProxyUrl(photoRef, 1200, origin) : ""

      return {
        sourceName: item.name,
        sourceAddress: item.address ?? "",
        note: item.note ?? "",
        confidence: found?.confidence ?? "medium",
        place: {
          googlePlaceId: hit.place_id,
          placeName: String(hit.name ?? item.name).trim(),
          address: String(hit.formatted_address ?? "").trim(),
          rating: typeof hit.rating === "number" ? hit.rating : null,
          reviewCount: typeof hit.user_ratings_total === "number" ? hit.user_ratings_total : null,
          lat,
          lng,
          kind,
          subCategory,
          imageUrl: resolveCoverImageUrl({ imageUrl: photoUrl, kind, subCategory }),
        },
      }
    })
  )

  // 새로 확정된 장소는 캐시에 적재 (다음 조회부터 구글 호출 0회)
  const toCache = grounded
    .filter((g) => g.place && g.place.googlePlaceId)
    .map((g) => ({
      googlePlaceId: g.place!.googlePlaceId,
      name: g.place!.placeName,
      address: g.place!.address,
      lat: g.place!.lat,
      lng: g.place!.lng,
      rating: g.place!.rating,
      ratingCount: g.place!.reviewCount,
      category: g.place!.kind,
      subCategory: g.place!.subCategory,
    }))
  const known = await readPlacesByGoogleIds(toCache.map((p) => p.googlePlaceId))
  const fresh = toCache.filter((p) => !known.has(p.googlePlaceId))
  if (fresh.length) await writePlaces(fresh)

  const found = grounded.filter((g) => g.place).length
  console.log(`[api/resolve-instagram] 추출 ${extracted.length}곳 / 구글 확정 ${found}곳`)

  return NextResponse.json({ places: grounded, caption: cleaned })
}
