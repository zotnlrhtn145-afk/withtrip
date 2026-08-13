-- WITHTRIP: 장소 사진 자체 보관 (place_photos) — 순수 "추가"만 하는 마이그레이션
--
-- ⚠️ 아직 실행하지 않았습니다. 사용자 확인 후에만 실행하세요.
--
-- 대원칙 준수 확인:
--   - 기존 테이블/컬럼/행을 하나도 건드리지 않습니다
--   - 새 테이블 1개 + 새 스토리지 버킷 1개 생성만 합니다
--   - saved_places.image_url 은 읽지도 쓰지도 않습니다 (기존 사진 주소 그대로 유지)
--   - 실패해도 기존 기능은 그대로 동작합니다 (사진은 지금처럼 구글에서 바로 받아옵니다)
--
-- ─────────────────────────────────────────────────────────────
-- 왜 필요한가
-- ─────────────────────────────────────────────────────────────
-- 지금은 사진을 화면에 띄울 때마다 구글 Places Photo API 를 호출합니다.
-- 사용자가 늘면 이 호출이 사용자 수 × 조회 수만큼 늘어나 비용이 가장 큰 항목이 됩니다.
--
-- 바꾼 뒤에는 **장소 사진 한 장당 30일에 한 번**만 구글을 부릅니다.
-- 사용자가 만 명이든 십만 명이든 호출 수가 같습니다.
--
-- 30일인 이유: 구글 약관이 Places 콘텐츠 캐싱을 30일까지만 허용합니다.
-- (places 캐시 테이블의 last_refreshed_at 30일 정책과 같은 기준)


-- ─────────────────────────────────────────────────────────────
-- 1) place_photos — 우리가 보관 중인 장소 사진 목록 (신규 테이블)
-- ─────────────────────────────────────────────────────────────
-- 구글 photo_reference 는 400자가 넘고 파일명으로 쓸 수 없어서
-- sha256 해시를 키로 씁니다. 같은 사진이라도 요청 너비(w)가 다르면 다른 파일입니다.
create table if not exists public.place_photos (
  id              bigserial primary key,
  photo_ref_hash  text        not null,          -- sha256(photo_reference)
  width           integer     not null,          -- 요청 너비 (프록시의 w 파라미터)
  storage_path    text        not null,          -- place-photos 버킷 안 경로
  bytes           integer,                       -- 저장 용량 파악용 (선택)
  fetched_at      timestamptz not null default now(),  -- 구글에서 받아온 시각 (30일 갱신 기준)
  created_at      timestamptz not null default now(),
  unique (photo_ref_hash, width)
);

create index if not exists idx_place_photos_fetched on public.place_photos (fetched_at);

comment on table  public.place_photos              is '장소 사진 자체 보관 목록. 구글 호출을 사진당 30일 1회로 줄이기 위한 것.';
comment on column public.place_photos.photo_ref_hash is 'sha256(photo_reference). photo_reference 자체는 너무 길어 파일명/인덱스로 부적합.';
comment on column public.place_photos.fetched_at     is '구글에서 받아온 시각. 30일이 지나면 다시 받아 덮어씁니다(구글 약관).';


-- ─────────────────────────────────────────────────────────────
-- 2) RLS — 읽기 전체 공개, 쓰기는 서버(service_role)만
-- ─────────────────────────────────────────────────────────────
-- 사용자 데이터가 아니라 공용 캐시입니다. places 테이블과 같은 정책을 씁니다.
alter table public.place_photos enable row level security;

drop policy if exists "place_photos_select_all" on public.place_photos;
create policy "place_photos_select_all"
  on public.place_photos for select
  using (true);

-- ⚠️ insert/update 정책을 일부러 만들지 않습니다.
--    쓰기는 우리 서버가 SUPABASE_SERVICE_ROLE_KEY 로만 합니다(RLS 우회).


-- ─────────────────────────────────────────────────────────────
-- 3) place-photos 스토리지 버킷 (신규)
-- ─────────────────────────────────────────────────────────────
-- 이미 쓰고 있는 trip-clips / receipts / trip-covers 와 같은 방식입니다.
-- 공개 읽기 = 이미지 주소를 그대로 <img> 에 넣을 수 있습니다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'place-photos',
  'place-photos',
  true,
  10485760,                                            -- 10MB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- 버킷 안 파일 읽기는 누구나, 쓰기는 서버(service_role)만.
drop policy if exists "place_photos_public_read" on storage.objects;
create policy "place_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'place-photos');
