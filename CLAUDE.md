# 위드트립 (웹)

Next.js(App Router) + Tailwind + Supabase. 배포는 `git push origin main` → Vercel 자동 배포.

## 먼저 읽을 것
진행 중이거나 최근 끝난 작업의 맥락은 **[PLACE-CACHE-HANDOFF.md](PLACE-CACHE-HANDOFF.md)** 에 있습니다.
구글 장소 캐싱, 사진 프록시(API 키 유출 수정), 배포 순서, 아직 남은 일이 전부 정리돼 있으니
관련 코드를 건드리기 전에 반드시 읽으세요.

## 기본 규칙
- **모든 변경은 웹·앱 둘 다 반영.** 기능은 동일하게, 디자인만 플랫폼에 맞게.
  앱 저장소는 `~/withtrip-app` (Expo SDK 57). 한쪽만 고치면 안 됩니다.
- **항상 한국어 존댓말**로 응답.
- **비밀값(.p8 키, 토큰, 비밀번호, service_role 키) 절대 출력 금지.**

## DB (Supabase)
- project ref: `cwcrakhjbstexcokxnis`
- SQL은 Management API로 실행 (`SUPABASE_ACCESS_TOKEN`은 `~/.zshrc`에 있음, 출력 금지).
- 스키마 변경 기록은 `supabase/*.sql`.
- **파괴적 작업 금지**: DROP / DELETE / TRUNCATE / 기존 행 UPDATE 를 하기 전에 반드시 사용자 확인.
  DB 백업: `~/withtrip-backups/` (읽기 전용 SELECT로 뜬 전체 테이블 JSON).

## 구글 Places
- 사진 URL은 **반드시** `buildPlacePhotoProxyUrl()` 사용. 키를 URL에 박으면 클라이언트와 DB로 새어 나갑니다
  (실제로 그렇게 유출된 적 있음 — 자세한 내용은 인계 노트 참고).
- 장소 조회는 `lib/places-cache.ts` 를 거쳐 캐시 우선으로.
