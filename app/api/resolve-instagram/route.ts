import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";

import {
  buildPlacePhotoProxyUrl,
  resolveCoverImageUrl,
  resolveRequestOrigin,
} from "@/lib/place-cover-image";
import { guessSubCategory } from "@/lib/place-subcategories";
import {
  flashModelCandidates,
  isTransient,
  rememberModel,
  sleep,
  TEXT_PURPOSE,
} from "@/lib/gemini-models";
import {
  inferCategoryFromTypes,
  readPlacesByGoogleIds,
  writePlaces,
} from "@/lib/places-cache";

export const runtime = "nodejs";
export const maxDuration = 60;

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

const MAX_CANDIDATES = 10;

type ExtractedPlace = {
  name: string;
  /**
   * 현지 표기 상호명.
   *
   * ⚠️ 캡션은 "이치란 라멘"인데 구글은 "一蘭 道頓堀店"을 준다. 표기 체계가 아예 달라서
   *    이름 대조가 0점이 나오고, 구글이 **정확히 맞힌 곳까지 "확인 필요"로 떨어졌다**.
   *    (실측: 일본어 캡션 3곳이 전부 low)
   *    AI 가 이미 아는 정보라 호출을 더 하지 않고 같이 받아 온다.
   */
  nameLocal?: string;
  address?: string;
  /** 캡션에서 읽어낸 도시·지역 (주소가 없을 때 검색을 좁히는 데 쓴다) */
  region?: string;
  note?: string;
};

export type ResolvedPlace = {
  /** 캡션에서 뽑은 원래 표기 */
  sourceName: string;
  /** 캡션에 함께 적혀 있던 주소(있으면) */
  sourceAddress: string;
  /** 캡션에서 뽑은 짧은 메모(메뉴·영업시간 등) */
  note: string;
  /**
   * 확정 신뢰도.
   * - high    : 캡션 주소 400m 이내 + 상호명 일치 (사실상 확실)
   * - medium  : 1.2km 이내 + 이름 일치, 또는 주소 없이 이름으로 찾음
   * - caption : 구글에 그 가게가 없어 **캡션 내용 그대로** 사용 (주소·좌표는 지오코딩 결과)
   * - low     : 이름이 안 맞는 후보뿐 (다른 가게일 수 있음 — 사용자 확인 필요)
   * - none    : 아무것도 못 찾음
   */
  confidence: "high" | "medium" | "low" | "caption" | "none";
  /** 구글에서 확정된 장소 — 못 찾으면 null */
  place: {
    /** 캡션 폴백(confidence="caption")이면 빈 문자열 */
    googlePlaceId: string;
    placeName: string;
    address: string;
    rating: number | null;
    reviewCount: number | null;
    lat: number;
    lng: number;
    kind: string;
    subCategory: string;
    imageUrl: string;
    /** 대표 사진 후보(최대 4). 앱이 AI 선별을 맡길 때 쓴다 */
    photoRefs: string[];
    /**
     * 가게 전화번호.
     *
     * ⚠️ Text Search 응답에는 **전화번호가 아예 없다.** 그래서 예전엔 담아도
     *    번호가 비어 있었고, 상세를 한 번 연 곳만 채워져서 "어떤 건 긁어오고
     *    어떤 건 안 긁어온다"로 보였다(신고받음).
     *    아래에서 캐시를 먼저 보고, 없을 때만 구글에 한 번 물어 채운다.
     */
    phoneNumber: string | null;
  } | null;
};


/**
 * 확정된 장소들의 전화번호를 채운다.
 *
 * 순서: 캐시(`places`) → 없으면 구글 Place Details 한 번.
 * ⚠️ 번호를 못 구해도 그냥 둔다. 저장을 막을 만한 값이 아니다.
 */
async function fillPhoneNumbers(
  grounded: { place: { googlePlaceId: string; phoneNumber: string | null } | null }[],
): Promise<void> {
  const ids = [
    ...new Set(
      grounded
        .map((g) => g.place?.googlePlaceId ?? "")
        .filter((x) => x.length > 0),
    ),
  ];
  if (ids.length === 0) return;

  const phoneOf = new Map<string, string>();

  try {
    const cached = await readPlacesByGoogleIds(ids);
    for (const [gid, row] of cached) {
      if (row.phone) phoneOf.set(gid, row.phone);
    }
  } catch {
    /* 캐시가 죽어도 아래에서 직접 물어본다 */
  }

  const missing = ids.filter((id) => !phoneOf.has(id));
  const apiKey = (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ||
    ""
  ).trim();

  if (missing.length > 0 && apiKey) {
    await Promise.all(
      missing.map(async (id) => {
        try {
          const url = new URL(
            "https://maps.googleapis.com/maps/api/place/details/json",
          );
          url.searchParams.set("place_id", id);
          // 번호만 있으면 된다 — 필요 없는 항목을 부르면 그만큼 더 비싸다
          url.searchParams.set("fields", "formatted_phone_number");
          url.searchParams.set("language", "ko");
          url.searchParams.set("key", apiKey);
          const res = await fetch(url.toString(), { cache: "no-store" });
          if (!res.ok) return;
          const json = (await res.json()) as {
            status?: string;
            result?: { formatted_phone_number?: string };
          };
          const phone = String(json.result?.formatted_phone_number ?? "").trim();
          if (phone) phoneOf.set(id, phone);
        } catch {
          /* 이 한 곳만 번호 없이 간다 */
        }
      }),
    );
  }

  for (const g of grounded) {
    if (!g.place) continue;
    g.place.phoneNumber = phoneOf.get(g.place.googlePlaceId) ?? null;
  }
}

function getGeminiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ""
  ).trim();
}

function getPlacesKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  ).trim();
}

