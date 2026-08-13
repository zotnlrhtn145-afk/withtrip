-- WITHTRIP: 여행 단톡 공지사항 — 순수 "추가"만 하는 마이그레이션
--
-- 대원칙 준수 확인:
--   - DROP / DELETE / TRUNCATE / 기존 행 UPDATE 없음
--   - 기존 테이블에 NULL 허용 컬럼 2개를 **추가만** 함
--   - 기존 컬럼·데이터는 하나도 건드리지 않음
--   - 실패해도 기존 기능은 그대로 동작 (아무도 아직 이 컬럼을 읽지 않음)

alter table public.trips
  add column if not exists notice text;

alter table public.trips
  add column if not exists notice_updated_at timestamptz;

alter table public.trips
  add column if not exists notice_updated_by uuid;

comment on column public.trips.notice is '여행 단톡 상단에 고정되는 공지. NULL이면 공지 없음.';
comment on column public.trips.notice_updated_at is '공지를 마지막으로 수정한 시각.';
comment on column public.trips.notice_updated_by is '공지를 마지막으로 수정한 사용자(profiles.id).';

-- 확인용 (읽기 전용)
-- select count(*) from public.trips;                       -- 7 그대로여야 함
-- select count(*) from public.trips where notice is null;  -- 전부 NULL (신규 컬럼)
