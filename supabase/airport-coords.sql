-- 공항에 좌표를 준다.
--
-- 왜 필요한가: 교통편을 등록하면 「인천국제공항 출발」·「나리타국제공항 도착」
-- 일정이 자동으로 만들어지는데 **좌표가 없다.** 그래서
--
--   · 지도에 아예 안 찍힌다 (그날 첫 핀이 5번부터 시작하는 이유)
--   · 비행 구간이 동선에 없어서 "하루 따라가기" 에 ✈️ 가 한 번도 안 나온다
--   · 공항에서 첫 목적지까지 얼마나 걸리는지도 알 수 없다
--
-- ⚠️ **거리는 여기서 손대지 않는다.** 좌표가 생기면 "총 이동거리" 에 비행
--    1,000km 가 그대로 얹혀서, 도쿄 시내를 도는 감각을 보려던 숫자가 쓸모없어진다.
--    비행 구간을 거리에서 빼는 건 화면 쪽에서 한다(course 화면 주석 참고).
--
-- ⚠️ 좌표는 **공항 표에 둔다.** 일정 행에 직접 박으면 공항 위치를 고칠 때
--    이미 만들어진 일정들은 그대로 남는다.

alter table public.airport_names
  add column if not exists lat double precision,
  add column if not exists lng double precision;

comment on column public.airport_names.lat is '공항 위치 — 교통편 일정에 자동으로 채워진다';

update public.airport_names set lat = v.lat, lng = v.lng from (values
  -- 한국
  ('ICN', 37.4602, 126.4407), ('GMP', 37.5583, 126.7906), ('PUS', 35.1795, 128.9382),
  ('CJU', 33.5113, 126.4930), ('TAE', 35.8941, 128.6586), ('CJJ', 36.7166, 127.4991),
  ('KWJ', 35.1264, 126.8089), ('MWX', 34.9914, 126.3828), ('RSU', 34.8423, 127.6169),
  ('USN', 35.5936, 129.3517), ('KPO', 35.9878, 129.4203), ('WJU', 37.4381, 127.9603),
  ('YNY', 38.0613, 128.6690), ('KUV', 35.9038, 126.6158), ('HIN', 35.0885, 128.0703),
  -- 일본
  ('NRT', 35.7720, 140.3929), ('HND', 35.5494, 139.7798), ('KIX', 34.4347, 135.2440),
  ('FUK', 33.5859, 130.4506), ('CTS', 42.7752, 141.6923), ('OKA', 26.1958, 127.6459),
  -- 동남아·중화권
  ('BKK', 13.6900, 100.7501), ('DMK', 13.9126, 100.6068),
  ('SGN', 10.8188, 106.6520), ('HAN', 21.2212, 105.8072), ('DAD', 16.0439, 108.1994),
  ('SIN',  1.3644, 103.9915), ('HKG', 22.3080, 113.9185), ('TPE', 25.0777, 121.2328),
  -- 중동
  ('DXB', 25.2532,  55.3657),
  -- 미주
  ('LAX', 33.9416, -118.4085), ('SFO', 37.6213, -122.3790), ('JFK', 40.6413, -73.7781),
  -- 유럽
  ('LHR', 51.4700,  -0.4543), ('CDG', 49.0097, 2.5479),
  -- 오세아니아
  ('SYD', -33.9399, 151.1753)
) as v(code, lat, lng)
where public.airport_names.code = v.code;

/**
 * 코드로 공항 좌표를 찾는다. 공항이 아니면(역·자유입력) 아무것도 안 준다.
 *
 * ⚠️ 세 글자일 때만 본다. `포항` 같은 자유입력을 코드로 넘기면 엉뚱한 공항이
 *    걸릴 수 있다.
 */
create or replace function public.wt_airport_point(p text)
returns table (lat double precision, lng double precision)
language sql stable as $$
  select a.lat, a.lng
    from public.airport_names a
   where length(btrim(coalesce(p, ''))) = 3
     and a.code = upper(btrim(p))
     and a.lat is not null
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 교통편 → 일정 자동 동기화에 좌표를 얹는다.
-- (원본 함수는 schedule_auto_sync.sql. 여기서는 좌표만 채우도록 다시 만든다)
-- ---------------------------------------------------------------------------

