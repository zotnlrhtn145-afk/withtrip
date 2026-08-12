# 위드트립 — 구글 장소 캐싱 작업 인계 노트 (이어서 진행용)

다른 세션(데스크톱)에서 하던 "구글 Places 캐싱 시스템" 작업을 폰/다른 세션에서 이어가기 위한 노트.
사용자의 상세 가이드(장소캐싱 구현 가이드)를 기준으로 진행 중이며, **안전 대원칙을 반드시 지킬 것.**

## 🚨 대원칙 (절대 준수)
1. 기존 데이터 **삭제·수정 금지.** DROP/DELETE/TRUNCATE/기존행 UPDATE 금지. **추가(새 테이블·새 컬럼·복사삽입)만.**
2. 기존 기능(저장·일정·주변스팟·로그인)이 작업 중에도 계속 정상 동작해야 함.
3. **DB를 건드리는 단계는 실행 전에 사용자에게 설명하고 확인받은 뒤** 진행.
4. 작업은 **새 브랜치(`feature/place-cache`)** 에서만. main은 사용자 확인 전까지 병합 금지.
5. **백업(0단계)이 확인되기 전엔 어떤 DB 쓰기도 하지 않는다.**

## 진행 로그
- (세션1) 읽기 전용 조사 완료, DB 변경 0건.
- (세션2, 폰 원격) 조사 내용 재검증 완료 — 아래 수치 전부 그대로임. 추가로:
  - 브랜치 `feature/place-cache` 생성 (web repo). **DB 변경은 여전히 0건.**
  - `supabase/places-cache.sql` 작성 — **작성만 하고 실행 안 함.** 백업 확인 후 실행.
  - 발견: **service_role 키가 프로젝트에 없음**(anon 키만). places 쓰기·크론 갱신에 필요 → 사용자가 Vercel/`.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 추가해야 함.
  - 발견: `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`가 존재 → 구글 키가 브라우저에 노출됨(가이드 5-3 위반). 기존 이슈이며 별도 정리 필요.
  - 발견: `/api/places/search`가 검색 1회당 **Text Search 1 + Place Details 최대 8회** 호출 → 실제 비용 주범 확인. 캐싱 효과가 가장 큰 지점.

## 조사 결과 (읽기 전용, 재검증 완료)
- DB: Supabase PostgreSQL. ref `cwcrakhjbstexcokxnis`. SQL은 Management API(`SUPABASE_ACCESS_TOKEN`, ~/.zshrc)로 — **조사는 SELECT/information_schema만 사용했음.**
- `places` 테이블 **없음**(새로 만들 대상). `spots`라는 **빈 테이블(0행)** 이 있으나 미사용/레거시로 보임 → 이름 겹치지 않게 `places`로 신규 생성.
- **google_place_id 저장 컬럼이 현재 어디에도 없음** → place_id 기반 캐싱/중복방지가 지금은 전무. 이게 새로 추가할 핵심.
- **saved_places가 이미 장소필드(place_name, address, lat, lng, rating, review_count, image_url, category, sub_category)를 저장** → 목록/지도/상세는 이미 DB에서 읽음(구글 매번 호출 아님).
  - 구글 비용 실제 주범: **검색(Autocomplete/Text Search) + 장소 선택 시 Place Details.** 목록조회는 이미 캐싱됨.
- 규모(마이그레이션 대상): saved_places **156**, trip_schedules **51**, trip_accommodations **6** (~200개, 매우 작음).

## 코드 상 구글 호출 지점 (웹 ~/withtrip)
- `app/api/places/search` (Text Search + Details), `app/api/places/details`, `app/api/suggest-attractions` — 모두 `GOOGLE_PLACES_API_KEY` 사용.
- 앱(~/withtrip-app)은 웹의 `/api/places/search`를 호출(lib/places.ts). 자체 구글 키 없음.

## ✅ 완료 (세션2)
- **0단계 백업 완료**: `~/withtrip-backups/2026-08-12-pre-place-cache` — 25개 테이블 474행 + 스키마. 읽기 전용 SELECT로 생성, 무결성 검증 통과.
- **places 테이블 생성 + place_ref_id 컬럼 추가** 완료 (`supabase/places-cache.sql` 실행).
  - 검증: 기존 컬럼 유실 0개, 행 수 변동 0건, place_ref_id는 전부 NULL.
- **검색 API 캐시 우선 전환** (`app/api/places/search/route.ts`)
  - 실측: 같은 검색 재실행 시 **캐시적중 8건 / 구글 Details 호출 0건**, 응답 내용 1차와 완전 동일.
  - 검색 1회당 구글 호출 **9회 → 1회** (Text Search만 남음).
- **상세 API** (`app/api/places/details/route.ts`): 캐시로 place_id를 찾아 Text Search 1회 절약 + 결과를 캐시에 write-through.
  - ⚠️ 상세는 **영업시간/open_now가 실시간**이라 캐시로 대체하지 않음(대체하면 "영업중"이 틀리게 뜸). 의도된 설계.
- **주 1회 평점 갱신 크론**: `app/api/cron/refresh-places/route.ts` + `vercel.json` (`0 19 * * 6` = 일 04:00 KST). 로컬 실행 결과 `updated 16 / failed 0`.
  - 수정 범위: places의 rating / rating_count / last_refreshed_at / is_closed **4개 컬럼만**. NOT_FOUND는 삭제 대신 is_closed=true.
- **`lib/supabase-admin.ts`**(service_role, 서버 전용), **`lib/places-cache.ts`**(캐시 읽기/쓰기, 절대 throw 안 함 — 캐시가 죽어도 구글 직접 호출로 진행).
- **앱은 코드 변경 불필요** — `src/lib/places.ts`가 웹 API를 호출하므로 웹 배포 시 자동 적용.
- **최종 무결성 검증**: 백업 대비 25개 테이블 중 24개 완전 동일. `device_push_tokens`의 `updated_at` 1건만 다른데 이는 폰 앱의 푸시토큰 재등록(무관). **작업으로 인한 기존 데이터 변경 0건.**
- 타입체크: 에러 32개로 main과 동일(전부 기존 에러). 신규/수정 파일 에러 0건.

## 🔐 구글 키 유출 수정 (세션2 추가 작업)

### 발견한 것
사진 URL을 `https://maps.googleapis.com/maps/api/place/photo?...&key=<서버키>` 형태로 만들어
그대로 클라이언트에 내려보내고 있었음. 결과:
- 검색 응답 **1건당 키가 박힌 URL 48개**가 브라우저로 나감
- **saved_places 156행 중 153행**의 `image_url`에 서버 키가 저장돼 있음
- 즉 브라우저용 키(`NEXT_PUBLIC_...`)뿐 아니라 **서버 키까지 이미 유출된 상태**

