## 2026-09-13 Codex · 확정 일정 사진/시간선 디자인

앱과 공통으로 ScheduleSection 대표사진280:156/r10, 동행자 옆 아이콘길찾기, 시간선 중간 이동정보 적용. 저장사진/숙소 원본ID 우선, shared/schedule-cover.ts로 현재일차 누락사진만 기존 search API 재사용(동시2·30분캐시·10초·동일상호/500m·실제photoUrls만). 앱sync완료. DirectionsMenu 기본glyph 피그마원본, 커스텀아이콘 보전. 원래없는 웹 사진업로드/주변추천 UI는 신설하지 않음. 앱웹타입 통과. 배포없음, 사용자 eas.json 등 무관 변경 유지.

## 2026-09-13 Codex · 미쉐린 아이콘 통일

quick-michelin 필터를 기존 미쉐린 얼굴 PNG로 교체. 정적 SVG도 동일 얼굴로 갱신. flower-2/white의 일반 꽃을 실제 MichelinStar 경로로 교체, 출처·라이선스 기록 추가. 앱에도 동일 자산/스타 지도 아이콘 반영. 양쪽 타입 및 앱 지도 검사 통과. 웹 push 없음. staged eas.json 및 tsconfig.tsbuildinfo/AGENTS.md/app.json 등 무관 변경 유지.

## 2026-09-13 Codex · 장소 사진 확대 레이어 수정

앱 사진 확대 신고 공통 점검. 웹 상세 패널z80 대비 사진 Dialog z50으로 뒤에 가려짐. 해당 사진 Popup100/Backdrop99, DialogContent optional overlayClassName 전달 추가(기본 다른모달 유지), 데스크톱 확대 폭 확대. 앱은 horizontal ScrollView의 flex1/grow0 높이 접힘을 명시 viewport 높이로 수정. 양쪽 타입 통과, 웹push 없음. 사용자 무관 파일 변경 유지.

## 2026-09-13 Codex · 그다음 여행 커버 사진

앱127 사용자 이미지 누락 피드백 공통 반영. 승인 compact 카드 지도핀 박스→80×88 커버사진(heroImage/기존 폴백), 지역명 본문으로 유지. 하단 메타94px 정렬. 앱 동일 tripCover 사용. 양쪽 타입 통과, 빌드/웹push 없음. 사용자 eas.json/tsconfig.tsbuildinfo/AGENTS.md/app.json 보전.

## 2026-09-13 Codex · 위디 개인화 운영 권한 적용

사용자가 여행 멤버간 위디 질문/답 공유를 중지하고 본인만 보도록 명시 요청. 운영 migration20260912161605 적용: trip_messages에 restrictive SELECT(위디 prefix면 auth.uid=user_id)를 추가하여 기존 참여자/숨김 정책과 함께 적용. 기존53개 위디 모두 user_id 존재, 기록 삭제/갱신 없음. 일반 메시지 권한 변경 없음. 본인 조회 복합 인덱스 추가.

위디 INSERT는 wt_push_trip_chat 및 tg_unread_trip_message 호출에서 제외하는 WHEN 조건 추가. 기존 함수와 webhook 인수 유지. send-chat-push v6 실제 원격v5 소스에 위디 조기반환만 추가해 배포(기존 verify_jwt=false 유지). 위디 테스트 요청은 private_widy 반환, 푸시 전송 없음. 일반 웹 push/Next배포와는 별개인 명시 요청 범위의 DB/Edge 변경.

검증 migration20260912161830에서 실제 동일 여행 두 사람 역할로 본인 SELECT 허용·다른 멤버 SELECT 거부 확인. 기존 데이터를 수정하지 않는 DO 검사. MCP 읽기 도구는 readonly 역할로 SET ROLE 불가하여 검증 migration으로 수행; 관리 API 로컬 토큰은401여서 사용하지 않음. 트리거 WHEN/Edge guard 확인. 앱 개인조회·개인실시간·맥락 필터는 다음 앱빌드 대기. 웹에 위디 화면 신설 없음.

## 2026-09-12 Codex · 이동수단·숙소 디자인 재정리

앱 사용자 요청 공통 반영. 이동수단 제목/흰 윤곽44px 추가, 노란 점 역할명, 출발·도착 이름16px 두 줄과 시간30px, 파스텔/워터마크/중첩 카드 제거. 경유/항공 시간대/사람/권한/편집 유지. 숙소 이름22px·체크인/아웃 구분선과 시간26px, 사진·전화·메모·길찾기·투숙자 유지. 새 travel-detail.module.css 카드 등장320ms 및 동작줄이기. 앱도 같은 위계로 변경. 웹배포 없음.

