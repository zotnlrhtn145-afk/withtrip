-- WITHTRIP: 저장 장소 <-> 숙소 거리 계산을 위한 위경도 컬럼 추가
-- Supabase Dashboard → SQL Editor에서 실행하세요.

alter table public.saved_places add column if not exists lat double precision;
alter table public.saved_places add column if not exists lng double precision;

alter table public.trip_accommodations add column if not exists lat double precision;
alter table public.trip_accommodations add column if not exists lng double precision;

notify pgrst, 'reload schema';
