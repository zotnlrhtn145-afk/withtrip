-- 서버에 접수된 위디 질문의 진행 상태. 질문/답변 본문과 토큰을 중복 보관하지 않습니다.
create table if not exists public.widy_turns (
  question_id uuid primary key references public.trip_messages(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reply_id uuid not null unique,
  state text not null default 'running' check (state in ('running','done','failed')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists widy_turns_user_trip_created on public.widy_turns(user_id,trip_id,created_at desc);
alter table public.widy_turns enable row level security;
revoke all on public.widy_turns from anon, authenticated;
grant select on public.widy_turns to authenticated;
grant all on public.widy_turns to service_role;
create policy widy_turns_own_read on public.widy_turns for select to authenticated
using (user_id = (select auth.uid()) and public.is_trip_participant(trip_id));
