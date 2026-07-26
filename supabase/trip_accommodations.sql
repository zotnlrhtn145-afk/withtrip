-- WITHTRIP: trip_accommodations 테이블
-- Supabase Dashboard → SQL Editor에서 실행하세요.

create table if not exists public.trip_accommodations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null default '',
  address text,
  check_in_date text,
  check_in_time text,
  check_out_date text,
  check_out_time text,
  phone_number text,
  memo text,
  created_at timestamptz not null default now()
);

alter table public.trip_accommodations add column if not exists name text;
alter table public.trip_accommodations add column if not exists address text;
alter table public.trip_accommodations add column if not exists check_in_date text;
alter table public.trip_accommodations add column if not exists check_in_time text;
alter table public.trip_accommodations add column if not exists check_out_date text;
alter table public.trip_accommodations add column if not exists check_out_time text;
alter table public.trip_accommodations add column if not exists phone_number text;
alter table public.trip_accommodations add column if not exists memo text;

-- Legacy: booking_code → phone_number 마이그레이션
alter table public.trip_accommodations add column if not exists booking_code text;
update public.trip_accommodations
set phone_number = booking_code
where (phone_number is null or phone_number = '')
  and booking_code is not null
  and booking_code <> '';

comment on table public.trip_accommodations is '여행별 숙소·호텔 정보';
comment on column public.trip_accommodations.phone_number is '숙소 전화번호';

create index if not exists trip_accommodations_trip_id_idx
  on public.trip_accommodations (trip_id);

create index if not exists trip_accommodations_check_in_idx
  on public.trip_accommodations (trip_id, check_in_date);

alter table public.trip_accommodations enable row level security;

create policy "trip_accommodations_select_public"
  on public.trip_accommodations for select to anon, authenticated using (true);

create policy "trip_accommodations_insert_public"
  on public.trip_accommodations for insert to anon, authenticated with check (true);

create policy "trip_accommodations_update_public"
  on public.trip_accommodations for update to anon, authenticated using (true) with check (true);

create policy "trip_accommodations_delete_public"
  on public.trip_accommodations for delete to anon, authenticated using (true);
