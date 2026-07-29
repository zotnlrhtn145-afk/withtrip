-- WITHTRIP: notifications (초대/친구/클립 알림 인박스)
-- Supabase Dashboard → SQL Editor에서 실행하세요.
-- 기존 테이블이 있어도 sender_id / 정책을 보강합니다.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- Recipient (invited user) — 알림을 받는 사람
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Sender / actor who triggered the notification (초대한 사람)
  sender_id uuid references auth.users (id) on delete set null,
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
  trip_member_id uuid references public.trip_members (id) on delete set null,
  is_read boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'rejected', 'dismissed')),
  created_at timestamptz not null default now()
);

-- Legacy installs: add missing columns safely
alter table public.notifications
  add column if not exists sender_id uuid references auth.users (id) on delete set null;

alter table public.notifications
  add column if not exists actor_id uuid references auth.users (id) on delete set null;

alter table public.notifications
  add column if not exists trip_member_id uuid references public.trip_members (id) on delete set null;

alter table public.notifications
  add column if not exists is_read boolean not null default false;

alter table public.notifications
  add column if not exists status text not null default 'pending';

alter table public.notifications
  add column if not exists message text not null default '';

alter table public.notifications
  add column if not exists reference_id uuid;

alter table public.notifications
  add column if not exists type text;

-- Keep sender_id / actor_id in sync for older clients
update public.notifications
set sender_id = coalesce(sender_id, actor_id)
where sender_id is null and actor_id is not null;

update public.notifications
set actor_id = coalesce(actor_id, sender_id)
where actor_id is null and sender_id is not null;

-- Allow 'declined' status (history-preserving reject)
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'notifications'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';

  if constraint_name is not null then
    execute format('alter table public.notifications drop constraint %I', constraint_name);
  end if;

  alter table public.notifications
    add constraint notifications_status_check
    check (status in ('pending', 'accepted', 'declined', 'rejected', 'dismissed'));
exception when others then
  -- Constraint may already exist with the correct definition
  null;
end $$;

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

-- Inviter can create a notification for another user
-- actor_id (canonical) or sender_id (legacy mirror) must be the current user
create policy "notifications_insert_authenticated"
  on public.notifications for insert to authenticated
  with check (
    coalesce(actor_id, sender_id) = auth.uid()
  );

-- Recipient can mark read / accept / dismiss
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Recipient can delete their own notifications
create policy "notifications_delete_own"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC: create_notification_safe
-- Direct INSERT hits RLS 42501 for cross-user rows; this SECURITY DEFINER
-- function inserts on behalf of the authenticated actor.
-- ---------------------------------------------------------------------------
create or replace function public.create_notification_safe(
  p_user_id uuid,
  p_actor_id uuid,
  p_type text,
  p_message text,
  p_reference_id uuid default null,
  p_trip_member_id uuid default null
)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  new_row public.notifications;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Only the signed-in user may create notifications as themselves
  if p_actor_id is distinct from auth.uid() then
    raise exception 'actor_id must match authenticated user';
  end if;

  if p_user_id is null then
    raise exception 'user_id (recipient) is required';
  end if;

  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'message is required';
  end if;

  if p_type is null or length(trim(p_type)) = 0 then
    raise exception 'type is required';
  end if;

  if p_user_id = p_actor_id then
    raise exception 'cannot notify self';
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    sender_id,
    type,
    message,
    reference_id,
    trip_member_id,
    is_read,
    status
  ) values (
    p_user_id,
    p_actor_id,
    p_actor_id,
    p_type,
    p_message,
    p_reference_id,
    p_trip_member_id,
    false,
    'pending'
  )
  returning * into new_row;

  return new_row;
end;
$$;

revoke all on function public.create_notification_safe(uuid, uuid, text, text, uuid, uuid) from public;
grant execute on function public.create_notification_safe(uuid, uuid, text, text, uuid, uuid) to authenticated;