/**
 * 인스타 공유 URL을 캡션이 읽히는 형태로 정규화한다.
 *
 * ⚠️ 공유 버튼이 만드는 `/reels/<code>/`(**복수형**)는 로그인 페이지로 302 리다이렉트되어
 *    캡션을 못 읽는다. `/reel/<code>/`(단수형)이나 `/p/<code>/`는 정상 동작한다. (실측 확인)
 *    그래서 shortcode만 뽑아 `/reel/` 형태로 다시 만든다.
 */
export function normalizeInstagramUrl(input: string): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const m = raw.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  if (!m) return null;
  return `https://www.instagram.com/reel/${m[1]}/`;
}

/** 캡션에서 og:description 앞머리("62K likes, 99 comments - user - date:")를 걷어낸다. */
function stripOgPrefix(caption: string): string {
  const m = caption.match(
    /^[\d.,KMB]+\s*likes?,\s*[\d.,KMB]+\s*comments?\s*-\s*[^-]+-\s*[^:]+:\s*/i,
  );
  let body = m ? caption.slice(m[0].length) : caption;
  body = body.trim();
  if (body.startsWith('"')) body = body.slice(1);
  if (body.endsWith('".') || body.endsWith('"'))
    body = body.replace(/"\.?$/, "");
  return body.trim();
}

/** 진단용 — 추출이 왜 실패했는지 응답에 실어 보낸다(비밀값은 담지 않는다). */
type ExtractDiag = {
  keyPresent: boolean;
  attempts: string[];
  ms?: number;
  models?: string[];
};

/** Gemini로 캡션에서 장소 목록을 뽑는다. 실패하면 빈 배열(호출부가 폴백). */
async function extractPlaces(
  caption: string,
  locationTag: string,
  diag: ExtractDiag,
): Promise<ExtractedPlace[]> {
  const key = getGeminiKey();
  diag.keyPresent = Boolean(key);
  if (!key) return [];

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
    `- **nameLocal 에는 그 나라 현지 표기의 상호명을 넣어라**(예: "이치란"→"一蘭",\n` +
    `  "다이키스이산"→"大起水産", "포 틴"→"Phở Thìn"). 한국 장소면 name 과 같게 두면 된다.\n` +
    `  모르면 빈 문자열. 아는 곳만 채워라 — 지어내지 마라.\n` +
    `- 장소를 못 찾으면 빈 배열을 반환해라.\n\n` +
    `반드시 다음 JSON 형태로만 응답해:\n` +
    `{"places": [{"name": "상호명", "nameLocal": "현지 표기", "address": "캡션에 적힌 주소 또는 빈 문자열", "region": "도시·지역", "note": "짧은 메모"}]}\n\n` +
    `캡션:\n"""\n${caption.slice(0, 2500)}\n"""`;

  // ⚠️ 모델 이름을 박아 두지 않는다. 박아 뒀더니 폴백 둘이 전부 404 였고
  //    (gemini-2.0-flash / gemini-1.5-flash-latest — 이 계정에 없는 모델),
  //    첫 모델이 503 을 내면 그대로 "장소를 찾지 못했어요" 가 됐다.
  //    사용자가 말한 "몇몇은 못 찾는다" 의 정체가 이거였다.
  const discovered = await flashModelCandidates(key);
  const models = discovered.length ? discovered : ["gemini-flash-latest"];
  diag.models = models;

  // 모델마다 15초를 주면 셋이 다 실패할 때 45초가 그냥 흘러간다.
  // 그 사이 앱은 이미 포기한 뒤다.
  const MODEL_TIMEOUT_MS = 10_000;

  for (const model of models) {
    // thinkingConfig 를 모르는 모델이면 한 번은 빼고 다시 부른다
    let noThinking = false;
    // 과부하는 잠깐 기다렸다 같은 모델에 다시 묻는 게 낫다
    for (let tryNo = 0; tryNo < 3; tryNo += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": key,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                // ⚠️ 최신 flash 는 기본으로 "생각"을 하고 답한다. 캡션에서 상호명을
                //    긁어내는 일에는 그 시간이 순수 낭비다(실측 1.5~6.7초로 출렁였다).
                //    지원하지 않는 모델이 400 을 내면 아래에서 빼고 다시 부른다.
                ...(noThinking ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
              },
            }),
            signal: controller.signal,
          },
        );
        if (!res.ok) {
          diag.attempts.push(`${model}:HTTP_${res.status}`);
          if (res.status === 400 && !noThinking) {
            noThinking = true;
            continue;
          }
          if (isTransient(res.status) && tryNo === 0) {
            await sleep(600);
            continue;
          }
          break;
        }

        const data = (await res.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!raw) {
          diag.attempts.push(`${model}:EMPTY`);
          break;
        }

        const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as {
          places?: Array<{
            name?: string;
            nameLocal?: string;
            address?: string;
            region?: string;
            note?: string;
          }>;
        };
        const places = (parsed.places ?? [])
          .map((p) => ({
            name: String(p.name ?? "").trim(),
            nameLocal: String(p.nameLocal ?? "").trim(),
            address: String(p.address ?? "").trim(),
            region: String(p.region ?? "").trim(),
            note: String(p.note ?? "").trim(),
          }))
          .filter((p) => p.name);
        diag.attempts.push(`${model}:PARSED_${places.length}`);
        if (places.length > 0) {
          // 다음 요청은 이 모델부터 — 목록 앞의 모델이 503 을 낼 때 헛호출이 준다
          void rememberModel(TEXT_PURPOSE, model);
          return places.slice(0, MAX_CANDIDATES);
        }
        break;
      } catch (err) {
        diag.attempts.push(
          `${model}:ERR_${err instanceof Error ? err.name : "unknown"}`,
        );
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return [];
}

