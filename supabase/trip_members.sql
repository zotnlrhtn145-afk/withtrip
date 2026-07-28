-- WITHTRIP: trip_members (여행 멤버 + 초대 상태)
-- Supabase Dashboard → SQL Editor에서 실행하세요.

create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text default 'member',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

alter table public.trip_members
  add column if not exists status text;

-- Backfill legacy rows as accepted so existing members keep access
update public.trip_members
set status = 'accepted'
where status is null or status = '';

do $$
begin
  alter table public.trip_members
    alter column status set default 'pending';
exception when others then
  null;
end $$;

create index if not exists trip_members_trip_id_idx on public.trip_members (trip_id);
create index if not exists trip_members_user_id_idx on public.trip_members (user_id);
create index if not exists trip_members_user_status_idx on public.trip_members (user_id, status);

-- Avoid RLS recursion when policies need to check membership
create or replace function public.is_trip_participant(p_trip_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (
      select 1
      from public.trips t
      where t.id = p_trip_id
        and t.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.trip_members tm
      where tm.trip_id = p_trip_id
        and tm.user_id = auth.uid()
        and coalesce(tm.status, 'accepted') = 'accepted'
    );
$$;

revoke all on function public.is_trip_participant(uuid) from public;
grant execute on function public.is_trip_participant(uuid) to authenticated;

alter table public.trip_members enable row level security;

drop policy if exists "trip_members_select_public" on public.trip_members;
drop policy if exists "trip_members_insert_public" on public.trip_members;
drop policy if exists "trip_members_update_public" on public.trip_members;
drop policy if exists "trip_members_delete_public" on public.trip_members;
drop policy if exists "trip_members_select_own" on public.trip_members;
drop policy if exists "trip_members_insert_owner" on public.trip_members;
drop policy if exists "trip_members_update_self" on public.trip_members;
drop policy if exists "trip_members_delete_owner" on public.trip_members;
drop policy if exists "Users can view trip members" on public.trip_members;
drop policy if exists "Users can insert trip members" on public.trip_members;
drop policy if exists "Users can delete trip members" on public.trip_members;

-- Own rows (incl. pending invites) + accepted participants see roster
create policy "trip_members_select_own"
  on public.trip_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_trip_participant(trip_id)
  );

-- Trip owner / accepted member can invite (insert pending)
create policy "trip_members_insert_owner"
  on public.trip_members for insert to authenticated
  with check (public.is_trip_participant(trip_id));

-- Invitee can accept/reject their own row; owner can manage
create policy "trip_members_update_self"
  on public.trip_members for update to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id
        and t.user_id = auth.uid()
    )
  );

create policy "trip_members_delete_owner"
  on public.trip_members for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id
        and t.user_id = auth.uid()
    )
  );
