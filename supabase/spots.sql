-- WITHTRIP: nearby spots (주변 스팟) + author profile join
-- Run in Supabase Dashboard → SQL Editor

create table if not exists public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_local text,
  category text,
  address text,
  lat double precision not null,
  lng double precision not null,
  rating double precision,
  image_url text,
  user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.spots is '주변 스팟 — 사용자가 등록한 장소 (지도 마커)';
comment on column public.spots.user_id is '등록한 사용자 (profiles.id) — avatar_url / nickname JOIN';
comment on column public.spots.lat is 'WGS84 latitude';
comment on column public.spots.lng is 'WGS84 longitude';

create index if not exists spots_geo_idx on public.spots (lat, lng);
create index if not exists spots_user_id_idx on public.spots (user_id);
create index if not exists spots_created_at_idx on public.spots (created_at desc);

alter table public.spots enable row level security;

drop policy if exists "spots_select_authenticated" on public.spots;
drop policy if exists "spots_select_public" on public.spots;
drop policy if exists "spots_insert_own" on public.spots;
drop policy if exists "spots_update_own" on public.spots;
drop policy if exists "spots_delete_own" on public.spots;

create policy "spots_select_public"
  on public.spots for select
  to anon, authenticated
  using (true);

create policy "spots_insert_own"
  on public.spots for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

create policy "spots_update_own"
  on public.spots for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "spots_delete_own"
  on public.spots for delete
  to authenticated
  using (user_id = auth.uid());

-- Seed sample Osaka / Kobe spots (no author → default avatar on map)
insert into public.spots (name, name_local, category, address, lat, lng, rating, image_url)
select * from (values
  (
    'Hajime',
    'ハジメ',
    '미슐랭 · 프렌치',
    '1-9-11 Edobori, Nishi-ku, Osaka',
    34.69142,
    135.49028,
    4.8,
    '/images/place-sushi.png'
  ),
  (
    'Bar Nayuta',
    'バー ナユタ',
    '칵테일 바',
    '2-3-18 Sonezaki, Kita-ku, Osaka',
    34.70052,
    135.50048,
    4.6,
    '/images/place-bar.png'
  ),
  (
    'Koryu',
    '弧柳',
    '가이세키',
    '1-1-14 Higashi-Shinsaibashi, Chuo-ku, Osaka',
    34.67198,
    135.50152,
    4.7,
    '/images/place-sushi.png'
  ),
  (
    'The Bar Sazanka',
    'ザ・バー サザンカ',
    '루프탑 바',
    '5-15 Kitanagasadori, Chuo-ku, Kobe',
    34.68948,
    135.19205,
    4.5,
    '/images/place-bar.png'
  ),
  (
    '도톤보리',
    '道頓堀',
    '관광 · 먹거리',
    'Dotonbori, Chuo-ku, Osaka',
    34.66869,
    135.50129,
    4.4,
    '/images/osaka-kyoto-hero.png'
  )
) as seed(name, name_local, category, address, lat, lng, rating, image_url)
where not exists (select 1 from public.spots limit 1);
