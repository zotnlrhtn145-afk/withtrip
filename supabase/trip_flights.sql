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
  created_by uuid references auth.users (id) on delete set null,
  passenger_ids uuid[] not null default '{}',
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
alter table public.trip_flights add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.trip_flights add column if not exists passenger_ids uuid[] not null default '{}';

update public.trip_flights set flight_type = 'OUTBOUND' where flight_type is null;
update public.trip_flights set segment_order = 1 where segment_order is null;

alter table public.trip_flights alter column flight_type set default 'OUTBOUND';
alter table public.trip_flights alter column segment_order set default 1;
alter table public.trip_flights alter column passenger_ids set default '{}';

comment on table public.trip_flights is '여행별 항공권(비행기 일정)';
comment on column public.trip_flights.flight_type is 'OUTBOUND | RETURN | LAYOVER';
comment on column public.trip_flights.segment_order is '다구간 내 순서 (1-based)';
comment on column public.trip_flights.created_by is '항공권을 등록한 작성자 (auth.users.id)';
comment on column public.trip_flights.passenger_ids is '함께 탑승하는 여행 멤버 user id 목록';

create index if not exists trip_flights_trip_id_idx on public.trip_flights (trip_id);
create index if not exists trip_flights_trip_type_order_idx
  on public.trip_flights (trip_id, flight_type, segment_order);
create index if not exists trip_flights_created_by_idx on public.trip_flights (created_by);

alter table public.trip_flights enable row level security;

drop policy if exists "trip_flights_select_public" on public.trip_flights;
drop policy if exists "trip_flights_insert_public" on public.trip_flights;
drop policy if exists "trip_flights_update_public" on public.trip_flights;
drop policy if exists "trip_flights_delete_public" on public.trip_flights;
drop policy if exists "trip_flights_select_member" on public.trip_flights;
drop policy if exists "trip_flights_insert_member" on public.trip_flights;
drop policy if exists "trip_flights_update_member" on public.trip_flights;
drop policy if exists "trip_flights_delete_member" on public.trip_flights;

create policy "trip_flights_select_member"
  on public.trip_flights for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_flights.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_flights_insert_member"
  on public.trip_flights for insert to authenticated
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_flights.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_flights_update_member"
  on public.trip_flights for update to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_flights.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_flights.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_flights_delete_member"
  on public.trip_flights for delete to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_flights.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );
