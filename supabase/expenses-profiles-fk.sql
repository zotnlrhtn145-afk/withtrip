-- WITHTRIP: expenses.payer_id 에 profiles FK 추가
-- PostgREST의 `payer:profiles!expenses_payer_id_fkey(...)` 임베드 조인이 동작하려면
-- expenses.payer_id 가 public.profiles(id) 를 참조하는 FK가 있어야 합니다.
-- (기존에는 auth.users(id) 만 참조하고 있어서 "Could not find a relationship" 에러가 발생했습니다.)
-- Supabase Dashboard → SQL Editor에서 실행하세요.

alter table public.expenses
  drop constraint if exists expenses_payer_id_fkey;

alter table public.expenses
  add constraint expenses_payer_id_fkey
  foreign key (payer_id) references public.profiles (id) on delete cascade;

notify pgrst, 'reload schema';
