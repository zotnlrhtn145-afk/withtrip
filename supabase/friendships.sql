-- WITHTRIP: friendships (친구 요청/수락)
-- user_id = 요청 보낸 사람, friend_id = 요청 받은 사람
-- Supabase Dashboard → SQL Editor에서 실행하세요.

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint friendships_no_self check (user_id <> friend_id),
  unique (user_id, friend_id)
);

comment on table public.friendships is '친구 요청/수락 관계';
comment on column public.friendships.user_id is '요청을 보낸 사용자 (profiles.id)';
comment on column public.friendships.friend_id is '요청을 받은 사용자 (profiles.id)';

create index if not exists friendships_user_id_idx on public.friendships (user_id);
create index if not exists friendships_friend_id_idx on public.friendships (friend_id);
create index if not exists friendships_status_idx on public.friendships (status);

alter table public.friendships enable row level security;

drop policy if exists "friendships_select_own" on public.friendships;
drop policy if exists "friendships_insert_own" on public.friendships;
drop policy if exists "friendships_update_participant" on public.friendships;
drop policy if exists "friendships_delete_participant" on public.friendships;

-- Either side of the friendship can see the row
create policy "friendships_select_own"
  on public.friendships for select to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

-- Only the requester can create a new pending request as themselves
create policy "friendships_insert_own"
  on public.friendships for insert to authenticated
  with check (user_id = auth.uid());

-- Either side can update status (accept/reject) on their own row
create policy "friendships_update_participant"
  on public.friendships for update to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid())
  with check (user_id = auth.uid() or friend_id = auth.uid());

-- Either side can delete (reject / cancel / unfriend)
create policy "friendships_delete_participant"
  on public.friendships for delete to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());
