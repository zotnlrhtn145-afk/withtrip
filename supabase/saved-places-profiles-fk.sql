-- WITHTRIP: saved_places.user_id 에 profiles FK 추가
-- 컬럼에 FK가 전혀 없어서 `profiles:user_id(...)` 임베드 조인이 실패하고 있었습니다
-- (주변 스팟 지도에 등록자 아바타/닉네임이 노출되지 않던 원인).
-- Supabase Dashboard → SQL Editor에서 실행하세요.

alter table public.saved_places
  drop constraint if exists saved_places_user_id_fkey;

alter table public.saved_places
  add constraint saved_places_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

notify pgrst, 'reload schema';
