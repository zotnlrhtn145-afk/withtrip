-- 리뷰 사진 버킷.
--
-- ⚠️ **리뷰는 공개다.** 그래서 사진도 공개 읽기다.
--    (리뷰 글은 보이는데 사진만 안 보이면 기능이 반쪽이 된다)
--
-- 경로: {google_place_id}/{user_id}/{임의값}.webp
--   - 가게별로 묶여 있어 가게가 사라지면 통째로 정리할 수 있다
--   - 두 번째 칸이 user_id 라 "본인 것만 삭제" 를 경로로 판단한다
--     (chat-images 와 같은 방식)
--
-- ⚠️ **WebP 로 올린다.** 대화 사진(JPEG 1920/0.8)과 달리 리뷰 사진은
--    화면에서 크게 볼 일이 적다. 1280/0.7 WebP 면 같은 사진이 약 1/5 크기다.
--    전송량이 곧 돈이라 여기서 줄여 두는 게 가장 크게 먹힌다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-photos',
  'review-photos',
  true,
  10485760,                                            -- 10MB (압축 후엔 보통 100KB 안팎)
  array['image/webp','image/jpeg','image/png']
)
on conflict (id) do nothing;

-- 읽기: 누구나. 리뷰가 공개이므로 사진도 공개다.
drop policy if exists "review_photos_public_read" on storage.objects;
create policy "review_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'review-photos');

-- 올리기: 로그인한 사용자만
drop policy if exists "review_photos_insert_authenticated" on storage.objects;
create policy "review_photos_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'review-photos');

-- 지우기: 자기가 올린 것만 (경로 두 번째 칸이 user_id)
drop policy if exists "review_photos_delete_own" on storage.objects;
create policy "review_photos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[2] = (auth.uid())::text
  );