type GoogleTextSearchItem = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  photos?: { photo_reference?: string }[];
  geometry?: { location?: { lat?: number; lng?: number } };
};

type LatLng = { lat: number; lng: number };

/** 지점명 — 이름 비교에서 제외한다("스탠다드브레드 익선" vs "스탠다드브레드 도산"은 같은 브랜드). */
const BRANCH_WORDS = [
  "익선",
  "성수",
  "도산",
  "연남",
  "강남",
  "여의도",
  "영등포",
  "동대문",
  "홍대",
  "한남",
  "청담",
  "잠실",
  "판교",
  "本店",
  "본점",
];

function normalizeName(input: string): string {
  let s = String(input ?? "").toLowerCase();
  s = s.replace(/\(.*?\)/g, " ");
  s = s.replace(/\b(by|x|and|the)\b/g, " ");
  s = s.replace(/(본점|지점|점|매장|카페|cafe)\s*$/g, " ");
  // ⚠️ 예전엔 [^0-9a-z가-힣] 를 지웠다. 한자·히라가나·가타카나가 **통째로 날아가서**
  //    일본 장소는 이름이 빈 문자열이 되고, 대조가 항상 0점이었다.
  //    한중일 문자와 태국어를 남긴다.
  return s.replace(
    /[^0-9a-z가-힣\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\u0e00-\u0e7f]/g,
    "",
  );
}

/**
 * 음식·업종 종류를 가리키는 말. **가게를 구분해 주지 않는다.**
 *
 * ⚠️ 이걸 안 걷어내면 종류만 같아도 다른 가게가 통과한다.
 *    실측: "쿠시카츠 다루마" 를 찾다가 "쿠시카츠 이자카야 히로카츠" 를
 *    같은 집으로 보고 medium 을 줬다. 겹친 건 "쿠시카츠" 뿐이었다.
 *    구분은 "다루마" 가 한다 — 그쪽만 남겨 놓고 봐야 한다.
 */
const GENRE_WORDS = [
  "쿠시카츠",
  "야키니쿠",
  "오코노미야키",
  "회전초밥",
  "스키야키",
  "이자카야",
  "라멘",
  "우동",
  "소바",
  "스시",
  "초밥",
  "돈카츠",
  "규카츠",
  "샤브샤브",
  "베이커리",
  "브런치",
  "다이닝",
  "레스토랑",
  "비스트로",
  "루프탑",
  "串カツ",
  "焼肉",
  "お好み焼き",
  "回転寿司",
  "すき焼き",
  "居酒屋",
  "ラーメン",
  "うどん",
  "そば",
  "寿司",
  "とんかつ",
  "restaurant",
  "bakery",
  "coffee",
  "roasters",
  "bistro",
  "dining",
];

function nameCore(input: string): string {
  let s = normalizeName(input);
  for (const b of BRANCH_WORDS) s = s.replace(new RegExp(b, "g"), "");
  // 종류 단어를 걷어낸 결과가 통째로 비면(가게 이름이 종류 그 자체인 경우)
  // 원래 이름을 그대로 쓴다 — 비교할 게 없어지면 안 된다.
  let stripped = s;
  for (const g of GENRE_WORDS)
    stripped = stripped.replace(new RegExp(g, "g"), "");
  return stripped.length >= 2 ? stripped : s;
}

function bigrams(s: string): Set<string> {
  if (s.length < 2) return new Set([s]);
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i += 1) out.add(s.slice(i, i + 2));
  return out;
}

/**
 * 상호명 유사도 0~1.
 *
 * ⚠️ 구글은 **영역 안에서 억지로라도 뭔가를 돌려준다.** 실측: 익선동에서 "와글와글베이크샵"을
 *    찾으라 했더니 400m 안의 전혀 다른 가게("익선베이글 by 뉴욕베이글")를 반환했다.
 *    거리만 보고 신뢰하면 **엉뚱한 가게를 확신에 차서 저장**하게 되므로 이름도 반드시 본다.
 */
/**
 * 두 이름 끝에 똑같이 붙은 지점 표기를 떼어낸다.
 *
 * ⚠️ "쿠시카츠 다루마 **고베산노미야**점" 과 "쿠시카츠 이자카야 히로카츠 **고베산노미야**점" 은
 *    가게가 전혀 다른데 지점 이름이 같아서 유사도가 0.42 까지 올라갔다(문턱 0.34).
 *    지점 표기는 가게를 구분해 주지 않는다 — 떼고 나면 "다루마" vs "히로카츠", 0점이다.
 *
 * 한쪽이 다른 쪽에 통째로 들어가는 경우("이치란도톤보리점" ⊂ "이치란도톤보리점별관")는
 * 이 함수에 오기 전에 이미 1.00 으로 걸러지므로 여기서 잘라도 안전하다.
 */
function dropSharedTail(a: string, b: string): [string, string] {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n += 1;
  // 너무 짧은 꼬리(우연한 한두 글자)나, 떼면 남는 게 없어지는 경우는 건드리지 않는다
  if (n < 3 || a.length - n < 2 || b.length - n < 2) return [a, b];
  return [a.slice(0, a.length - n), b.slice(0, b.length - n)];
}

