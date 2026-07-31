-- WITHTRIP: trips.invite_code — 멤버 초대 링크용 컬럼
-- /join?code=... 와 fetchTripInviteCode()가 참조하는 컬럼이 DB에 없어서
-- "멤버 초대하기" 다이얼로그의 초대 링크가 영원히 로딩 상태에 머무는 문제를 해결합니다.
-- Supabase Dashboard → SQL Editor에서 실행하세요.

alter table public.trips
  add column if not exists invite_code text;

-- 기존 여행들에 코드가 없으면 URL-safe 랜덤 코드 채우기
update public.trips
set invite_code = substr(md5(random()::text || clock_timestamp()::text), 1, 10)
where invite_code is null or invite_code = '';

-- 새 여행 생성 시 자동으로 코드가 채워지도록 기본값 지정
alter table public.trips
  alter column invite_code set default substr(md5(random()::text || clock_timestamp()::text), 1, 10);

create unique index if not exists trips_invite_code_key on public.trips (invite_code);

notify pgrst, 'reload schema';