## 2026-09-12 Codex · 찜 지도 핀 범위 생성 보완

앱126의 미쉐린 전체 화면 밖 핀 생성 부담/늦은 GPS 초점 누락 수정과 공통 보완. 웹 SavedMapPins도 범위 미확정에는 핀을 만들지 않고 범위 확정 후 주변25% 여유까지 생성. shared/map-viewport.ts를 원본으로 날짜변경선 지원, 앱 sync. 웹 기존 GPS ready 재중심 동작 유지. 전체 검색/목록 데이터 보존. 앱·웹 타입/범위·위치 회귀 통과. 실기기 FPS 미측정. 웹배포 없음.

## 2026-09-12 Codex · 메인 대표 여행 외곽선 제거

사용자 최종 승인: 사진을 화면 끝까지 넓히지 않고 기존 폭/높이/상단 둥근 모서리/정보 배치를 유지하며 대표 여행 카드 외곽선만 제거. 앱 동일. 웹 배포 없음.

## 2026-09-12 Codex · 메인 플러스 강조 축소

사용자 메인 헤더 플러스가 혼자 튄다는 피드백. 모바일 승인 헤더 퀵등록44px 터치와 기존 이벤트는 유지하고 노란 배경만 흰색으로 변경. 앱 동일 반영. 큰 메인 문구/넓은 사진은 선택 전 제안이며 아직 변경하지 않음. 웹 위디 대화 신설 없음, 배포 없음.

## 2026-09-12 Codex · 숙소 시안 배치 재적용

숙소 외곽 카드·상단 영문 제목·큰 추가 버튼을 제목+44px 노란 추가 아이콘으로 교체. 사진 위 제목/어두운 덮개를 없애고 사진 아래 숙소명, 체크인/아웃 날짜와 시간 두 열. 기존 전화·메모·동행자·길찾기·수정/삭제·모달 보전. 앱도 같은 구조이며 앱 팔로워 상태바 겹침은 native safe area로 별도 수정. 배포하지 않음.

## 2026-09-12 Codex · 찜 경량화·상세 대표사진 제거

앱 사용자 요청 공통 반영: place-detail-sheet 상단236px 사진 블록 제거, 사진 탭/확대/리뷰/정보 그대로. saved-places-view 전체보기 합치기/정렬은 입력 변경 때만 useMemo 계산. 앱은 접힌 첫 진입 사진 카드 마운트 지연/친구 추천 점진 렌더도 반영(웹은 기존 lazy 이미지/visible 사용). 실기기 성능 수치는 미측정. 배포 없음, 사용자 eas.json/tsconfig.tsbuildinfo/AGENTS.md/app.json 보존.

## 2026-09-12 Codex · 일정 시간축 가독성 재수정

앱125 사용자 피드백 공통 반영. ScheduleSection 시간 앞 점·세로선, 14px 시간, 이동 표시를 absolute에서 본문 아래 정상 흐름으로 옮겨 겹침 방지. 실제 조회 mode에 맞춰 차/버스/도보 아이콘 표시. 조회/편집/연락처/길찾기/권한은 유지. 웹에 없는 위디·빈시간 추천 작성 기능 신설 없음. npm run typecheck:web 통과. 앱 JSX 예시320/390px 검사는 네이티브 검수와 다름. push/배포 없음. 기존 사용자 eas.json/tsconfig.tsbuildinfo/AGENTS.md/app.json 변경 보존.

## 2026-09-12 Codex · 승인 로그인 시안 실제 연결 (미배포)

사용자가 `login-quiet-motion.html`의 흰 로그인 화면을 승인하고 실제 적용 요청. `components/auth/login-view.tsx`, 새 `login-motion-art.tsx`·`login-quiet.module.css`에 작은 실제 로고/26px 문구/나침반과 경로/노란 이메일 버튼/흰 소셜 행을 적용했습니다. 앱 로고와 웹 `withtrip-logo.png` SHA가 같습니다. 가입·비밀번호 재설정은 기존 폼을 같은 Base UI 슬라이드 시트 안에 넣고 240ms 옆 이동, 시트 300ms 감속·닫힘·Escape·포커스 복원을 연결했습니다. 비밀번호 표시, 미일치·필수 약관 검사, 중복 제출 방지, 로딩·성공·오류 상태를 유지합니다. 애니메이션은 시트 뒤·백그라운드·화면 밖에서 중단하고 동작 줄이기를 따릅니다.

