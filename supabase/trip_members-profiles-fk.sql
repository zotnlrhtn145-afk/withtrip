-- WITHTRIP: trip_members.user_id 에 profiles FK 추가
-- PostgREST의 `profiles:user_id (...)` 임베드 조인이 동작하려면
-- trip_members.user_id 가 public.profiles(id) 를 참조하는 FK가 있어야 합니다.
-- (기존에는 auth.users(id) 만 참조하고 있어서 "Could not find a relationship" 에러가 발생했습니다.)
-- Supabase Dashboard → SQL Editor에서 실행하세요.

alter table public.trip_members
  drop constraint if exists trip_members_user_id_profiles_fkey;

alter table public.trip_members
  add constraint trip_members_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

notify pgrst, 'reload schema';