function nameSimilarity(a: string, b: string): number {
  const ca0 = nameCore(a);
  const cb0 = nameCore(b);
  if (!ca0 || !cb0) return 0;
  if (ca0.includes(cb0) || cb0.includes(ca0)) return 1;
  const [ca, cb] = dropSharedTail(ca0, cb0);
  const A = bigrams(ca);
  const B = bigrams(cb);
  let inter = 0;
  for (const g of A) if (B.has(g)) inter += 1;
  const union = A.size + B.size - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * 캡션 표기와 현지 표기 중 **더 잘 맞는 쪽**으로 본다.
 * "이치란 라멘" vs "一蘭 道頓堀店" 은 0점이지만, 현지 표기 "一蘭" 과는 1.00 이다.
 */
/**
 * **엄격한** 이름 비교.
 *
 * ⚠️ 보통 비교는 "한쪽이 다른 쪽에 들어 있으면 1점"이다. 그런데 짧은 이름에서는
 *    이게 위험하다 — "YASAKA" 는 "Yasaka Shrine"(야사카 신사) 안에 들어 있어서
 *    **레스토랑을 찾다가 신사를 집었다**(실제로 그랬다).
 *    캡션 주소가 빗나가 다시 찾는 상황에서는 이 지름길을 끄고 글자 겹침만 본다.
 */
function strictNameSimilarity(candidates: string[], target: string): number {
  let best = 0;
  for (const c of candidates) {
    if (!c) continue;
    const ca = nameCore(c);
    const cb = nameCore(target);
    if (!ca || !cb) continue;
    const [x, y] = dropSharedTail(ca, cb);
    const A = bigrams(x);
    const B = bigrams(y);
    let inter = 0;
    for (const g of A) if (B.has(g)) inter += 1;
    const union = A.size + B.size - inter;
    const v = union > 0 ? inter / union : 0;
    if (v > best) best = v;
  }
  return best;
}

/** 다시 찾을 때 요구하는 값. 통상(0.34)보다 훨씬 높다 — 애매하면 안 담는 게 낫다 */
const STRICT_MATCH_THRESHOLD = 0.62;

function bestNameSimilarity(candidates: string[], target: string): number {
  let best = 0;
  for (const c of candidates) {
    if (!c) continue;
    const v = nameSimilarity(c, target);
    if (v > best) best = v;
  }
  return best;
}

/** 이 값 미만이면 다른 가게로 본다. 실측 분포: 정답 1.00 / 오답 0.00~0.10 */
const NAME_MATCH_THRESHOLD = 0.34;

/** 미터 단위 대략 거리. */
function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = (a.lat - b.lat) * 111_000;
  const dLng = (a.lng - b.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/**
 * 캡션에 적힌 주소를 좌표로 바꾼다.
 *
 * Geocoding API를 먼저 쓰고, 실패하면 Places Text Search로 폴백한다.
 * (서버 키에 Geocoding API가 열려 있지 않을 수 있어서 한쪽에만 의존하지 않는다.)
 */
async function geocode(
  address: string,
  apiKey: string,
): Promise<LatLng | null> {
  const q = String(address ?? "").trim();
  if (!q) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", q);
  url.searchParams.set("language", "ko");
  url.searchParams.set("key", apiKey);
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as {
        status?: string;
        error_message?: string;
        results?: { geometry?: { location?: LatLng } }[];
      };
      const loc = json.results?.[0]?.geometry?.location;
      if (json.status === "OK" && loc) return { lat: loc.lat, lng: loc.lng };
      if (json.status !== "ZERO_RESULTS") {
        console.warn(
          "[resolve-instagram] geocode 실패:",
          json.status,
          json.error_message,
        );
      }
    }
  } catch {
    /* 아래 폴백 */
  }

  // 폴백: 주소 문자열을 Places Text Search 로 던져 좌표만 얻는다.
  const viaPlaces = await textSearch(q, apiKey);
  const loc = viaPlaces[0]?.geometry?.location;
  if (typeof loc?.lat === "number" && typeof loc?.lng === "number") {
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
}

async function textSearch(
  query: string,
  apiKey: string,
  near?: LatLng | null,
  radius = 700,
): Promise<GoogleTextSearchItem[]> {
  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
  );
  url.searchParams.set("query", query);
  url.searchParams.set("language", "ko");
  url.searchParams.set("key", apiKey);
  if (near) {
    url.searchParams.set("location", `${near.lat},${near.lng}`);
    url.searchParams.set("radius", String(radius));
  }
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      status?: string;
      results?: GoogleTextSearchItem[];
    };
    if (json.status !== "OK") return [];
    return json.results ?? [];
  } catch {
    return [];
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
  nameLocal: string,
  captionAddress: string,
  region: string,
  fallbackHint: string,
  apiKey: string,
): Promise<{
  hit: GoogleTextSearchItem | null;
  confidence: ResolvedPlace["confidence"];
  anchor: LatLng | null;
} | null> {
  // 캡션 표기와 현지 표기를 둘 다 들고 대조한다
  const spellings = [name, nameLocal].filter(Boolean);
  /** 주소로 좌표를 얻었지만 그 근처에서 못 찾은 경우 — 마지막에 캡션으로 돌아갈 때 쓴다 */
  let captionAnchor: LatLng | null = null;
  const anchor = captionAddress ? await geocode(captionAddress, apiKey) : null;

  if (anchor) {
    // 캡션 주소 근처로 검색하고, **거리와 이름을 둘 다** 확인한다.
    //  - 거리만 보면: 같은 동네 다른 가게를 집는다 (익선베이글 사례)
    //  - 이름만 보면: 다른 동네 같은 브랜드를 집는다 (스탠다드브레드 도산 사례)
    //
    // ⚠️ 두 반경을 차례로 부르면 왕복이 두 번 쌓인다. 서로 독립이라 동시에 부르고
    //    좁은 쪽을 먼저 본다 (좁은 쪽이 맞으면 그게 더 확실한 답이다).
    const [near, wide] = await Promise.all([
      textSearch(name, apiKey, anchor, 700),
      textSearch(name, apiKey, anchor, 2000),
    ]);

    for (const [results, maxDist] of [
      [near, 400],
      [wide, 1200],
    ] as const) {
      for (const r of results) {
        const loc = r.geometry?.location;
        if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number")
          continue;
        if (distanceMeters(anchor, { lat: loc.lat, lng: loc.lng }) > maxDist)
          continue;
        if (bestNameSimilarity(spellings, r.name ?? "") < NAME_MATCH_THRESHOLD)
          continue;
        return {
          hit: r,
          confidence: maxDist === 400 ? "high" : "medium",
          anchor,
        };
      }
    }

    /*
      여기까지 왔다는 건 주소 근처에서 못 찾았다는 뜻이다.
      ⚠️ 예전엔 **여기서 바로 포기**하고 캡션 내용만 담았다. 그런데 캡션의
         "주소"가 실제 주소가 아니라 "파크 하얏트 호텔 안" 같은 **설명**인 경우가
         흔하다. 그걸 좌표로 바꾸면 엉뚱한 데를 가리키고, 그 근처에 없으니
         평점·사진·전화번호가 전부 빈 채로 담겼다(신고받음 — YASAKA 사례).

         그래서 포기하지 않고 **아래 지역 검색까지 가 본다.** 거기서도 못 찾으면
         그때 캡션으로 돌아온다.
    */
    captionAnchor = anchor;
  }

  // 주소가 없거나, 주소 근처에서 못 찾았으면 **지역명을 붙여** 검색한다.
  // 이게 없으면 "THE BRIX" 같은 흔한 상호가 전 세계에서 아무거나 잡힌다.
  // (실측: 호치민 감성맛집 게시물은 주소 없이 지역명만 있었다)
  //
  // 현지 표기를 알면 그걸로도 같이 찾는다. 캡션의 한글 음차보다 현지 표기가
  // 구글에서 훨씬 잘 잡힌다("다이키스이산" 보다 "大起水産").
  const hint = region || fallbackHint;
  const queries = Array.from(
    new Set(spellings.map((sp) => [sp, hint].filter(Boolean).join(" "))),
  );
  const resultSets = await Promise.all(
    queries.map((q) => textSearch(q, apiKey)),
  );

  for (const results of resultSets) {
    const matched = results.find((r) =>
      captionAnchor
        // 주소가 빗나가 다시 찾는 중 — 애매한 건 담지 않는다
        ? strictNameSimilarity(spellings, r.name ?? "") >= STRICT_MATCH_THRESHOLD
        : bestNameSimilarity(spellings, r.name ?? "") >= NAME_MATCH_THRESHOLD,
    );
    if (matched) return { hit: matched, confidence: "medium", anchor: null };
  }

  // 지역명을 붙인 질의가 통째로 비면(지역명이 틀렸을 때 생긴다) 이름만으로 한 번 더.
  // 예전엔 여기서 바로 포기해서 "못 찾음"이 됐다.
  const anyResults = resultSets.some((r) => r.length > 0);
  if (!anyResults && hint) {
    const bare = await textSearch(name, apiKey);
    const matched = bare.find(
      (r) =>
        bestNameSimilarity(spellings, r.name ?? "") >= NAME_MATCH_THRESHOLD,
    );
    if (matched) return { hit: matched, confidence: "medium", anchor: null };
    if (bare.length) return { hit: bare[0], confidence: "low", anchor: null };
  }

  /*
    ⚠️ "아무거나 첫 번째"는 **캡션 주소가 없었을 때만** 쓴다.
       주소가 있었는데 빗나간 상황에서 이걸 쓰면, 엉뚱한 가게를 확신에 차서
       담게 된다. 그럴 바엔 캡션 내용만 담는 게 낫다.
  */
  if (!captionAnchor) {
    const first = resultSets.find((r) => r.length > 0);
    if (first) return { hit: first[0], confidence: "low", anchor: null };
  }

  /*
    끝까지 못 찾았다. 캡션에 주소 비슷한 게 있었다면 그 좌표라도 들고
    캡션 내용 그대로 담는다 — 지도에는 대략 찍히고, 이름·메모는 남는다.
  */
  if (captionAnchor) return { hit: null, confidence: "caption", anchor: captionAnchor };
  return null;
}

