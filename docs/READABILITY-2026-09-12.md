# 주요 화면 가독성 보완 · 2026-09-12

사용자 요청: 메인 카드에서 승인한 정보 묶음·가독성 개선을 다른 영역에도 진행.
확정된 메인 상단 BrandHeader·WITHTRIP·하단 내비게이션은 변경하지 않았다.
이번 작업은 정보 위계와 가독성 보완이며, 기존 53개 화면의 Figma 전체 일치 검수를 완료했다는 뜻이 아니다.

## 적용

- 여행 상세: 표지 보조 정보13px, 동행 이름15px/22행간·상태14px. 동행 영역의 과한 여백 축소. 웹 중복 구분선 제거, 단어 단위 줄바꿈.
- 일정/위디/보드: 시각·참여·추천 설명 등 읽어야 하는 작은 옅은 문구14px/진한 회색. 드래그 측정·가장자리 스크롤·최신 대화 포커스·모션 로직 유지.
- 찜: 주소·평점·거리·목록 설명14px. 전체보기 행 경계와 세로 여백 보완. 필터 구성/아이콘/지도 핀/초기 하단 시트 위치 유지.
- 장소/리뷰: 정보 카드 경계 선명화, 거리 정보 흰색 카드. 리뷰 본문15px/23행간, 이름/날짜 줄바꿈. 영업시간/전화/길찾기 기능 유지.
- 정산: 내역 날짜/부가 설명·지출 입력 합계/배분 설명 가독성 강화. 총액·참여자·균등 분할·완료 애니메이션 유지.
- 프로필/친구/코스: 동행자·경로·총지출 설명14px. 여행기록 간 단일 경계, 카드 내부 간격 축소. 지도 포커스 모션 유지.
- 작성/설정: 작은 설명 텍스트 보완. 여행 만들기·일정 추가·숙소 추가의 기본 라벨14/입력16 등 이미 읽기 충분한 입력 요소는 유지. 고정 크기 배지·마커 숫자·활성/비활성 상태 색상은 일괄 확대하지 않음.

## 검증과 한계

앱 tsc, 웹 전체 typecheck:web, 기존 동선·드래그30 및 자동완성 회귀 통과. 실제 TripHeroCard/StayItem을 임시 읽기 전용 데이터로320px 렌더: 동행·날씨·주소·체크인/아웃 정상 확인. 임시 fixture/export 제거. 앱의 실제 로그인 데이터·모든 세부 화면을 기기에서 확인한 것은 아니며, 다음 빌드 실기기 검수 필요.
DB/API/권한/데이터 저장 로직 변경 없음. 빌드·OTA·웹 배포 없음. TestFlight123에 미포함.

## 수정 파일

### 앱
- `src/app/trips/[id].tsx`
- `src/app/(tabs)/saved.tsx`
- `src/app/place/detail.tsx`
- `src/app/settlement/[tripId].tsx`
- `src/app/(tabs)/settlement.tsx`
- `src/app/profile/[userId].tsx`
- `src/app/profile/follows.tsx`
- `src/app/trips/course.tsx`
- `src/app/mypage.tsx`
- `src/app/transport/new.tsx`
- `src/app/expense/new.tsx`
- `src/app/place/new.tsx`
- `src/components/profile-travel-record.tsx`
- `src/components/place-review.tsx`
- `src/components/expense-from-receipt.tsx`
- `src/components/trip-board.tsx`
- `src/components/widy-room.tsx`

### 웹
- `components/trip-hero-card.tsx`
- `components/saved-places-view.tsx`
- `components/place-detail-sheet.tsx`
- `components/place-reviews.tsx`
- `components/settlement-view.tsx`
- `components/settlement-sub-panel.tsx`
- `components/mypage-view.tsx`
- `components/friends-view.tsx`
- `components/public-trip-viewer.tsx`
- `components/itinerary/stay-section.tsx`
- `components/schedule-timeline.tsx`