### 고친 것
- **`/api/places/photo?ref=&w=` 신설** — 키는 서버에만 두고 구글 이미지 주소로 302 리다이렉트.
  이미지 바이트가 우리 서버를 통과하지 않아 대역폭 부담 없음. 캐시 600초(구글 서명 만료 때문).
- `buildGooglePlacePhotoUrl`(키를 URL에 박던 함수) **삭제**. `buildPlacePhotoProxyUrl`로 전면 교체.
  search / details / suggest-attractions 전부 전환.
- 프록시 URL은 **절대 URL**로 내보냄. 이 값이 DB에 저장되고 네이티브 앱이 그대로 `<Image>`에 쓰기 때문.
- `rewriteLegacyGooglePhotoUrl` — DB에 이미 저장된 키 포함 URL을 **읽을 때만** 프록시로 변환.
  **DB는 수정하지 않음.** 검증: 레거시 153행 전부 변환 / photo_reference 동일 / Unsplash 3행은 원본 유지.
- 앱(`~/withtrip-app`, 브랜치 `feature/place-photo-proxy`): `src/lib/place-photo.ts`의
  `resolvePlacePhotoUri()`를 DB에서 읽은 image_url 렌더 지점 전부에 적용
  (saved 찜/스팟/추천 카드·지도 마커, spots, friend-places, place/detail, trips/[id]).
  ※ 앱 저장소는 git 리모트가 없어 로컬 커밋만 존재.

### 검증
- 검색 응답에 남은 `key=` 파라미터 **0개**
- 프록시 302 → 실제 JPEG 800x848 정상 수신
- 웹 타입체크 32건(main과 동일, 기존 에러) / 앱 타입체크 **0건**

### ⚠️ 배포 순서 (반드시 이 순서로)
앱의 프록시 URL은 `https://www.withtrip.co.kr/api/places/photo`를 가리킨다.
**웹이 먼저 배포되지 않으면 앱에서 사진이 깨진다.**
1. 웹 `feature/place-cache` → main 병합 (프록시 엔드포인트 배포)
2. 프로덕션에서 `/api/places/photo` 동작 확인
3. 앱 OTA (`--branch production` + `preview`) — **빌드 15 이상에만 적용됨.**
   빌드 14/1.0.0 사용자는 레거시 URL 그대로라 4번 이후 사진이 깨짐.
4. **그 다음에** Google Cloud Console에서 유출된 키 폐기 → 새 키 발급 → Vercel 환경변수 교체

## ⛔ 사용자가 직접 해야 하는 것 (내가 못 함)
1. **Vercel 환경변수에 `SUPABASE_SERVICE_ROLE_KEY` 추가** — Vercel CLI 로그인이 안 돼 있어 대신 못 넣음.
   Supabase → Settings → API → service_role 키 → Vercel 프로젝트 Settings → Environment Variables.
   **없으면 캐시가 그냥 비활성(기존 동작)** 이라 배포해도 안 깨짐. 있어야 절감 효과가 생김.
   (로컬 `.env.local`엔 이미 넣어둠)
2. **Vercel에 `CRON_SECRET` 추가**(권장) — 크론 엔드포인트 무단 호출 차단용.
3. **Google Cloud Console 일일 할당량 상한 + 예산 알림** (가이드 5-1, 5-4).
4. **유출된 구글 키 폐기·재발급** (위 "배포 순서" 4번). 지금 키는 이미 외부에 나가 있어 코드 수정만으로는 회수 불가.
5. **`NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`는 지도(Maps JavaScript API)용이라 브라우저 노출이 불가피함.**
   제거하는 게 아니라 Cloud Console에서 **HTTP 리퍼러 제한(withtrip.co.kr) + Maps JavaScript API 전용**으로 잠가야 함.
   서버용 Places 키와 **반드시 분리**할 것.
6. (선택) `NEXT_PUBLIC_SITE_URL=https://www.withtrip.co.kr` — 없어도 요청 origin으로 동작하지만,
   프리뷰 배포에서 저장한 장소가 프리뷰 도메인 URL로 DB에 남는 걸 막아준다.
   ※ 참고: 로컬 `.env.local`의 `GOOGLE_PLACES_API_KEY`는 **빈 값**이라 로컬 검색이 원래 동작 안 했음(테스트 때 임시로 public 키를 주입해 확인).

## 남은 단계
- 프리뷰 배포에서 가이드 6장 체크리스트 점검 → 이상 없으면 main 병합 여부 사용자에게 확인.
- (선택) 기존 156개 장소 backfill — **(A)안 채택**: 하지 않음. 기존 데이터는 그대로 두고 신규 검색부터 캐시.

## 이전 계획 (참고용)
0. **백업 먼저.** Supabase 대시보드 → Database → Backups(또는 pg_dump)로 전체 백업 파일 확보 확인. **확인 전엔 DB 쓰기 금지.**
1. 새 브랜치 `feature/place-cache` 생성 (web repo). Vercel이 프리뷰 배포 만들어줌.
2. `places` 테이블 신규 생성(가이드 3-1) — 순수 추가. (사용자 확인 후)
3. saved_places에 `place_ref_id BIGINT NULL REFERENCES places(id)` **컬럼 추가만**(가이드 3-2). 기존 컬럼 유지.
4. 기존 장소 → places로 **복사삽입**(원본 수정/삭제 절대 금지) + 검증 리포트(개수·좌표 일치) — 가이드 3-3.
   - ⚠️ 현재 place_id가 없으므로 초기 복사분은 google_place_id가 없음 → 이 부분 처리 방안(예: place_id 없는 기존행은 이름+좌표로만 캐시하거나, 다음 조회 시 채우기)을 사용자와 먼저 상의.
5. 기능 하나씩 전환(등록→목록→주변스팟→상세), 각 단계 후 멈추고 확인 — 가이드 4.
6. Vercel Cron 주1회 평점 갱신(가이드 4-3): places의 rating/rating_count/last_refreshed_at **3개 컬럼만** update. 다른 테이블·컬럼 금지.
7. 가이드 6장 체크리스트 점검 후 main 병합 여부를 사용자에게 질문.

## 참고 (정직하게 사용자에게 전달할 점)
- 목록 조회 비용은 이미 saved_places 캐싱으로 상당 부분 절감돼 있음. 이번 작업의 큰 실익은 (a) place_id 중복방지 (b) 평점 주1회 갱신 (c) 검색/Details 호출에 대한 상한·세션토큰 관리.
- 반드시 각 DB 단계 전에 사용자 확인. 백업 없이는 시작 금지.
