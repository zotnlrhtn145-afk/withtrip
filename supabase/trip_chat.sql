-- WITHTRIP: 여행(클립)별 실시간 채팅 — trip_messages + trip_chat_reads
-- 여행 하나 = 채팅방 하나. 참여자(소유자 + 수락된 멤버)만 읽고 쓸 수 있다.
-- Supabase Dashboard → SQL Editor에서 실행하세요.
-- (public.is_trip_participant(uuid) 함수가 먼저 있어야 함 — trip_members.sql 참고)

-- ─────────────────────────────────────────────────────────────
-- 1) 메시지
-- ─────────────────────────────────────────────────────────────
create table if not exists public.trip_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  -- 낙관적 업데이트 중복 제거용(클라이언트가 만든 임시 id)
  client_id text,
  created_at timestamptz not null default now()
);

-- PostgREST 임베드(보낸 사람 프로필) 조인을 위해 profiles FK도 추가
do $$ begin
  alter table public.trip_messages
    add constraint trip_messages_user_id_profiles_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;
exception when duplicate_object then null; when undefined_table then null; end $$;

create index if not exists trip_messages_trip_id_created_idx
  on public.trip_messages (trip_id, created_at desc);
create index if not exists trip_messages_user_id_idx
  on public.trip_messages (user_id);

alter table public.trip_messages enable row level security;

drop policy if exists "trip_messages_select_participant" on public.trip_messages;
drop policy if exists "trip_messages_insert_participant" on public.trip_messages;
drop policy if exists "trip_messages_update_own" on public.trip_messages;
drop policy if exists "trip_messages_delete_own" on public.trip_messages;

-- 참여자만 방의 메시지를 볼 수 있다
create policy "trip_messages_select_participant"
  on public.trip_messages for select to authenticated
  using (public.is_trip_participant(trip_id));

-- 본인이 참여자인 방에만, 본인 명의로 전송
create policy "trip_messages_insert_participant"
  on public.trip_messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_trip_participant(trip_id));

-- 본인 메시지만 수정/삭제
create policy "trip_messages_update_own"
  on public.trip_messages for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "trip_messages_delete_own"
  on public.trip_messages for delete to authenticated
  using (user_id = auth.uid());

-- 실시간 구독 활성화
do $$ begin
  alter publication supabase_realtime add table public.trip_messages;
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- 2) 읽음 표시(안 읽은 개수/배지용) — 방마다 마지막으로 읽은 시각
-- ─────────────────────────────────────────────────────────────
create table if not exists public.trip_chat_reads (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

alter table public.trip_chat_reads enable row level security;

drop policy if exists "trip_chat_reads_rw_own" on public.trip_chat_reads;
create policy "trip_chat_reads_rw_own"
  on public.trip_chat_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';
