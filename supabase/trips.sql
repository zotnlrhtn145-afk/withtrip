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
  created_at timestamptz not null default now()
);

comment on table public.trips is 'WITHTRIP 여행 목록';
comment on column public.trips.members is '동행 멤버 JSON 배열 (예: [{"id":"...","name":"..."}])';

create index if not exists trips_created_at_idx on public.trips (created_at desc);
create index if not exists trips_start_date_idx on public.trips (start_date);

-- Row Level Security (필요에 따라 정책을 조정하세요)
alter table public.trips enable row level security;

create policy "trips_select_public"
  on public.trips
  for select
  to anon, authenticated
  using (true);

create policy "trips_insert_public"
  on public.trips
  for insert
  to anon, authenticated
  with check (true);

create policy "trips_update_public"
  on public.trips
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "trips_delete_public"
  on public.trips
  for delete
  to anon, authenticated
  using (true);
