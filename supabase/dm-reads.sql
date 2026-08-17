-- 1:1 대화 읽음 표시.
--
-- 여행 대화방에는 trip_chat_reads 가 있는데 1:1 에는 없었다.
-- 그래서 "안 읽은 몇 개" 를 1:1 방에만 못 붙이고 있었다.
--
-- ⚠️ **방·사람당 한 행**만 쌓는다(메시지마다 아님).
--    메시지마다 읽음을 쌓으면 사람 수 × 메시지 수만큼 늘어난다.
--    "언제까지 읽었나" 하나면 그보다 뒤에 온 것이 안 읽은 것이다.
--    (trip_chat_reads 와 같은 방식 — 두 곳이 달라지면 안 된다)
create table if not exists public.dm_reads (
  thread_id    uuid not null references public.dm_threads(id) on delete cascade,
  user_id      uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

comment on table public.dm_reads is
  '1:1 대화를 어디까지 읽었나. 방·사람당 한 행. 이보다 뒤에 온 메시지가 안 읽은 것.';

alter table public.dm_reads enable row level security;

-- 내 읽음만 쓰고, 그 방 사람들 것은 읽을 수 있다(상대가 읽었는지 보여주려면 필요하다)
drop policy if exists "dm_reads_select_participants" on public.dm_reads;
create policy "dm_reads_select_participants" on public.dm_reads
  for select to authenticated
  using (
    exists (
      select 1 from public.dm_threads t
       where t.id = dm_reads.thread_id
         and (t.user_a = auth.uid() or t.user_b = auth.uid())
    )
  );

drop policy if exists "dm_reads_write_own" on public.dm_reads;
create policy "dm_reads_write_own" on public.dm_reads
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
