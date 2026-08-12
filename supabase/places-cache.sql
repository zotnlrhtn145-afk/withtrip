-- WITHTRIP: 구글 장소 캐시 (places) — 순수 "추가"만 하는 마이그레이션
--
-- ⚠️ 이 파일은 아직 실행하지 않았습니다. 사용자 확인 + DB 백업 완료 후에만 실행하세요.
--
-- 대원칙 준수 확인:
--   - DROP / DELETE / TRUNCATE / 기존 행 UPDATE 없음
--   - 새 테이블 1개 생성 + 기존 테이블에 NULL 허용 컬럼 추가만
--   - 기존 컬럼은 하나도 건드리지 않음 (saved_places.place_name, lat/lng 등 그대로 유지)
--   - 실패해도 기존 기능은 그대로 동작함 (새 컬럼은 아무도 아직 읽지 않음)

-- ─────────────────────────────────────────────────────────────
-- 1) places — 구글 장소 캐시 테이블 (신규)
-- ─────────────────────────────────────────────────────────────
-- 가이드 3-1을 기준으로 하되, 위드트립 화면(검색 결과 카드/상세)이 실제로
-- 쓰는 필드를 담을 수 있도록 컬럼을 확장했습니다. 이 필드들이 없으면
-- 캐시에서 읽어도 화면을 못 그려서 결국 구글을 다시 호출하게 됩니다.
create table if not exists public.places (
  id                bigserial primary key,
  google_place_id   text unique not null,        -- 구글 장소 고유 ID (중복 방지의 핵심)
  name              text not null,
  address           text,
  lat               double precision not null,
  lng               double precision not null,
  rating            numeric(2,1),                -- 구글 평점 (예: 4.3)
  rating_count      integer,
  category          text,                        -- restaurant | bar | stay (앱의 kind)
  sub_category      text,                        -- 세부 카테고리 (guessSubCategory 결과)
  price_level       integer,                     -- 구글 price_level 0~4
  google_types      text[],                      -- 구글 types 원본
  photo_references  text[],                      -- 사진 참조값만 저장 (사진 파일은 저장 안 함)
  phone             text,
  is_closed         boolean not null default false,  -- 폐업/NOT_FOUND 표시용
  last_refreshed_at timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists idx_places_location on public.places (lat, lng);
create index if not exists idx_places_refreshed on public.places (last_refreshed_at);
create index if not exists idx_places_name on public.places (name);

comment on table public.places is '구글 Places 캐시. google_place_id 기준 1행. 사진은 참조값만 저장.';
comment on column public.places.photo_references is '구글 photo_reference 목록. 이미지 파일은 저장하지 않음(구글 정책).';
comment on column public.places.last_refreshed_at is '평점 갱신 시각. 30일 이내 갱신 정책을 위해 주 1회 크론이 갱신.';
comment on column public.places.is_closed is 'NOT_FOUND 응답 시 삭제하지 않고 true로만 표시.';

-- ─────────────────────────────────────────────────────────────
-- 2) RLS — 읽기는 전체 공개, 쓰기는 서버(service_role)만
-- ─────────────────────────────────────────────────────────────
-- places는 사용자 데이터가 아니라 공용 캐시입니다.
-- 누구나 읽을 수 있지만, 쓰기는 우리 서버(API 라우트/크론)만 가능해야 합니다.
-- → 서버는 SUPABASE_SERVICE_ROLE_KEY 로 접근합니다. (RLS를 우회하므로 별도 insert 정책 불필요)
alter table public.places enable row level security;

drop policy if exists "places_select_all" on public.places;
create policy "places_select_all"
  on public.places for select
  using (true);

-- ⚠️ insert/update 정책을 일부러 만들지 않습니다.
--    anon/authenticated 키로는 쓰기가 불가능하고, 서버의 service_role 키로만 씁니다.
--    (service_role 키가 준비되지 않았다면 이 파일 실행을 보류하세요.)

-- ─────────────────────────────────────────────────────────────
-- 3) 기존 테이블 연결 — NULL 허용 컬럼 "추가"만
-- ─────────────────────────────────────────────────────────────
-- 기존 컬럼은 그대로 둡니다. 이 컬럼들은 당분간 비어(NULL) 있어도
-- 기존 화면 동작에 아무 영향이 없습니다.
alter table public.saved_places
  add column if not exists place_ref_id bigint references public.places (id);

alter table public.trip_schedules
  add column if not exists place_ref_id bigint references public.places (id);

alter table public.trip_accommodations
  add column if not exists place_ref_id bigint references public.places (id);

create index if not exists saved_places_place_ref_id_idx
  on public.saved_places (place_ref_id);
create index if not exists trip_schedules_place_ref_id_idx
  on public.trip_schedules (place_ref_id);
create index if not exists trip_accommodations_place_ref_id_idx
  on public.trip_accommodations (place_ref_id);

comment on column public.saved_places.place_ref_id is 'places 캐시 참조. NULL이면 아직 캐시에 연결되지 않은 기존 데이터.';

-- ─────────────────────────────────────────────────────────────
-- 4) 실행 후 확인용 (읽기 전용)
-- ─────────────────────────────────────────────────────────────
-- select count(*) from public.places;                                  -- 0 이어야 정상 (아직 복사 전)
-- select count(*) from public.saved_places;                            -- 156 그대로여야 함
-- select count(*) from public.saved_places where place_ref_id is null; -- 156 (아직 미연결)
