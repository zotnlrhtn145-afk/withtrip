-- WITHTRIP: 대화 사진 전송 — 순수 "추가"만 하는 마이그레이션
--
-- ⚠️ 아직 실행하지 않았습니다. 사용자 확인 후에만 실행하세요.
--
-- 대원칙 준수 확인:
--   - 기존 테이블/행을 하나도 바꾸지 않습니다
--   - 새 스토리지 버킷 1개 + 기존 테이블에 NULL 허용 컬럼 1개 추가만 합니다
--   - 실패해도 기존 대화 기능은 그대로 동작합니다


-- ─────────────────────────────────────────────────────────────
-- 1) chat-images 버킷 (신규)
-- ─────────────────────────────────────────────────────────────
-- 이미 쓰고 있는 trip-clips / receipts / trip-covers / place-photos 와 같은 방식.
--
-- 경로 규칙: {trip_id}/{user_id}/{uuid}.jpg
--   - 방별로 나뉘어 있어 나중에 방 단위로 정리하기 쉽다
--   - 파일명이 uuid 라 주소를 추측할 수 없다
--
-- ⚠️ 공개 읽기 버킷입니다. 주소를 아는 사람은 볼 수 있습니다(추측은 불가).
--    더 엄격하게 가려면 비공개 + 서명 URL 방식이 있는데,
--    그때도 화면 코드는 안 바뀝니다(해석 함수 한 곳만 고치면 됨).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  true,
  15728640,                                            -- 15MB (압축 후엔 보통 300KB 안팎)
  array['image/jpeg','image/png','image/webp','image/heic']
)
on conflict (id) do nothing;

-- 읽기: 누구나 (주소를 알아야 함)
drop policy if exists "chat_images_public_read" on storage.objects;
create policy "chat_images_public_read"
  on storage.objects for select
  using (bucket_id = 'chat-images');

-- 올리기: 로그인한 사용자만
drop policy if exists "chat_images_insert_authenticated" on storage.objects;
create policy "chat_images_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-images');

-- 지우기: 자기가 올린 것만 (경로 두 번째 칸이 user_id)
drop policy if exists "chat_images_delete_own" on storage.objects;
create policy "chat_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[2] = (auth.uid())::text
  );


-- ─────────────────────────────────────────────────────────────
-- 2) trip_messages.deleted_at (신규 컬럼)
-- ─────────────────────────────────────────────────────────────
-- 메시지 삭제를 **행을 지우지 않고** 표시로 처리한다.
--   - 카톡처럼 "삭제된 메시지입니다"를 남길 수 있다
--   - 실수로 지워도 되돌릴 수 있다
--   - 대원칙(기존 데이터를 지우지 않는다)과도 맞는다
alter table public.trip_messages
  add column if not exists deleted_at timestamptz;

comment on column public.trip_messages.deleted_at is
  '삭제 표시 시각. NULL 이면 정상 메시지. 행은 지우지 않는다.';

-- 같은 이유로 DM 에도 추가
alter table public.dm_messages
  add column if not exists deleted_at timestamptz;

comment on column public.dm_messages.deleted_at is
  '삭제 표시 시각. NULL 이면 정상 메시지. 행은 지우지 않는다.';
