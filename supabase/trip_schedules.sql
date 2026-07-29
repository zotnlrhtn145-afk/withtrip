-- WITHTRIP: trip_schedules 테이블
-- Supabase Dashboard → SQL Editor에서 실행하세요.

create table if not exists public.trip_schedules (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_number integer not null check (day_number >= 1 and day_number <= 7),
  category text not null default '관광',
  place_name text not null default '',
  visit_time text,
  address text,
  phone_number text,
  memo text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.trip_schedules add column if not exists day_number integer;
alter table public.trip_schedules add column if not exists category text;
alter table public.trip_schedules add column if not exists place_name text;
alter table public.trip_schedules add column if not exists visit_time text;
alter table public.trip_schedules add column if not exists address text;
alter table public.trip_schedules add column if not exists phone_number text;
alter table public.trip_schedules add column if not exists memo text;
alter table public.trip_schedules add column if not exists created_by uuid references auth.users (id) on delete set null;

update public.trip_schedules set category = '관광' where category is null or category = '';

comment on table public.trip_schedules is '여행 일차별 일정(장소)';
comment on column public.trip_schedules.day_number is '1-based Day N (1~7)';
comment on column public.trip_schedules.category is '이동 | 숙소 | 관광 | 식사 | 카페';
comment on column public.trip_schedules.visit_time is 'HH:MM (24h), optional';
comment on column public.trip_schedules.created_by is '일정을 등록한 작성자 (auth.users.id)';

-- Legacy rename support: day_index → day_number
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trip_schedules' and column_name = 'day_index'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trip_schedules' and column_name = 'day_number'
  ) then
    alter table public.trip_schedules rename column day_index to day_number;
  end if;
end $$;

comment on table public.trip_schedules is '여행 일차별 일정(장소)';
comment on column public.trip_schedules.day_number is '1-based Day N (1~7)';
comment on column public.trip_schedules.visit_time is 'HH:MM (24h), optional';

create index if not exists trip_schedules_trip_id_idx
  on public.trip_schedules (trip_id);

create index if not exists trip_schedules_trip_day_time_idx
  on public.trip_schedules (trip_id, day_number, visit_time);

create index if not exists trip_schedules_created_by_idx
  on public.trip_schedules (created_by);

alter table public.trip_schedules enable row level security;

drop policy if exists "trip_schedules_select_public" on public.trip_schedules;
drop policy if exists "trip_schedules_insert_public" on public.trip_schedules;
drop policy if exists "trip_schedules_update_public" on public.trip_schedules;
drop policy if exists "trip_schedules_delete_public" on public.trip_schedules;
drop policy if exists "trip_schedules_select_member" on public.trip_schedules;
drop policy if exists "trip_schedules_insert_member" on public.trip_schedules;
drop policy if exists "trip_schedules_update_member" on public.trip_schedules;
drop policy if exists "trip_schedules_delete_member" on public.trip_schedules;

create policy "trip_schedules_select_member"
  on public.trip_schedules for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_schedules.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_schedules_insert_member"
  on public.trip_schedules for insert to authenticated
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_schedules.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_schedules_update_member"
  on public.trip_schedules for update to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_schedules.trip_id
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
      where t.id = trip_schedules.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_schedules_delete_member"
  on public.trip_schedules for delete to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_schedules.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );
