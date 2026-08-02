-- WITHTRIP: trip_flights → trip_transports 일반화 (이동수단: 비행기/기차/자가용)
-- Supabase Dashboard → SQL Editor에서 실행하세요. 기존 항공권 데이터는 보존됩니다.

alter table public.trip_flights rename to trip_transports;

alter table public.trip_transports add column if not exists transport_type text not null default 'FLIGHT';
alter table public.trip_transports add column if not exists carrier_name text;
alter table public.trip_transports add column if not exists vehicle_no text;
alter table public.trip_transports add column if not exists from_label text;
alter table public.trip_transports add column if not exists to_label text;
alter table public.trip_transports add column if not exists depart_date text;
alter table public.trip_transports add column if not exists arrive_date text;

update public.trip_transports
set
  carrier_name = coalesce(nullif(airline_name, ''), airline, ''),
  vehicle_no = coalesce(nullif(flight_no, ''), flight_number, ''),
  from_label = coalesce(nullif(departure_airport, ''), ''),
  to_label = coalesce(nullif(arrival_airport, ''), '')
where transport_type = 'FLIGHT' and carrier_name is null;

alter table public.trip_transports rename column flight_type to transport_role;
alter table public.trip_transports alter column transport_role set default 'OUTBOUND';

comment on table public.trip_transports is '여행별 이동수단 일정 (비행기/기차/자가용)';
comment on column public.trip_transports.transport_type is 'FLIGHT | TRAIN | CAR';
comment on column public.trip_transports.transport_role is 'OUTBOUND | RETURN | LAYOVER';
comment on column public.trip_transports.carrier_name is '항공사 / 열차 종류 / 차량 정보';
comment on column public.trip_transports.vehicle_no is '편명 / 열차번호 / 차량번호';
comment on column public.trip_transports.from_label is '출발지 (공항/역/장소)';
comment on column public.trip_transports.to_label is '도착지 (공항/역/장소)';
