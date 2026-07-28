-- WITHTRIP: notifications (초대/친구/클립 알림 인박스)
-- Supabase Dashboard → SQL Editor에서 실행하세요.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- Recipient (invited user)
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Actor who triggered the notification (inviter / requester)
  actor_id uuid references auth.users (id) on delete set null,
  type text not null
    check (type in (
      'trip_invite',
      'clip_invite',
      'friend_request',
      'clip_like',
      'clip_comment'
    )),
  message text not null default '',
  reference_id uuid,
  trip_member_id uuid references public.trip_members (id) on delete cascade,
  is_read boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_user_status_idx on public.notifications (user_id, status);
create index if not exists notifications_type_idx on public.notifications (type);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_insert_authenticated" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;

-- Recipients read their own inbox
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- Authenticated users can create notifications for others (invites / friend requests)
create policy "notifications_insert_authenticated"
  on public.notifications for insert to authenticated
  with check (actor_id = auth.uid() or actor_id is null);

-- Recipient can mark read / accept / dismiss
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Recipient can delete
create policy "notifications_delete_own"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());
