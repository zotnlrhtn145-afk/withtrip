-- WITHTRIP: saved_places (가고싶은 곳 / 위시리스트)
-- Supabase Dashboard → SQL Editor에서 실행하세요.

create table if not exists public.saved_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid,
  place_name text not null default '',
  category text,
  local_name text,
  sub_category text,
  guide_badge text,
  price_range text,
  address text,
  phone_number text,
  memo text,
  image_url text,
  rating double precision,
  review_count integer,
  distance_km double precision,
  created_at timestamptz not null default now()
);

alter table public.saved_places add column if not exists place_name text;
alter table public.saved_places add column if not exists category text;
alter table public.saved_places add column if not exists local_name text;
alter table public.saved_places add column if not exists sub_category text;
alter table public.saved_places add column if not exists guide_badge text;
alter table public.saved_places add column if not exists price_range text;
alter table public.saved_places add column if not exists address text;
alter table public.saved_places add column if not exists phone_number text;
alter table public.saved_places add column if not exists memo text;
alter table public.saved_places add column if not exists user_id uuid;
alter table public.saved_places add column if not exists image_url text;
alter table public.saved_places add column if not exists rating double precision;
alter table public.saved_places add column if not exists review_count integer;
alter table public.saved_places add column if not exists distance_km double precision;

comment on table public.saved_places is '여행별 가고싶은 곳(저장된 장소)';
comment on column public.saved_places.category is '레스토랑 | 라운지 & 바 | 숙소';
comment on column public.saved_places.local_name is '현지 표기';
comment on column public.saved_places.sub_category is '세부 카테고리';
comment on column public.saved_places.guide_badge is '가이드 뱃지 (예: Michelin 3 Stars)';
comment on column public.saved_places.price_range is '¥ | ¥¥ | ¥¥¥ | ¥¥¥¥';
comment on column public.saved_places.user_id is '저장한 유저 (auth.users.id 또는 앱 세션 user id)';
comment on column public.saved_places.image_url is '커버 이미지 (Google Places photo 또는 Unsplash fallback)';

create index if not exists saved_places_trip_id_idx
  on public.saved_places (trip_id);

create index if not exists saved_places_user_id_idx
  on public.saved_places (user_id);

alter table public.saved_places enable row level security;

create policy "saved_places_select_public"
  on public.saved_places for select to anon, authenticated using (true);

create policy "saved_places_insert_public"
  on public.saved_places for insert to anon, authenticated with check (true);

create policy "saved_places_update_public"
  on public.saved_places for update to anon, authenticated using (true) with check (true);

create policy "saved_places_delete_public"
  on public.saved_places for delete to anon, authenticated using (true);
