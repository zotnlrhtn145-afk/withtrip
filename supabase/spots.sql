-- WITHTRIP: nearby spots (주변 스팟) + author profile join
-- Run in Supabase Dashboard → SQL Editor

create table if not exists public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_local text,
  category text,
  address text,
  lat double precision not null,
  lng double precision not null,
  rating double precision,
  image_url text,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.spots is '주변 스팟 — 사용자가 등록한 장소 (지도 마커)';
comment on column public.spots.user_id is '등록한 사용자 (profiles.id) — avatar_url / nickname JOIN';
comment on column public.spots.lat is 'WGS84 latitude';
comment on column public.spots.lng is 'WGS84 longitude';

alter table public.spots add column if not exists trip_id uuid references public.trips (id) on delete cascade;

create index if not exists spots_geo_idx on public.spots (lat, lng);
create index if not exists spots_user_id_idx on public.spots (user_id);
create index if not exists spots_trip_id_idx on public.spots (trip_id);
create index if not exists spots_created_at_idx on public.spots (created_at desc);

alter table public.spots enable row level security;

drop policy if exists "spots_select_authenticated" on public.spots;
drop policy if exists "spots_select_public" on public.spots;
drop policy if exists "spots_select_own" on public.spots;
drop policy if exists "spots_insert_own" on public.spots;
drop policy if exists "spots_update_own" on public.spots;
drop policy if exists "spots_delete_own" on public.spots;

create policy "spots_select_own"
  on public.spots for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trip_members tm
      where tm.trip_id = spots.trip_id
        and tm.user_id = auth.uid()
        and tm.status = 'accepted'
    )
    or exists (
      select 1 from public.trips t
      where t.id = spots.trip_id
        and t.user_id = auth.uid()
    )
  );

create policy "spots_insert_own"
  on public.spots for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "spots_update_own"
  on public.spots for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "spots_delete_own"
  on public.spots for delete
  to authenticated
  using (user_id = auth.uid());

-- No global demo seed — new users start with an empty spots map.
