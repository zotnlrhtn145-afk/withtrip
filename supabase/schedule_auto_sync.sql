-- 이동수단·숙소 → 여행 일정(trip_schedules) 자동 동기화
-- 트리거 기반: 웹/앱 어느 쪽에서 등록·수정·삭제하든 DB가 단일 출처로 일정을 만든다.
-- 자동 생성 항목은 source_type/source_id 로 원본과 연결되고, member_ids 로 함께하는 멤버를 담는다.

-- 1) trip_schedules 확장 컬럼 ------------------------------------------------
alter table public.trip_schedules
  add column if not exists source_type text,
  add column if not exists source_id   uuid,
  add column if not exists member_ids  uuid[] not null default '{}';

-- 원본 1개당 일정 1개(그리고 transport 는 출발/도착 2종류) → (source_type, source_id) 유니크.
-- 수동 일정은 (null, null) 이며 Postgres 는 NULL 을 서로 다르게 취급하므로 공존 가능.
create unique index if not exists trip_schedules_source_uidx
  on public.trip_schedules (source_type, source_id);

-- 2) 날짜(text) → Day 번호 계산 헬퍼 ---------------------------------------
create or replace function public.wt_schedule_day_number(p_trip_id uuid, p_date text)
returns int language plpgsql stable as $$
declare v_start date; v_d date; v_n int;
begin
  select start_date into v_start from public.trips where id = p_trip_id;
  if v_start is null then return 1; end if;
  begin
    v_d := to_date(regexp_replace(left(btrim(p_date), 10), '[./]', '-', 'g'), 'YYYY-MM-DD');
  exception when others then
    return 1;
  end;
  v_n := (v_d - v_start) + 1;
  if v_n < 1  then return 1;  end if;
  if v_n > 60 then return 60; end if;
  return v_n;
end $$;

-- 3) 이동수단 → 일정(출발 + 도착 2건) ---------------------------------------
create or replace function public.wt_sync_schedule_transport()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_from text; v_to text; v_base text; v_carrier text; v_day int; v_arr text;
begin
  if TG_OP = 'DELETE' then
    delete from public.trip_schedules
      where source_id = OLD.id and source_type in ('transport_depart', 'transport_arrive');
    return OLD;
  end if;

  v_from    := coalesce(nullif(btrim(NEW.from_label), ''), '');
  v_to      := coalesce(nullif(btrim(NEW.to_label), ''), '');
  v_carrier := nullif(btrim(NEW.carrier_name), '');
  v_base := case
    when v_from <> '' and v_to <> '' then v_from || ' → ' || v_to
    when v_carrier is not null        then v_carrier
    when v_from <> ''                 then v_from
    when v_to <> ''                   then v_to
    else '이동'
  end;

  -- 출발 일정
  if nullif(btrim(NEW.depart_date), '') is not null then
    v_day := public.wt_schedule_day_number(NEW.trip_id, NEW.depart_date);
    insert into public.trip_schedules
      (trip_id, day_number, category, place_name, visit_time, memo, created_by, source_type, source_id, member_ids)
    values
      (NEW.trip_id, v_day, '이동', v_base || ' (출발)', nullif(btrim(NEW.depart_time), ''),
       v_carrier, NEW.created_by, 'transport_depart', NEW.id, coalesce(NEW.passenger_ids, '{}'::uuid[]))
    on conflict (source_type, source_id) do update set
      trip_id = excluded.trip_id, day_number = excluded.day_number, category = excluded.category,
      place_name = excluded.place_name, visit_time = excluded.visit_time, memo = excluded.memo,
      member_ids = excluded.member_ids;
  else
    delete from public.trip_schedules where source_type = 'transport_depart' and source_id = NEW.id;
  end if;

  -- 도착 일정 (도착 날짜가 없으면 출발 날짜에 배치)
  v_arr := coalesce(nullif(btrim(NEW.arrive_date), ''), nullif(btrim(NEW.depart_date), ''));
  if v_arr is not null then
    v_day := public.wt_schedule_day_number(NEW.trip_id, v_arr);
    insert into public.trip_schedules
      (trip_id, day_number, category, place_name, visit_time, memo, created_by, source_type, source_id, member_ids)
    values
      (NEW.trip_id, v_day, '이동', v_base || ' (도착)', nullif(btrim(NEW.arrive_time), ''),
       v_carrier, NEW.created_by, 'transport_arrive', NEW.id, coalesce(NEW.passenger_ids, '{}'::uuid[]))
    on conflict (source_type, source_id) do update set
      trip_id = excluded.trip_id, day_number = excluded.day_number, category = excluded.category,
      place_name = excluded.place_name, visit_time = excluded.visit_time, memo = excluded.memo,
      member_ids = excluded.member_ids;
  else
    delete from public.trip_schedules where source_type = 'transport_arrive' and source_id = NEW.id;
  end if;

  return NEW;
end $$;

-- 4) 숙소 → 일정(체크인 1건) -------------------------------------------------
create or replace function public.wt_sync_schedule_accommodation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_day int;
begin
  if TG_OP = 'DELETE' then
    delete from public.trip_schedules where source_type = 'accommodation' and source_id = OLD.id;
    return OLD;
  end if;

  if nullif(btrim(NEW.check_in_date), '') is not null then
    v_day := public.wt_schedule_day_number(NEW.trip_id, NEW.check_in_date);
    insert into public.trip_schedules
      (trip_id, day_number, category, place_name, visit_time, address, phone_number, created_by, source_type, source_id, member_ids)
    values
      (NEW.trip_id, v_day, '숙소',
       coalesce(nullif(btrim(NEW.name), ''), '숙소') || ' (체크인)',
       nullif(btrim(NEW.check_in_time), ''),
       nullif(btrim(NEW.address), ''), nullif(btrim(NEW.phone_number), ''),
       NEW.created_by, 'accommodation', NEW.id, coalesce(NEW.guest_ids, '{}'::uuid[]))
    on conflict (source_type, source_id) do update set
      trip_id = excluded.trip_id, day_number = excluded.day_number, place_name = excluded.place_name,
      visit_time = excluded.visit_time, address = excluded.address, phone_number = excluded.phone_number,
      member_ids = excluded.member_ids;
  else
    delete from public.trip_schedules where source_type = 'accommodation' and source_id = NEW.id;
  end if;

  return NEW;
end $$;

-- 5) 트리거 부착 -------------------------------------------------------------
drop trigger if exists wt_sched_transport on public.trip_transports;
create trigger wt_sched_transport
  after insert or update or delete on public.trip_transports
  for each row execute function public.wt_sync_schedule_transport();

drop trigger if exists wt_sched_accommodation on public.trip_accommodations;
create trigger wt_sched_accommodation
  after insert or update or delete on public.trip_accommodations
  for each row execute function public.wt_sync_schedule_accommodation();

-- 6) 기존 데이터 백필 (no-op UPDATE 로 트리거 재실행 → 멱등) ------------------
update public.trip_transports     set trip_id = trip_id;
update public.trip_accommodations set trip_id = trip_id;
