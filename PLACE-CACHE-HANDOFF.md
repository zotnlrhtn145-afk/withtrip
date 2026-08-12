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

## 다음 단계 (가이드 순서) — 아직 아무것도 실행 안 함
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