기존 `auth-api`와 비밀번호 로그인 제출 함수/안전한 `?next=` 복귀 코드는 그대로입니다. 웹의 기존 카카오·구글만 제공하고 앱 전용 Apple/OTP를 신설하지 않았습니다. 계정·DB·권한·콜백 경로 변경 없음. 회원가입/재설정은 원래의 부모 뷰 콜백으로 연결됩니다.

검증: `npm run typecheck:web` 및 diff 공백 검사 통과. 3003 기존 개발 서버가 응답하지 않아 그대로 두고 `/private/tmp`의 격리 Next 화면에서 실제 컴포넌트를 import했습니다. Playwright 390×844·320×568에서 가로 넘침0, 실제 로고·모션/정지/reduced motion·포커스 복원, 테스트 Supabase 주소의 모의 POST 응답으로 로그인 오류·재설정 성공·가입 비밀번호/약관 차단·이메일 확인 상태 통과, 런타임 예외0. API 인증 운영 성공/실제 OAuth/메일 발송 검증은 하지 않았습니다. 격리 서버와 검증용 브라우저 종료. 앱과 동일 적용을 root 작업에서 진행합니다.

로컬 커밋만, push·웹 배포·EAS 빌드 없음. 기존 사용자 eas.json(스테이징)/tsconfig.tsbuildinfo/AGENTS.md/app.json은 보존하고 커밋 제외합니다.

## 2026-09-12 Codex · 확정 시안 재조립 + 개인 기록 읽기 연결 (미배포)

사용자는 확정 디자인 전체에 기존 기능 연결을 요청했습니다. 찜은 원본 SVG35개·전체 지도·세로 분류·접힌 시트·혼합 카드/핀 팝업으로, 프로필은 원본 상단/스토리/압축 실제 지도와 표지 없는 기록 상세로 교체했습니다. 일정은 시간/장소 두 열, 세부 장소/리뷰/정산/계정/친구 및 빈 메인/하단 바도 동결 원본 구조와 모션으로 보완했습니다. 이미 승인된 메인 카드/헤더는 유지했고 필터 CSS를 전역 전파하지 않았습니다.

- 공개 읽기: `/api/templates`의 기본 인기허브 응답은 그대로, ownerId/page 및 slug를 기존 공개 DTO/캐시/민감정보 제거 경로로 추가했습니다. 앱 새 공개기록 읽기는 이 웹 변경의 배포가 먼저 필요합니다. 현재 미배포입니다.
- 본인 기록: 소유+accepted 참여 과거 여행 조회/상세 재확인. `shared/profile-record-access.ts` 공통 원본과 앱 sync; 공개 소유자 필터에는 참여를 섞지 않습니다. 외화 합계는 기존 환율/지급자별 수수료를 사용합니다.
- DB 스키마/RLS/권한/비공개 정보 공개범위/AI비용 제한을 변경하지 않았습니다. 웹에 없던 채팅·정산 입력도 추가하지 않았습니다.
- 타입/공개쿼리18/개인 기록 권한·환율 검사와 실제 컴포넌트390/320px 검증. 캡처는 임시 데이터를 준 카드/시트/상세 검증이며 인증 운영 화면 전체를 검증한 것은 아닙니다. 임시 경로 제거.
- 앱 전체 인계/증거는 `/Users/ohsuhwan/withtrip-app/docs/DESIGN-EXACT-2026-09-12.md`. 네이티브 로그인/터치/저장 검수는 아직 남아 있습니다.
- 로컬 커밋만. push·배포·빌드 없음. 기존 사용자 `eas.json`(스테이징), `tsconfig.tsbuildinfo`, `AGENTS.md`, `app.json`은 이 작업 커밋에 넣지 않습니다.

## 2026-09-12 Codex · 세부 시안 대조 후 보완

공통 웹의 친구 추천 제목/빈 프로필, 이동수단 외곽 박스·항공사 워터마크 제거, 숙소의 사진 아래 이름/체크인·체크아웃 배치로 승인 home.html 구조 반영. 기존 검색/저장/전화/길찾기/메모 유지. API/DB/공유 데이터 변경 없음.
typecheck:web 및 diff 확인 통과. 로그인 상태 화면의 시각 대조는 미완료. 앱 53개 기준 감사는 withtrip-app/docs/DESIGN-AUDIT-2026-09-12.md. 배포하지 않음.