create or replace function public.wt_sync_schedule_transport()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_carrier text; v_dep_place text; v_arr_place text; v_day int; v_arr text;
  v_dep_lat double precision; v_dep_lng double precision;
  v_arr_lat double precision; v_arr_lng double precision;
begin
  if TG_OP = 'DELETE' then
    delete from public.trip_schedules
      where source_id = OLD.id and source_type in ('transport_depart', 'transport_arrive');
    return OLD;
  end if;

  v_carrier := nullif(btrim(NEW.carrier_name), '');
  v_dep_place := public.wt_airport_label(NEW.from_label);
  v_arr_place := public.wt_airport_label(NEW.to_label);
  v_dep_place := case
    when v_dep_place <> ''      then v_dep_place || ' 출발'
    when v_carrier is not null  then v_carrier || ' 출발'
    else '출발'
  end;
  v_arr_place := case
    when v_arr_place <> ''      then v_arr_place || ' 도착'
    when v_carrier is not null  then v_carrier || ' 도착'
    else '도착'
  end;

  -- 공항이면 좌표를 얻는다. 역·자유입력이면 null 이고, 예전처럼 지도에 안 찍힌다.
  select lat, lng into v_dep_lat, v_dep_lng from public.wt_airport_point(NEW.from_label);
  select lat, lng into v_arr_lat, v_arr_lng from public.wt_airport_point(NEW.to_label);

  if nullif(btrim(NEW.depart_date), '') is not null then
    v_day := public.wt_schedule_day_number(NEW.trip_id, NEW.depart_date);
    insert into public.trip_schedules
      (trip_id, day_number, category, place_name, visit_time, memo, created_by, source_type, source_id, member_ids, lat, lng)
    values
      (NEW.trip_id, v_day, '이동', v_dep_place, nullif(btrim(NEW.depart_time), ''),
       v_carrier, NEW.created_by, 'transport_depart', NEW.id, coalesce(NEW.passenger_ids, '{}'::uuid[]),
       v_dep_lat, v_dep_lng)
    on conflict (source_type, source_id) do update set
      trip_id = excluded.trip_id, day_number = excluded.day_number, category = excluded.category,
      place_name = excluded.place_name, visit_time = excluded.visit_time, memo = excluded.memo,
      member_ids = excluded.member_ids, lat = excluded.lat, lng = excluded.lng;
  else
    delete from public.trip_schedules where source_type = 'transport_depart' and source_id = NEW.id;
  end if;

  v_arr := coalesce(nullif(btrim(NEW.arrive_date), ''), nullif(btrim(NEW.depart_date), ''));
  if v_arr is not null then
    v_day := public.wt_schedule_day_number(NEW.trip_id, v_arr);
    insert into public.trip_schedules
      (trip_id, day_number, category, place_name, visit_time, memo, created_by, source_type, source_id, member_ids, lat, lng)
    values
      (NEW.trip_id, v_day, '이동', v_arr_place, nullif(btrim(NEW.arrive_time), ''),
       v_carrier, NEW.created_by, 'transport_arrive', NEW.id, coalesce(NEW.passenger_ids, '{}'::uuid[]),
       v_arr_lat, v_arr_lng)
    on conflict (source_type, source_id) do update set
      trip_id = excluded.trip_id, day_number = excluded.day_number, category = excluded.category,
      place_name = excluded.place_name, visit_time = excluded.visit_time, memo = excluded.memo,
      member_ids = excluded.member_ids, lat = excluded.lat, lng = excluded.lng;
  else
    delete from public.trip_schedules where source_type = 'transport_arrive' and source_id = NEW.id;
  end if;

  return NEW;
end $$;

/*
  이미 만들어져 있는 교통편 일정에도 좌표를 채운다.
  ⚠️ **이름으로 공항을 되짚는다.** 일정에는 원본 교통편의 `from_label` 이
     남아 있지 않고 "인천국제공항 출발" 같은 사람 말만 있다. 그래서 원본
     교통편을 타고 올라가 좌표를 얻는다.
*/
update public.trip_schedules s
   set lat  = (select lat from public.wt_airport_point(
                 case when s.source_type = 'transport_depart' then t.from_label else t.to_label end)),
       lng  = (select lng from public.wt_airport_point(
                 case when s.source_type = 'transport_depart' then t.from_label else t.to_label end))
  from public.trip_transports t
 where s.source_id = t.id
   and s.source_type in ('transport_depart', 'transport_arrive')
   and s.lat is null;
