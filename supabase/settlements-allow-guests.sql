-- 정산 전용 게스트(settlement_guests)가 참여한 송금도 settlements 에 저장되도록 수정.
--
-- 배경: 나중에 추가된 '정산 전용 게스트' 기능에서 게스트는 settlement_guests.id 로
-- 식별되는데, settlements.from_user_id / to_user_id 는 auth.users(id) 를 참조하는
-- 외래키였다. 그래서 게스트가 낀 송금(예: 게스트 → 멤버)을 저장하려 하면 외래키
-- 위반(23503)으로 실패했고, 정산 새로고침 전체가 예외로 중단되어
-- "정산 데이터를 불러오지 못했어요." 가 떴다.
--
-- 게스트는 이미 fetchSettlementMembers 에서 멤버 목록에 isGuest 로 합쳐져 이름이
-- 표시되므로, 아래 두 외래키만 제거하면 게스트 송금도 정상 저장·표시된다.
-- (trip_id 외래키는 유지되므로 여행 삭제 시 정산 행은 그대로 함께 삭제된다.)

alter table public.settlements drop constraint if exists settlements_from_user_id_fkey;
alter table public.settlements drop constraint if exists settlements_to_user_id_fkey;
