-- 대화 목록에서 **내 눈에만** 숨긴 방.
--
-- ⚠️ 방을 진짜로 지우면 안 된다. 단톡은 남들이 계속 쓰고 있고,
--    1:1 은 상대에게도 대화가 남아 있다. "삭제"는 **내 목록에서 치우는 것**이다.
-- ⚠️ 숨긴 뒤 새 메시지가 오면 **다시 보여준다**(카톡과 같다).
--    그래서 언제 숨겼는지를 남긴다 — 그 시각 이후 메시지가 있으면 목록에 되살린다.

create table if not exists public.chat_hides (
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 여행 단톡이면 trip_id, 1:1 이면 thread_id 중 하나만 채운다
  trip_id uuid,
  thread_id uuid,
  hidden_at timestamptz not null default now(),
  primary key (user_id, trip_id, thread_id)
);

-- 한쪽만 채워야 한다
alter table public.chat_hides drop constraint if exists chat_hides_one_target;
alter table public.chat_hides add constraint chat_hides_one_target
  check ((trip_id is not null and thread_id is null) or (trip_id is null and thread_id is not null));

create unique index if not exists chat_hides_trip_uniq
  on public.chat_hides (user_id, trip_id) where trip_id is not null;
create unique index if not exists chat_hides_thread_uniq
  on public.chat_hides (user_id, thread_id) where thread_id is not null;

alter table public.chat_hides enable row level security;

drop policy if exists chat_hides_own on public.chat_hides;
create policy chat_hides_own on public.chat_hides
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
