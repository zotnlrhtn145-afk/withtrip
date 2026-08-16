-- 다녀온 곳 체크 + 가게 리뷰(별점·글·사진).
--
-- ⚠️ **가게 단위(google_place_id)로 묶는다.** saved_places 는 사람마다 행이 따로라
--    거기에 붙이면 같은 가게 리뷰가 흩어진다. 리뷰의 값어치는 "이 가게를 남들이
--    어떻게 봤나"에 있으므로 반드시 가게로 모여야 한다.
--
-- ⚠️ saved_places 에는 가게를 가리키는 열쇠가 없었다(place_ref_id 는 0% 비어 있었다).
--    좌표로 이으면 59% 뿐이라 믿을 수 없다.
--    상세 화면이 이미 /api/places/details 를 부르고 거기서 place_id 가 온다 —
--    그때 saved_places.google_place_id 에 적어 둔다. **추가 호출이 없다.**

alter table public.saved_places
  add column if not exists google_place_id text;

create index if not exists saved_places_gpid_idx
  on public.saved_places (google_place_id)
  where google_place_id is not null;

-- ── 다녀온 곳 ────────────────────────────────────────────
-- 별표(꼭 가고 싶은 곳)와는 다른 축이다. 다녀와도 별표는 그대로 둔다 —
-- 맛있었으면 또 가고 싶기 때문이다.
create table if not exists public.place_visits (
  google_place_id text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  visited_at timestamptz not null default now(),
  primary key (google_place_id, user_id)
);

alter table public.place_visits enable row level security;

-- 다녀온 기록은 **본인만** 본다. 어디에 갔는지는 위치 정보에 가깝다.
-- (리뷰는 공개지만, 리뷰를 안 쓴 방문까지 남에게 보일 이유는 없다)
drop policy if exists place_visits_select_own on public.place_visits;
create policy place_visits_select_own on public.place_visits
  for select to authenticated using (user_id = auth.uid());

drop policy if exists place_visits_write_own on public.place_visits;
create policy place_visits_write_own on public.place_visits
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 리뷰 ────────────────────────────────────────────────
create table if not exists public.place_reviews (
  id uuid primary key default gen_random_uuid(),
  google_place_id text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '',
  /** [{ path, thumb, width, height }] — 대화 사진과 같은 모양 */
  photos jsonb not null default '[]'::jsonb,
  visited_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 한 사람이 한 가게에 리뷰 하나. 다시 쓰면 고쳐 쓰는 것이다.
  unique (google_place_id, user_id)
);

create index if not exists place_reviews_gpid_idx
  on public.place_reviews (google_place_id, created_at desc);

alter table public.place_reviews enable row level security;

-- ⚠️ **리뷰는 모두에게 공개다.** 사람들이 이 가게를 판단하는 근거이므로
--    안 보이면 기능 자체가 의미가 없다.
--    다만 쓰고 고치고 지우는 건 본인만 할 수 있다.
drop policy if exists place_reviews_select_all on public.place_reviews;
create policy place_reviews_select_all on public.place_reviews
  for select to authenticated using (true);

drop policy if exists place_reviews_insert_own on public.place_reviews;
create policy place_reviews_insert_own on public.place_reviews
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists place_reviews_update_own on public.place_reviews;
create policy place_reviews_update_own on public.place_reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists place_reviews_delete_own on public.place_reviews;
create policy place_reviews_delete_own on public.place_reviews
  for delete to authenticated using (user_id = auth.uid());

-- 가게별 평균 별점·개수 — 목록·상세에서 한 번에 읽으려고 둔다
create or replace view public.place_review_stats as
  select google_place_id,
         round(avg(rating)::numeric, 1) as avg_rating,
         count(*)::int as review_count
  from public.place_reviews
  group by google_place_id;