## 2026-09-12 Codex · 승인 시안 실제 UI 이식 (배포 전)

앱 사용자 요청은 타이포 보완이 아니라 승인 시안 전체를 실제 기능에 연결하는 것. 공통 웹 화면의 작성 다이얼로그(여행/일정/숙소), 장소 상세/리뷰, 정산, 프로필/공개 코스, 친구, 계정/알림에 레이아웃 반영. components/approved-form.module.css와 public/design/place/action-1~5.svg 추가. API/캐시/DB/권한/공통 데이터는 변경하지 않음. 웹 채팅/정산 입력 신설 없음. 기존 저장·검색/날짜/공유·정산 동작 유지.

웹 타입 검사 통과. 320×568에서 일본→도쿄 검색/선택, 폼 저장 버튼 가시 영역, 장소 사진 확대와 Escape, 리뷰0건, 정보 스크롤 확인. 임시 app/design-port-check 및 샘플 사진 제거. 로그인 실제 계정/모바일 기기 검수는 별도. 이번 웹 push/배포 없음. 앱 상세 이력은 withtrip-app/docs/DESIGN-PARITY-2026-09-12.md 참조.

## 2026-09-12 Codex · 확정 디자인 전체 이식 오해 정정 / 메인·여행 상단 재교체

- 사용자는 기존 화면의 부분 스타일 변경이 아니라 확정 새 디자인 전체에 기존 기능 연결을 요청했음. 앱121은 전체 적용 완료본이 아님. 앱 `docs/DESIGN-PARITY-2026-09-12.md` 기준으로 원본 대조.
- 웹 메인만 approved 카드 variant: 큰 제목/대표 사진/사진 아래 동행자/후속 도시 목록. 헤더 좌측 실제 로고. 기존 편집/삭제/날씨/멤버/생성/필터 유지. 정산 카드 사용처는 기존 variant 유지.
- 여행 표지·멤버 줄을 새 구조로 교체, 오른쪽 정산 아이콘, 편집/공유/초대 표지 위 아이콘. 앱 대화는 웹에 신설하지 않음. 모바일 탭 아이콘/노란 단일선/방향300ms 슬라이드. 하단 SVG는 동결 shared-nav 원본 경로/레이어 순서.
- 타입 검사 통과. 실제 메인 컴포넌트 샘플0·1·3개/320·390px 가로 넘침 없음/후속 여행 클릭 ID 확인. 임시 fixture 및 context export 제거. 실제 `/` 비로그인 화면 로고/네비/오류없음 확인. 로그인한 여행/네이티브 실기기 및 전체 세부 화면 디자인 대조는 미완료.
- API/DB/의존성 버전 변경·배포 없음. 기존 eas.json(스테이징)/tsconfig.tsbuildinfo/AGENTS.md/app.json 사용자 변경 보존.

## 2026-09-12 Codex · 남은 타입 진단26개 해결 (미배포)

- `npm run typecheck` 전체 통과/진단0. 세부 절차 `docs/TYPECHECK.md`.
- Next 개발/일반 생성 타입에서 관리자 경로 인코딩 차이로 생긴 충돌2개: dev 생성물 중복 제외, next typegen 후 canonical routes/validator 검사. 생성 파일/관리자 URL 직접 변경 없음.
- Deno 전용 함수24개: 웹 검사와 분리하고 고정 Deno 2.9.6 + frozen 잠금 파일로 실제3개 함수 엄격 검사. 설정은 scripts/edge-typecheck에 격리. Deno 2.1.14 검사도 통과. 서버 함수 본문/API/DB 변경 없음.
- 잘못된 웹 페이지/서버 함수 임시 표본은 각각 실패하는 것까지 검증, 제거 후 전체 성공. ignoreBuildErrors=false로 복원.
- npm 검사 스크립트/설정/잠금/문서만 로컬 커밋. 실제 빌드·배포·푸시 발송 없음. 사용자 eas.json/tsconfig.tsbuildinfo/AGENTS.md/app.json 변경 보존.

## 2026-09-12 Codex · 자동완성/디버깅 1차 (미배포)