/**
 * 예열용.
 *
 * 앱이 인스타 게시물을 읽는 1~2초 동안 이걸 먼저 때려서 서버를 깨워 둔다.
 * 405 를 돌려주는 것만으로는 이 파일이 확실히 로드된다는 보장이 없어서
 * 가벼운 GET 을 따로 둔다. (POST 와 같은 모듈이라 같이 준비된다)
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}

/**
 * **캐러셀 카드 이미지들에서** 장소를 뽑는다.
 *
 * ⚠️ 피드 게시물(`/p/`)은 슬라이드마다 가게 하나씩 소개하고, 이름을 이미지 위에
 *    글씨로 얹는 형식이 흔하다. 캡션에는 "호치민 카페 7곳" 정도만 적힌다.
 *    (실측: TEA'SPACE / KAI KAI / MAKE ROOM 이 전부 이미지 위 글씨였다)
 *
 * 슬라이드가 영상이어도 **커버 이미지만** 읽는다 — 영상 8개를 받으면 20MB 가 넘고
 * 느린데, 이름은 어차피 커버에 박혀 있다.
 */
async function extractPlacesFromImages(
  imageUrls: string[],
  locationTag: string,
  diag: ExtractDiag,
): Promise<ExtractedPlace[]> {
  const key = getGeminiKey();
  if (!key || imageUrls.length === 0) return [];

  const parts: Array<Record<string, unknown>> = [];
  for (const url of imageUrls.slice(0, 10)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 3 * 1024 * 1024) continue;
      parts.push({
        inline_data: {
          mime_type: res.headers.get("content-type")?.split(";")[0] || "image/jpeg",
          data: Buffer.from(buf).toString("base64"),
        },
      });
    } catch {
      /* 한 장 실패는 넘어간다 */
    }
  }
  if (parts.length === 0) {
    diag.attempts.push("images:NONE");
    return [];
  }

  parts.push({
    text:
      `이 이미지들은 인스타그램 게시물의 카드들이다. 카드마다 장소를 하나씩 소개한다.\n\n` +
      (locationTag ? `게시물 위치 태그: ${locationTag}\n\n` : "") +
      `규칙:\n` +
      `- 이미지 위에 **글씨로 얹힌 가게·장소 이름**만 뽑아라.\n` +
      `- 간판이나 메뉴판에 우연히 보이는 글자는 제외. 표지 카드(제목만 있는 것)도 제외.\n` +
      `- 같은 곳이 여러 장에 나오면 한 번만.\n` +
      `- name 은 지도에서 검색 가능한 형태로. 현지 표기가 보이면 nameLocal 에.\n` +
      `- region 에는 그 장소들이 있는 도시를 넣어라.\n` +
      `- 이름이 없으면 빈 배열.\n\n` +
      `{"places": [{"name": "상호명", "nameLocal": "현지 표기", "address": "", "region": "도시", "note": ""}]}`,
  });

  const models = await flashModelCandidates(key);
  for (const model of [models[0] ?? "gemini-flash-latest"]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: "application/json",
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        diag.attempts.push(`images:${model}:HTTP_${res.status}`);
        continue;
      }
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) continue;
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as {
        places?: Array<Record<string, string>>;
      };
      const places = (parsed.places ?? [])
        .map((x) => ({
          name: String(x.name ?? "").trim(),
          nameLocal: String(x.nameLocal ?? "").trim(),
          address: String(x.address ?? "").trim(),
          region: String(x.region ?? "").trim(),
          note: String(x.note ?? "").trim(),
        }))
        .filter((x) => x.name);
      diag.attempts.push(`images:${model}:PARSED_${places.length}`);
      if (places.length > 0) return places.slice(0, MAX_CANDIDATES);
    } catch (err) {
      diag.attempts.push(`images:ERR_${err instanceof Error ? err.name : "unknown"}`);
    } finally {
      clearTimeout(timer);
    }
  }
  return [];
}

