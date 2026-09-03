-- 미쉐린 가이드에 실린 곳.
--
-- ⚠️ **places 캐시에 칸을 붙이지 않고 따로 둔다.** 미쉐린은 해마다 새로 나오는데,
--    캐시에 섞어 두면 갱신할 때 캐시를 건드려야 한다. 따로 두면 이 표만 갈아 끼운다.
--
-- ⚠️ **distinction(별 등급)은 지금 비어 있다.** 사이트맵으로는 「실렸다」까지만
--    알 수 있다. 나중에 등급을 구하면 채운다 — 비어 있는 것과 「셀렉티드」는
--    다르므로 지어내지 않는다.
--
-- ⚠️ award_year 를 반드시 같이 둔다. 「1스타」라고만 적으면 2년 뒤엔 거짓말이 된다.

create table if not exists public.michelin_places (
  url             text primary key,            -- 미쉐린 가이드 주소 (같은 집을 두 번 안 넣는 열쇠)
  name            text not null,               -- 구글이 알려준 정식 이름 (한글·현지어)
  name_slug       text,                        -- 미쉐린 주소에 있던 로마자 이름
  city            text not null,
  country_code    text not null,
  region_slug     text,
  distinction     text,                        -- '3스타'|'2스타'|'1스타'|'빕구르망'|'셀렉티드'
  award_year      int,
  google_place_id text,
  address         text,
  lat             double precision,
  lng            double precision,
  updated_at      timestamptz not null default now()
);

-- 「내 찜 근처 미쉐린」을 빠르게 찾기 위한 것
create index if not exists michelin_places_geo on public.michelin_places (lat, lng);
create index if not exists michelin_places_gid on public.michelin_places (google_place_id);
create index if not exists michelin_places_city on public.michelin_places (city);

alter table public.michelin_places enable row level security;

-- 누구나 읽는다. 쓰는 건 서비스 키(수집 스크립트)만 — 사용자가 고칠 값이 아니다.
drop policy if exists michelin_read on public.michelin_places;
create policy michelin_read on public.michelin_places for select using (true);
