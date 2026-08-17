-- 1:1 대화 알림 끄기.
--
-- 여행 대화방에는 trip_chat_mutes 가 있는데 1:1 에는 없었다 — 방마다 끌 수 있어야 하는데
-- 1:1 만 못 껐다.
--
-- ⚠️ **행이 있으면 꺼진 것**이다. 켜면 지운다.
--    on/off 컬럼을 두면 "기본값이 뭐냐"를 매번 따져야 하는데 알림은 기본이 켜짐이다.
--    (trip_chat_mutes 와 같은 방식 — 두 곳이 달라지면 안 된다)
create table if not exists public.dm_mutes (
  thread_id  uuid not null references public.dm_threads(id) on delete cascade,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

comment on table public.dm_mutes is
  '1:1 대화 알림을 끈 사람. 행이 있으면 꺼진 것. 켜면 지운다.';

alter table public.dm_mutes enable row level security;

-- 본인 설정만 보고 바꾼다 (남이 껐는지는 알 필요가 없다)
drop policy if exists "dm_mutes_rw_own" on public.dm_mutes;
create policy "dm_mutes_rw_own" on public.dm_mutes for all
  to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