- 국가 코드 검색 옵션, SearchableSelect 한글 조합 Enter 방지/방향키 선택, 숙소 검색 삭제/닫힘 후 응답 무효화.
- airlines/flight-presets/transport-presets 원본을 shared로 이동하고 lib 재수출. 앱에도 기존 검색 옵션 연결. 데이터 값 변경 없음, 앱 sync/check 완료.
- 웹 화면 타입 진단8개 수정: 아바타 문자열 판별, 알림 진입의 실제 id 인자 타입, nullable 알림 필터. 전체26개(Next 생성2/Deno24)는 남아 있으며 숨기지 않음.
- 실제 콤보박스 로컬 검증: JP→일본→오사카, 국가 변경/직접지역, IME/ESC, 320px 넘침0. 운영 공개 장소 검색1회 HTTP200/좌표 확인. 임시 라우트 제거. DB 쓰기/배포 없음.
- 앱에서는 일정 검색 선택 콜백으로 좌표가 지워지는 오류와 숙소 좌표 저장 누락도 수정. 앱 문서 docs/AUTOCOMPLETE-AUDIT-2026-09-12.md 참고. 실제 로그인 키보드/저장/재진입은 미검증.

## 2026-09-12 Codex · 확정 디자인 확대 (미배포)

- 찜: 전체/나의 찜/여행클립/친구찜 지도 아이콘. 세 출처 통합 지도와 출처별 전체 목록, 기존 카드/수락/저장/삭제 재사용. 친구찜·빈 상태도 접힌 SavedMapSheet 사용. 검색과 출처별 필터 유지. 추가 렌더링에 데이터 개수 상한.
- 정산: 흰 총액 카드/큰 금액/노란 선, 선택 탭 밑줄, 실제 아바타와 빈 폴백.
- 장소: 상단 사진을 사진 탭으로 이동, 사진·리뷰·정보 탭, 26px 제목/전체 폭 주소. 열림/닫힘 모션·ESC·포커스 복원. 기존 API·방문·리뷰 읽기·전화·길찾기·담기 유지.
- 공개 코스: 표지 대신 제목/메타, 왼쪽 시간축과 장소 이름 상세 진입, 모바일 지도. 기존 PlaceDetailSheet로 연결. 지도 선850ms 감속 진행, reduced motion/백그라운드 정리.
- API/공개 스크러빙/DB 스키마 변경 없음. 공개 뷰어에 사람·지출을 노출하지 않음. 앱 프로필의 동행자·지출은 본인 소유 확인/RLS 뒤에만 보완.
- 검증: 앱 tsc·동선13/미쉐린10 검사 통과. 웹 수정 파일 신규 타입 진단 없음(기존34개). 로컬 실제 PublicTripViewer+가상자료/장소 API 모의응답: 390/320px 넘침0, 주소350/280px, 정보·리뷰 전환 및 상세 닫힘/포커스 복원. 실제 계정 저장/지도 데이터 검증은 로그인 대기. 127.0.0.1은 Next 개발 자원 차단이 있어 localhost로 검증. 임시 design-check-local 라우트 제거.
- 미완료: 실제 로그인한 대량 찜/필터/지도/시트 연결 최종 검수, 전체 세부 화면 실데이터 대조. 앱 일반 일정 탭 드래그와 공개 프로필 최신12개 제한도 후속. 전체 완료 아님.
- 사용자 eas.json/tsconfig.tsbuildinfo/AGENTS.md/app.json 보존. 로컬 커밋만, push/배포 없음.

# 위드트립 — 구글 장소 캐싱 작업 인계 노트 (이어서 진행용)

## 2026-09-12 Codex — 찜 디자인 2차 (미배포)

