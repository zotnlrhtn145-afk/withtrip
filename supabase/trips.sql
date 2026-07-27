-- WITHTRIP: trips 테이블
-- Supabase Dashboard → SQL Editor에서 실행하세요.

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text,
  start_date date,
  end_date date,
  flight_info text,
  cover_image text,
  members jsonb not null default '[]'::jsonb,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.trips is 'WITHTRIP 여행 목록';
comment on column public.trips.members is '동행 멤버 JSON 배열 (예: [{"id":"...","name":"..."}])';
comment on column public.trips.user_id is '여행을 생성한 유저 (auth.users.id)';

-- Existing projects: add owner column if missing
alter table public.trips add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists trips_created_at_idx on public.trips (created_at desc);
create index if not exists trips_start_date_idx on public.trips (start_date);
create index if not exists trips_user_id_idx on public.trips (user_id);

-- Row Level Security (필요에 따라 정책을 조정하세요)
alter table public.trips enable row level security;

drop policy if exists "trips_select_public" on public.trips;
drop policy if exists "trips_insert_public" on public.trips;
drop policy if exists "trips_update_public" on public.trips;
drop policy if exists "trips_delete_public" on public.trips;
drop policy if exists "trips_select_own" on public.trips;
drop policy if exists "trips_insert_own" on public.trips;
drop policy if exists "trips_update_own" on public.trips;
drop policy if exists "trips_delete_own" on public.trips;

-- Authenticated users see/manage their own trips; allow reading null-owner legacy rows while migrating
create policy "trips_select_own"
  on public.trips
  for select
  to authenticated
  using (user_id = auth.uid() or user_id is null);

-- Members can also read trips they joined via trip_members
drop policy if exists "trips_select_member" on public.trips;
create policy "trips_select_member"
  on public.trips
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.trip_members tm
      where tm.trip_id = trips.id
        and tm.user_id = auth.uid()
    )
  );

create policy "trips_insert_own"
  on public.trips
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "trips_update_own"
  on public.trips
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "trips_delete_own"
  on public.trips
  for delete
  to authenticated
  using (user_id = auth.uid());
