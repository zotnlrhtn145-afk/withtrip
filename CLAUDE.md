# 위드트립 (웹)

Next.js(App Router) + Tailwind + Supabase. 배포는 `git push origin main` → Vercel 자동 배포.

## 먼저 읽을 것
진행 중이거나 최근 끝난 작업의 맥락은 **[PLACE-CACHE-HANDOFF.md](PLACE-CACHE-HANDOFF.md)** 에 있습니다.
구글 장소 캐싱, 사진 프록시(API 키 유출 수정), 배포 순서, 아직 남은 일이 전부 정리돼 있으니
관련 코드를 건드리기 전에 반드시 읽으세요.

## 기본 규칙
- **모든 변경은 웹·앱 둘 다 반영.** 기능은 동일하게, 디자인만 플랫폼에 맞게.
  앱 저장소는 `~/withtrip-app` (Expo SDK 57). 한쪽만 고치면 안 됩니다.
  - **예외: 대화(채팅)는 앱 전용.** 웹엔 대화 화면이 없습니다(라우트도 코드도 없음).
    새로 만들지 마세요. 방향은 **"웹은 읽기, 앱은 쓰기"** 입니다.
  - 이 규칙의 목적은 **양쪽에 있는 기능이 조용히 어긋나는 걸 막는 것**입니다.
- **항상 한국어 존댓말**로 응답.
- **비밀값(.p8 키, 토큰, 비밀번호, service_role 키) 절대 출력 금지.**

## DB (Supabase)
- project ref: `cwcrakhjbstexcokxnis`
- SQL은 Management API로 실행 (`SUPABASE_ACCESS_TOKEN`은 `~/.zshrc`에 있음, 출력 금지).
- 스키마 변경 기록은 `supabase/*.sql`.
- **파괴적 작업 금지**: DROP / DELETE / TRUNCATE / 기존 행 UPDATE 를 하기 전에 반드시 사용자 확인.
  DB 백업: `~/withtrip-backups/` (읽기 전용 SELECT로 뜬 전체 테이블 JSON).

## 웹·앱 공통 파일 (`shared/`)
도시 이미지·세부 카테고리·여행지 목록은 웹과 앱이 **똑같은 값**을 씁니다.
예전엔 양쪽에 복사본으로 있어서(약 970줄) 한쪽만 고치면 조용히 어긋났습니다.

- **`shared/` 가 원본입니다.** 여기를 고치세요.
- `lib/getCityImage.ts`, `lib/travel-destinations.ts`, `lib/place-subcategories.ts` 는
  **재수출만** 합니다 — 불러 쓰는 쪽 코드는 그대로 두면 됩니다.
- `shared/` 를 고쳤으면 앱에도 반영해야 합니다:
  `cd ~/withtrip-app && npm run sync:shared` (확인만 하려면 `check:shared`).
- **새로 공통으로 쓸 값이 생기면 양쪽에 복사하지 말고 `shared/` 에 두세요.**
  단, 화면(UI) 코드는 플랫폼이 달라 공유하지 않습니다 — 로직·데이터만 공유합니다.
- `shared/` 안에서는 `@/lib/...` 를 import 하지 마세요. 앱에는 그 경로가 없습니다.

## 구글 Places
- 사진 URL은 **반드시** `buildPlacePhotoProxyUrl()` 사용. 키를 URL에 박으면 클라이언트와 DB로 새어 나갑니다
  (실제로 그렇게 유출된 적 있음 — 자세한 내용은 인계 노트 참고).
- 장소 조회는 `lib/places-cache.ts` 를 거쳐 캐시 우선으로.
- 장소 사진은 `/api/places/photo` 가 우리 스토리지(`place-photos` 버킷)에 보관합니다.
  구글 호출은 사진 한 장당 30일 1회. 라우트의 **URL 모양은 바꾸지 마세요** —
  그 주소가 `saved_places.image_url` 에 저장돼 있고 앱도 같은 주소를 씁니다.