/** 영상은 통째로 메모리에 올린다 — 릴스는 보통 2~5MB 다. 그 위는 받지 않는다. */
const MAX_VIDEO_BYTES = 18 * 1024 * 1024;

/**
 * **영상 자막에서** 장소를 뽑는다.
 *
 * ⚠️ 여행·맛집 릴스는 가게 이름을 캡션이 아니라 **영상 자막에만** 넣는 경우가 많다.
 *    (실측: 싱가포르 호커 가이드 릴스 — 캡션엔 이름이 하나도 없고 화면에만 있었다)
 *    그런 게시물은 캡션 분석만으로는 영원히 0건이다.
 *
 * 영상 주소는 인스타 임베드의 contextJSON 에서 얻는다. 단, 라이선스 음원을 쓴
 * 릴스는 `copyright_blocked: true` 라 주소가 아예 없다 — 그건 앱에서 걸러 보낸다.
 */
async function extractPlacesFromVideo(
  videoUrl: string,
  locationTag: string,
  diag: ExtractDiag,
): Promise<ExtractedPlace[]> {
  const key = getGeminiKey();
  if (!key) return [];

  let bytes: ArrayBuffer;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(videoUrl, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) {
      diag.attempts.push(`video:HTTP_${res.status}`);
      return [];
    }
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_VIDEO_BYTES) {
      diag.attempts.push(`video:TOO_BIG_${len}`);
      return [];
    }
    bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_VIDEO_BYTES) {
      diag.attempts.push(`video:TOO_BIG_${bytes.byteLength}`);
      return [];
    }
  } catch (err) {
    diag.attempts.push(`video:FETCH_${err instanceof Error ? err.name : "unknown"}`);
    return [];
  }

  const b64 = Buffer.from(bytes).toString("base64");
  const prompt =
    `이 영상은 인스타그램 릴스다. 화면에 **자막으로 뜨는 가게·장소 이름**을 전부 읽어라.\n\n` +
    (locationTag ? `게시물 위치 태그: ${locationTag}\n\n` : "") +
    `규칙:\n` +
    `- 화면에 글씨로 나타나는 상호명만 뽑아라. 간판·메뉴판에 우연히 보이는 건 제외.\n` +
    `- 같은 곳이 여러 번 나오면 한 번만.\n` +
    `- name 은 지도에서 검색 가능한 형태로. 현지 표기가 함께 보이면 nameLocal 에 넣어라.\n` +
    `- region 에는 그 장소들이 있는 도시·지역을 넣어라(영상 맥락에서 유추해도 된다).\n` +
    `- 짧은 설명이 함께 뜨면 note 에 40자 이내로.\n` +
    `- 자막에 이름이 없으면 빈 배열.\n\n` +
    `{"places": [{"name": "상호명", "nameLocal": "현지 표기", "address": "", "region": "도시", "note": "메모"}]}`;

  // ⚠️ 영상은 올리고 훑는 데만 30초 안팎이 걸린다. 모델을 여러 개 돌리면
  //    첫 모델이 끝나기도 전에 전체 예산을 다 쓴다. **하나에 몰아준다.**
  const models = await flashModelCandidates(key);
  for (const model of [models[0] ?? "gemini-flash-latest"]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 38_000);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: "video/mp4", data: b64 } },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: { responseMimeType: "application/json" },
          }),
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        diag.attempts.push(`video:${model}:HTTP_${res.status}`);
        continue;
      }
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) {
        diag.attempts.push(`video:${model}:EMPTY`);
        continue;
      }
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as {
        places?: Array<{
          name?: string;
          nameLocal?: string;
          address?: string;
          region?: string;
          note?: string;
        }>;
      };
      const places = (parsed.places ?? [])
        .map((x) => ({
          name: String(x.name ?? "").trim(),
          nameLocal: String(x.nameLocal ?? "").trim(),
          address: String(x.address ?? "").trim(),
          region: String(x.region ?? "").trim(),
          note: String(x.note ?? "").trim(),
        }))
        .filter((x) => x.name);
      diag.attempts.push(`video:${model}:PARSED_${places.length}`);
      if (places.length > 0) return places.slice(0, MAX_CANDIDATES);
    } catch (err) {
      diag.attempts.push(`video:${model}:ERR_${err instanceof Error ? err.name : "unknown"}`);
    } finally {
      clearTimeout(timer);
    }
  }
  return [];
}

