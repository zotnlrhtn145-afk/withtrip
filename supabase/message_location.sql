-- WITHTRIP: 채팅 메시지에 위치 카드 지원 (kind/payload)
-- kind='location' 이면 payload={ name, lat, lng, address } 로 앱 채팅에서 길찾기 카드로 렌더.
-- content 는 사람이 읽는 폴백("📍 위치 공유: 이름")을 넣어 non-empty 체크·푸시 문구로 사용.
alter table public.dm_messages add column if not exists kind text not null default 'text';
alter table public.dm_messages add column if not exists payload jsonb;
alter table public.trip_messages add column if not exists kind text not null default 'text';
alter table public.trip_messages add column if not exists payload jsonb;

comment on column public.dm_messages.kind is 'text | location';
comment on column public.dm_messages.payload is 'kind=location 이면 { name, lat, lng, address }';
comment on column public.trip_messages.kind is 'text | location';
comment on column public.trip_messages.payload is 'kind=location 이면 { name, lat, lng, address }';
