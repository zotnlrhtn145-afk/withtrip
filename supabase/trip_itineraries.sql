-- WITHTRIP: trip_itineraries 테이블
-- Supabase Dashboard → SQL Editor에서 실행하세요.

create table if not exists public.trip_itineraries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_index integer not null check (day_index >= 1),
  time text not null,
  title text not null,
  category text not null default '관광',
  memo text,
  estimated_cost numeric(12, 0),
  image_url text,
  created_at timestamptz not null default now()
);

comment on table public.trip_itineraries is '여행 일차별 일정(타임라인)';
comment on column public.trip_itineraries.day_index is '1-based Day N (여행 시작일 = 1)';
comment on column public.trip_itineraries.time is 'HH:MM (24h)';
comment on column public.trip_itineraries.estimated_cost is '예상 비용 (원 단위, 선택)';

create index if not exists trip_itineraries_trip_id_idx
  on public.trip_itineraries (trip_id);

create index if not exists trip_itineraries_trip_day_time_idx
  on public.trip_itineraries (trip_id, day_index, time);

alter table public.trip_itineraries enable row level security;

create policy "trip_itineraries_select_public"
  on public.trip_itineraries
  for select
  to anon, authenticated
  using (true);

create policy "trip_itineraries_insert_public"
  on public.trip_itineraries
  for insert
  to anon, authenticated
  with check (true);

create policy "trip_itineraries_update_public"
  on public.trip_itineraries
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "trip_itineraries_delete_public"
  on public.trip_itineraries
  for delete
  to anon, authenticated
  using (true);
