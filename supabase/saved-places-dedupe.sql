-- 같은 장소가 두 번 저장되던 것 막기 + 이미 쌓인 중복 정리.
--
-- 인스타 공유는 같은 릴을 두 번 보내거나, 같은 가게가 여러 릴에 나오면
-- 그때마다 새 행을 넣었다(중복 확인이 아예 없었다).
--
-- ⚠️ **trip_id 를 열쇠에 넣어야 한다.** "나의 찜"에 있는 곳을 여행에도 담으면
--    행이 하나 더 생기는데(sendToTrip 이 복사한다) 그건 중복이 아니라 정상이다.
--    실제로 34곳이 그 상태였다 — trip_id 를 빼고 세면 멀쩡한 걸 지운다.
--
-- ⚠️ **생성 컬럼 + 평범한 2컬럼 유니크**로 만든다. 표현식 인덱스로 만들면
--    PostgREST 의 upsert(onConflict) 가 그 인덱스를 못 가리켜서
--    "조용히 건너뛰기"를 못 한다. 그러면 중복을 보낼 때마다 저장이 실패한다.

-- ── 1) 같은 장소인지 가르는 열쇠 ─────────────────────────────
alter table public.saved_places
  add column if not exists dedupe_key text
  generated always as (
    lower(btrim(coalesce(place_name, ''))) || '|' ||
    lower(btrim(coalesce(address, ''))) || '|' ||
    coalesce(trip_id::text, '')
  ) stored;

comment on column public.saved_places.dedupe_key is
  '중복 판단용. 이름+주소+여행이 같으면 같은 장소로 본다. 직접 쓰지 않는다(생성 컬럼).';

-- ── 2) 남길 행에 정보 몰아주기 ───────────────────────────────
-- 지우는 쪽에만 있던 값(별표·가게 열쇠·사진 등)이 사라지면 안 된다.
with ranked as (
  select id, user_id, dedupe_key,
         row_number() over (
           partition by user_id, dedupe_key
           order by (google_place_id is not null) desc,
                    (nullif(btrim(coalesce(image_url, '')), '') is not null) desc,
                    (country_code is not null) desc,
                    (nullif(btrim(coalesce(sub_category, '')), '') is not null) desc,
                    (rating is not null) desc,
                    created_at asc
         ) rn
  from public.saved_places
),
merged as (
  select r.user_id, r.dedupe_key,
         bool_or(coalesce(s.starred, false))                              as any_starred,
         max(s.google_place_id)                                           as gpid,
         max(nullif(btrim(coalesce(s.image_url, '')), ''))                as img,
         max(s.country_code)                                              as cc,
         max(s.country)                                                   as country,
         max(s.region)                                                    as region,
         max(nullif(btrim(coalesce(s.sub_category, '')), ''))             as sub,
         max(nullif(btrim(coalesce(s.memo, '')), ''))                     as memo
  from ranked r
  join public.saved_places s on s.id = r.id
  group by r.user_id, r.dedupe_key
  having count(*) > 1
)
update public.saved_places k
   set starred         = coalesce(k.starred, false) or m.any_starred,
       google_place_id = coalesce(k.google_place_id, m.gpid),
       image_url       = coalesce(nullif(btrim(coalesce(k.image_url, '')), ''), m.img),
       country_code    = coalesce(k.country_code, m.cc),
       country         = coalesce(k.country, m.country),
       region          = coalesce(k.region, m.region),
       sub_category    = coalesce(nullif(btrim(coalesce(k.sub_category, '')), ''), m.sub),
       memo            = coalesce(nullif(btrim(coalesce(k.memo, '')), ''), m.memo)
  from ranked r
  join merged m on m.user_id = r.user_id and m.dedupe_key = r.dedupe_key
 where k.id = r.id and r.rn = 1;

-- ── 3) 남는 하나만 두고 지우기 ───────────────────────────────
with ranked as (
  select id, row_number() over (
           partition by user_id, dedupe_key
           order by (google_place_id is not null) desc,
                    (nullif(btrim(coalesce(image_url, '')), '') is not null) desc,
                    (country_code is not null) desc,
                    (nullif(btrim(coalesce(sub_category, '')), '') is not null) desc,
                    (rating is not null) desc,
                    created_at asc
         ) rn
  from public.saved_places
)
delete from public.saved_places
 where id in (select id from ranked where rn > 1);

-- ── 4) 앞으로 못 들어오게 ────────────────────────────────────
-- 앱·웹 어느 쪽에서 넣든 여기서 막힌다. 화면 코드를 하나씩 고치는 것보다 확실하다.
create unique index if not exists saved_places_no_dup
  on public.saved_places (user_id, dedupe_key);