export async function POST(request: Request) {
  // 인증이 없는 라우트다 — 반복 호출로 AI 비용이 새지 않게 막는다
  const limited = await checkRateLimit(request, "cheap", "resolve-instagram");
  if (limited) return limited;

  const tStart = Date.now();
  const placesKey = getPlacesKey();
  if (!placesKey) {
    return NextResponse.json(
      { places: [], error: "GOOGLE_PLACES_API_KEY가 설정되어 있지 않아요." },
      { status: 200 },
    );
  }

  let body: {
    caption?: string;
    locationTag?: string;
    url?: string;
    /** 임베드에서 얻은 릴스 영상 주소 — 캡션에 이름이 없을 때만 쓴다 */
    videoUrl?: string;
    /** 캐러셀 카드 커버 이미지들 — 피드 게시물(/p/)에서 쓴다 */
    imageUrls?: string[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { places: [], error: "잘못된 요청이에요." },
      { status: 400 },
    );
  }

  let caption = String(body.caption ?? "").trim();
  const locationTag = String(body.locationTag ?? "").trim();

  // url만 온 경우: 이 서버에서 인스타를 읽어본다. 배포 환경(데이터센터 IP)에서는
  // 거의 실패하므로 어디까지나 로컬 테스트용 폴백이다.
  /** 게시물 표지 사진 — 영상이 잠겨 있을 때 이것이라도 읽는다 */
  let pageImage = "";

  if (!caption && body.url) {
    const target = normalizeInstagramUrl(String(body.url));
    if (!target) {
      return NextResponse.json(
        { places: [], error: "인스타그램 게시물 주소가 아니에요." },
        { status: 200 },
      );
    }
    try {
      const res = await fetch(target, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
        cache: "no-store",
      });
      const html = await res.text();
      /*
        ⚠️ **표지 사진을 여기서 같이 챙긴다.**

        저작권 음원이 깔린 릴스는 인스타가 `video_url` 을 아예 안 준다(실측).
        표지라도 읽자는 처리는 **앱에만** 들어가 있어서, 앱이 안 보내 주면
        서버는 빈손이었다 — "영상을 잠가둬서 읽을 수 없어요" 가 그것이다.
        (실측 7건 중 3건이 이 오류, 나머지는 시간 초과)

        서버가 이미 이 페이지를 읽고 있으니 `og:image` 를 같이 가져오면
        **앱 버전과 상관없이 모든 사용자에게** 같은 처리가 걸린다.
      */
      const img = html.match(/<meta property="og:image" content="([^"]+)"/);
      if (img?.[1]) {
        pageImage = img[1]
          .replace(/&amp;/g, "&")
          .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
      }
      const m = html.match(/<meta property="og:description" content="([^"]*)"/);
      if (m) {
        caption = m[1]
          .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
            String.fromCodePoint(parseInt(h, 16)),
          )
          .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">");
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
      { status: 200 },
    );
  }

  const cleaned = stripOgPrefix(caption);
  const diag: ExtractDiag = { keyPresent: false, attempts: [] };
  const tExtract = Date.now();
  let extracted = await extractPlaces(cleaned, locationTag, diag);

  // 캡션에 이름이 없으면 영상 자막·카드 이미지를 읽는다
  const videoUrl = String(body.videoUrl ?? "").trim();
  const imageUrls = [
    ...(Array.isArray(body.imageUrls) ? body.imageUrls : []),
    // ⚠️ 앱이 못 보냈어도 서버가 찾아 둔 표지를 쓴다 — 이게 있어야 모두에게 걸린다
    pageImage,
  ]
    .map((u) => String(u ?? "").trim())
    .filter((u) => u.startsWith("https://"))
    .filter((u, i, a) => a.indexOf(u) === i);
  let source: "caption" | "video" | "images" = "caption";

  if (extracted.length === 0 && videoUrl.startsWith("https://")) {
    const viaVideo = await extractPlacesFromVideo(videoUrl, locationTag, diag);
    if (viaVideo.length > 0) {
      extracted = viaVideo;
      source = "video";
    }
  }
  // 캐러셀은 카드 커버만 읽는다 (영상 8개를 받는 것보다 훨씬 빠르고 가볍다)
  if (extracted.length === 0 && imageUrls.length > 0) {
    const viaImages = await extractPlacesFromImages(imageUrls, locationTag, diag);
    if (viaImages.length > 0) {
      extracted = viaImages;
      source = "images";
    }
  }
  diag.ms = Date.now() - tExtract;

  if (extracted.length === 0) {
    console.warn("[resolve-instagram] 추출 0건", JSON.stringify(diag));
    /**
     * 왜 못 찾았는지 **정확히** 알려준다.
     *
     * ⚠️ 예전엔 "장소를 찾지 못했어요" 한 줄이라, 사용자는 앱이 고장난 줄 알았다.
     *    한때 지역 기반 추천을 대신 보여주기도 했는데 — 영상에 나온 가게가 아니라서
     *    오히려 잘못 담기게 만들었다. 지금은 **이유만 정직하게** 말한다.
     */
    const hadMedia = videoUrl.startsWith("https://") || imageUrls.length > 0;
    return NextResponse.json({
      places: [],
      caption: cleaned,
      reason: hadMedia ? "no_names" : "no_media",
      error: hadMedia
        ? "이 게시물에서 가게 이름을 찾지 못했어요."
        : "이 게시물은 인스타그램이 영상을 잠가둬서 읽을 수 없어요.",
      diag,
    });
  }

  const origin = resolveRequestOrigin(request.url);
  const tGround = Date.now();

  // 캐시 우선: 이미 아는 장소면 구글을 부르지 않는다.
  const grounded = await Promise.all(
    extracted.map(async (item): Promise<ResolvedPlace> => {
      const found = await findPlace(
        item.name,
        item.nameLocal ?? "",
        item.address ?? "",
        item.region ?? "",
        locationTag,
        placesKey,
      );
      const hit = found?.hit;
      const lat = hit?.geometry?.location?.lat;
      const lng = hit?.geometry?.location?.lng;

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
            // 캡션만 보고 담은 곳은 구글에 없으니 번호도 없다
            phoneNumber: null,
            lat: found.anchor.lat,
            lng: found.anchor.lng,
            kind: "restaurant",
            subCategory: "",
            imageUrl: resolveCoverImageUrl({
              imageUrl: "",
              kind: "restaurant",
            }),
            // 구글에 없는 곳이라 후보 사진도 없다
            photoRefs: [],
          },
        };
      }

      if (
        !hit?.place_id ||
        typeof lat !== "number" ||
        typeof lng !== "number"
      ) {
        return {
          sourceName: item.name,
          sourceAddress: item.address ?? "",
          note: item.note ?? "",
          confidence: "none",
          place: null,
        };
      }

      const kind = inferCategoryFromTypes(hit.types);
      const subCategory = guessSubCategory({
        kind: kind as "restaurant" | "bar" | "stay" | "attraction",
        name: hit.name,
        types: hit.types,
      });
      /**
       * ⚠️ 예전엔 `photos[0]` 을 그냥 썼다. **구글의 사진 순서는 제멋대로다** —
       *    36층 중식당인데 1층 오피스 빌딩 입구 사진이 대표로 걸리는 식이었다.
       *
       *    후보는 텍스트검색 응답에 이미 들어 있다(공짜다). 버리지 말고 다 넘겨서
       *    AI 가 "가게 안/음식" 사진을 고르게 한다. 고르는 건 뒤에서 하고,
       *    여기서는 우선 첫 장으로 보여준다 — 기다리게 하면 안 된다.
       */
      const photoRefs = (hit.photos ?? [])
        .map((p) => p.photo_reference ?? "")
        .filter(Boolean)
        .slice(0, 4);
      const photoRef = photoRefs[0] ?? "";
      const photoUrl = photoRef
        ? buildPlacePhotoProxyUrl(photoRef, 1200, origin)
        : "";

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
          reviewCount:
            typeof hit.user_ratings_total === "number"
              ? hit.user_ratings_total
              : null,
          lat,
          lng,
          kind,
          subCategory,
          imageUrl: resolveCoverImageUrl({
            imageUrl: photoUrl,
            kind,
            subCategory,
          }),
          /** 대표 사진 후보 — 앱이 이걸로 /api/places/cover 에 선별을 맡긴다 */
          photoRefs,
          phoneNumber: null as string | null,
        },
      };
    }),
  );

  /*
    전화번호 채우기.

    ⚠️ 캐시(`places`)에 있으면 공짜다. 없는 것만 구글에 물어본다 —
       Place Details 는 1000회당 $17 라, 담을 때마다 전부 부르면 돈이 샌다.
    ⚠️ 실패해도 그냥 비워 둔다. 번호 하나 때문에 저장 자체가 막히면 안 된다.
  */
  await fillPhoneNumbers(grounded);

  const groundMs = Date.now() - tGround;

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
      // 방금 구한 번호를 캐시에 남긴다 — 다음 사람은 구글을 안 불러도 된다
      phone: g.place!.phoneNumber,
      /**
       * ⚠️ 예전엔 이걸 안 넣어서 캐시에 사진 후보가 **비어 있었다**(194곳).
       *    텍스트검색 응답에 이미 들어 있는 걸 그냥 버린 셈이라,
       *    나중에 대표 사진을 다시 고르려면 구글에 또 물어야 했다(돈).
       */
      photoReferences: g.place!.photoRefs,
    }));
  const known = await readPlacesByGoogleIds(
    toCache.map((p) => p.googlePlaceId),
  );
  const fresh = toCache.filter((p) => !known.has(p.googlePlaceId));
  if (fresh.length) await writePlaces(fresh);

  const found = grounded.filter((g) => g.place).length;
  console.log(
    `[api/resolve-instagram] 추출 ${extracted.length}곳 / 구글 확정 ${found}곳`,
  );

  return NextResponse.json({
    places: grounded,
    caption: cleaned,
    /** 영상 자막에서 읽어낸 결과인지 — 앱이 사용자에게 알려준다 */
    source,
    // 어디서 시간이 새는지 재려고 남긴다 (비밀값 없음)
    timing: {
      totalMs: Date.now() - tStart,
      extractMs: diag.ms ?? 0,
      groundMs,
      places: extracted.length,
    },
  });
}
