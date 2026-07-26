-- WITHTRIP: trip_flights 테이블
-- Supabase Dashboard → SQL Editor에서 실행하세요.

create table if not exists public.trip_flights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  airline text,
  airline_name text not null default '',
  flight_number text,
  flight_no text,
  departure_airport text,
  arrival_airport text,
  depart_time text,
  departure_time text,
  arrive_time text,
  arrival_time text,
  duration text,
  flight_type text not null default 'OUTBOUND',
  segment_order integer not null default 1,
  created_at timestamptz not null default now()
);

-- 기존 테이블 컬럼 보강 (이미 있으면 무시)
alter table public.trip_flights add column if not exists airline text;
alter table public.trip_flights add column if not exists airline_name text;
alter table public.trip_flights add column if not exists flight_number text;
alter table public.trip_flights add column if not exists flight_no text;
alter table public.trip_flights add column if not exists departure_airport text;
alter table public.trip_flights add column if not exists arrival_airport text;
alter table public.trip_flights add column if not exists depart_time text;
alter table public.trip_flights add column if not exists departure_time text;
alter table public.trip_flights add column if not exists arrive_time text;
alter table public.trip_flights add column if not exists arrival_time text;
alter table public.trip_flights add column if not exists duration text;
alter table public.trip_flights add column if not exists flight_type text;
alter table public.trip_flights add column if not exists segment_order integer;

update public.trip_flights set flight_type = 'OUTBOUND' where flight_type is null;
update public.trip_flights set segment_order = 1 where segment_order is null;

alter table public.trip_flights alter column flight_type set default 'OUTBOUND';
alter table public.trip_flights alter column segment_order set default 1;

comment on table public.trip_flights is '여행별 항공권(비행기 일정)';
comment on column public.trip_flights.flight_type is 'OUTBOUND | RETURN | LAYOVER';
comment on column public.trip_flights.segment_order is '다구간 내 순서 (1-based)';

create index if not exists trip_flights_trip_id_idx on public.trip_flights (trip_id);
create index if not exists trip_flights_trip_type_order_idx
  on public.trip_flights (trip_id, flight_type, segment_order);

alter table public.trip_flights enable row level security;

create policy "trip_flights_select_public"
  on public.trip_flights for select to anon, authenticated using (true);

create policy "trip_flights_insert_public"
  on public.trip_flights for insert to anon, authenticated with check (true);

create policy "trip_flights_update_public"
  on public.trip_flights for update to anon, authenticated using (true) with check (true);

create policy "trip_flights_delete_public"
  on public.trip_flights for delete to anon, authenticated using (true);
