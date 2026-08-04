-- WITHTRIP: 친구 간 1:1 개인 채팅 — dm_threads + dm_messages
-- 두 사용자당 스레드 하나(user_a < user_b 정규화). 참여자만 읽고 쓸 수 있다.
-- Supabase Dashboard → SQL Editor에서 실행하세요.

-- ─────────────────────────────────────────────────────────────
-- 1) 스레드
-- ─────────────────────────────────────────────────────────────
create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint dm_threads_order check (user_a < user_b),
  unique (user_a, user_b)
);

alter table public.dm_threads enable row level security;

drop policy if exists "dm_threads_select_participant" on public.dm_threads;
create policy "dm_threads_select_participant"
  on public.dm_threads for select to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

-- 참여자 판별 (RLS 재귀 방지용 security definer)
create or replace function public.is_dm_participant(p_thread uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.dm_threads t
    where t.id = p_thread and (t.user_a = auth.uid() or t.user_b = auth.uid())
  );
$$;
revoke all on function public.is_dm_participant(uuid) from public;
grant execute on function public.is_dm_participant(uuid) to authenticated;

-- 스레드 생성/조회 RPC (정규화 + upsert). 직접 insert 대신 이걸 쓴다.
create or replace function public.get_or_create_dm_thread(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_a uuid; v_b uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_other is null or p_other = auth.uid() then raise exception 'invalid target'; end if;
  v_a := least(auth.uid(), p_other);
  v_b := greatest(auth.uid(), p_other);
  insert into public.dm_threads (user_a, user_b) values (v_a, v_b)
    on conflict (user_a, user_b) do nothing;
  select id into v_id from public.dm_threads where user_a = v_a and user_b = v_b;
  return v_id;
end $$;
revoke all on function public.get_or_create_dm_thread(uuid) from public;
grant execute on function public.get_or_create_dm_thread(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2) 메시지
-- ─────────────────────────────────────────────────────────────
create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists dm_messages_thread_created_idx
  on public.dm_messages (thread_id, created_at desc);

alter table public.dm_messages enable row level security;

drop policy if exists "dm_messages_select_participant" on public.dm_messages;
create policy "dm_messages_select_participant"
  on public.dm_messages for select to authenticated
  using (public.is_dm_participant(thread_id));

drop policy if exists "dm_messages_insert_participant" on public.dm_messages;
create policy "dm_messages_insert_participant"
  on public.dm_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_dm_participant(thread_id));

do $$ begin
  alter publication supabase_realtime add table public.dm_messages;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