- saved-places-view 및 새 place-filter-drawer/saved-filter-controls/saved-filter CSS: 흰 바탕·선택 노란 밑줄, 긴 국가·카테고리 줄바꿈, 고정 결과 footer, Base UI Dialog의 포커스/ESC/닫힘 모션. CSS는 필터 범위로 제한. 필터 조건/초기화/결과수 로직 유지.
- saved-map-sheet: 기본 접힌112px, 중간/전체 단계 스냅. 손잡이 클릭·포인터 드래그·핀 선택 시 펼치기. 기존 지도/목록/저장·삭제·추천·상세 로직 유지. 접힘 상태에서는 가려진 목록의 키보드 포커스 방지.
- 검증: 변경 전후 tsc 오류34개 동일, 신규 없음. 실제 컴포넌트 임시 로컬 화면: 390×844/320×568 넘침 없음, 긴 본문1928/2264px 스크롤, footer 고정. 선택/퇴장/제거 확인. 시트448→291→0→448px, 포인터드래그 후291px 확인. 임시 app/design-check-local 페이지 제거. 테스트용 샘플 외 계정/DB 조작 없음.
- 앱에도 필터/아이콘/시트 조정 대응. 인증 후 실제 지도 선택/모바일 터치, 전체보기 통합·새 미쉐린 핀/액션 등은 후속 검증·적용 대기.
- 기존 사용자 eas.json 스테이징·tsconfig.tsbuildinfo·AGENTS.md·app.json 보존. 빌드/push/배포 없음.


## 2026-09-12 Codex — 확정 디자인 실제 적용 1차 (미배포)

- 사용자 승인: 디자인 확정 문서화 후 실제 코드 적용 시작. 앱의 docs/DESIGN-FINAL-2026-09.md 기준. 전체 세부 화면 완료가 아닌 첫 적용분.
- components/home-view.tsx, trip-banner-card.tsx/module.css, travel-start-art.tsx: 빈 여행 지도·비행기 모션, 복수 여행의 후속 압축 카드. 기존 생성/필터/편집/삭제/날씨/동행자 기능 유지.
- bottom-nav.tsx, mobile-global-chrome.tsx: 여행/찜/프로필, 활성 노란 아이콘, 아래로 축소·위로 복원, 찜에서는 숨김. 실제 로고 public/withtrip-logo.png 사용.
- mypage-view.tsx: 하단바에서 이동한 친구·정산의 진입 링크 보존. 앱 전용 공유 분석/대화 화면은 웹에 신설하지 않음.
- 검증: 수정 전후 tsc --noEmit --incremental false 오류 비교 시 신규 없음. 기존 타입 오류는 그대로 남음. 로컬 390×844 메인 렌더/런타임 오류/가로 넘침 검사 통과; 하단바 346→210→346px 실측. 비로그인 찜 진입은 로그인 리다이렉트여서 실제 지도 시각 검증은 대기.
- 앱 타입 및 기존 동선 계산 검사 통과. 실기기 인증 데이터/모션/제스처 검증은 아직 대기. 후속 적용은 찜·위디/일정·장소·정산·프로필·작성 세부 화면.
- 초기 사용자 변경 eas.json(스테이징), tsconfig.tsbuildinfo, AGENTS.md, app.json 보존. Next 개발 서버가 생성한 next-env.d.ts 변경은 복구. push/배포 없음.


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

## ✅ 캐시 활성화 완료 (세션2 마무리)
사용자가 Vercel 토큰을 발급해 줘서 Vercel REST API로 처리함. **토큰은 사용 후 폐기 요청함.**
- `SUPABASE_SERVICE_ROLE_KEY` → production / preview / development 등록
- `CRON_SECRET` → production 등록 (openssl rand -hex 32)
- 최신 프로덕션 배포 재생성(`dpl_3o61DHxHYJXWGzpJUCkcRsDRReUA`) — 환경변수는 재배포해야 반영됨

**실측 검증 (프로덕션)**
- 새 검색어 → `places` +8행 저장 (캐시 쓰기 동작)
- 같은 검색 재실행 → +0행 = **구글 Details 호출 0회**, 응답 3606ms → 1437ms
- 크론: 무인증 호출 **401**, 시크릿 통과 시 정상. `scanned: 0`은 24시간 재갱신 방지가 동작한 것
- 가이드 6장 체크리스트 **17/17 통과**

**프로젝트 정보 (다음 세션용)**
- Vercel project: `withtrip` / `prj_7opDojCWPbAM371o7dGJ21Pg74sM` / team `team_mdigJiAGhoOuf4WUNpt2Sk2C`
- 이 맥에는 Vercel 자격 증명이 저장돼 있지 않음. 필요하면 다시 토큰을 받아야 함.

## (해결됨) 막혔던 이유 — 값이 없어서가 아니라 계정 접근이 없어서
이 맥에 있는 자격 증명은 `~/.zshrc`의 **`SUPABASE_ACCESS_TOKEN` 하나뿐**이다.
Vercel CLI·로그인 캐시·`VERCEL_TOKEN` 없음, `gcloud` 미설치, GCP 자격 증명 없음.
→ service_role **키 값은 `.env.local`에 이미 있지만**, 그걸 Vercel에 등록하려면 Vercel 계정 인증이 필요하다.

**해결 경로**: 사용자가 `npx vercel login` 한 번 실행 → 이후는 CLI로 전부 자동 처리 가능.
```bash
npx vercel login
npx vercel link            # 프로젝트 연결
printf '%s' "$SERVICE_ROLE_KEY" | npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
printf '%s' "$SERVICE_ROLE_KEY" | npx vercel env add SUPABASE_SERVICE_ROLE_KEY preview
openssl rand -hex 32 | tee /dev/stderr | npx vercel env add CRON_SECRET production
npx vercel --prod          # 환경변수는 재배포해야 반영됨
```

**검토했다가 버린 우회로**: `places`에 anon 쓰기 정책을 열면 Vercel 없이도 캐시가 돌지만,
anon 키는 브라우저에 공개돼 있어 **누구나 실제 google_place_id 행에 가짜 이름·평점을 덮어쓸 수 있다.**
캐시 오염이 그대로 사용자 화면에 노출되므로 채택하지 않음. service_role이 정답.

## ⛔ 사용자가 직접 해야 하는 것 (내가 못 함)
~~1. Vercel `SUPABASE_SERVICE_ROLE_KEY`~~ → **완료**
~~2. Vercel `CRON_SECRET`~~ → **완료**
3. **Google Cloud Console 일일 할당량 상한 + 예산 알림** (가이드 5-1, 5-4).
4. **유출된 구글 키 폐기·재발급** (위 "배포 순서" 4번). 지금 키는 이미 외부에 나가 있어 코드 수정만으로는 회수 불가.
5. **`NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`는 지도(Maps JavaScript API)용이라 브라우저 노출이 불가피함.**
   제거하는 게 아니라 Cloud Console에서 **HTTP 리퍼러 제한(withtrip.co.kr) + Maps JavaScript API 전용**으로 잠가야 함.
   서버용 Places 키와 **반드시 분리**할 것.
6. (선택) `NEXT_PUBLIC_SITE_URL=https://www.withtrip.co.kr` — 없어도 요청 origin으로 동작하지만,
   프리뷰 배포에서 저장한 장소가 프리뷰 도메인 URL로 DB에 남는 걸 막아준다.
   ※ 참고: 로컬 `.env.local`의 `GOOGLE_PLACES_API_KEY`는 **빈 값**이라 로컬 검색이 원래 동작 안 했음(테스트 때 임시로 public 키를 주입해 확인).

## 배포 완료 내역 (세션2)
| 대상 | 커밋/버전 | 상태 |
|---|---|---|
| 웹 places 캐싱 + 사진 프록시 | `eb59f68` merge → main | 배포됨 |
| 웹 크론 24시간 재갱신 방지 | `ae462c1` | 배포됨 |
| 웹 일정 카드 주소 줄바꿈 | `932cf25` | 배포됨 |
| 앱 사진 프록시 | `cc6f030` | OTA(production·preview) |
| 앱 일정 카드 주소 줄 분리 | `a56c1fb` | OTA(production·preview) |

- 앱 저장소는 git 리모트가 없어 커밋은 로컬에만 존재. 배포는 EAS OTA로만 나감.
- OTA는 **빌드 15(런타임 1.0.1) 이상에만** 적용됨.

## 일정 카드 주소 줄바꿈 — 원인 기록 (같은 실수 방지용)
증상: 카드마다 주소 줄바꿈이 제각각. 아이콘 3개(길찾기·수정·삭제) 카드는 어절마다 한 줄씩 끊기고,
아이콘 1개인 자동 일정 카드만 폭을 제대로 채움.

원인: 작성자·메모·주소·전화가 **제목과 같은 flex 행** 안에 있었다. 그 행의 아이콘 묶음이 `shrink-0`이라
폭을 먼저 가져가 좁은 폰에서 텍스트 컬럼에 100pt 남짓만 남고, `break-keep` 때문에 어절 단위로만
줄바꿈되어 어절 하나가 한 줄을 차지했다.

⚠️ **"주소·전화를 각각 자기 줄로 분리"만 하는 수정은 효과 없음** (헤드리스 크롬으로 렌더해 확인).
제목 행 **밖**으로 빼서 카드 전체 폭을 쓰게 해야 해결된다.

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
