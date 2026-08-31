-- WITHTRIP: 일정 영상 저장소 — 순수 "추가"만 하는 마이그레이션
--
-- 대원칙 준수 확인:
--   - 기존 테이블/행/버킷을 하나도 바꾸지 않습니다
--   - 새 스토리지 버킷 1개 + 그 버킷에만 걸리는 정책 3개를 더합니다
--   - 실패해도 기존 사진·대화 기능은 그대로 동작합니다
--
-- ─────────────────────────────────────────────────────────────
-- 왜 만드나 (신고: "영상올리는데 이런오류가 떠")
-- ─────────────────────────────────────────────────────────────
-- 영상을 `chat-images` 에 올리고 있었는데, 그 버킷은 **사진만 받는다.**
--
--     chat-images  허용형식 = image/jpeg, image/png, image/webp, image/heic
--                  최대     = 15 MB
--
-- 영상 기능을 넣으면서 저장소 설정을 안 바꿨다. 그래서 올리는 방식을 아무리
-- 고쳐도 그다음에 버킷이 거절했다. (앱에서는 FormData 오류가 먼저 나서
-- 여기까지 오지도 못했다 — 두 개가 겹쳐 있었다)
--
-- ⚠️ `chat-images` 를 넓히지 않고 **따로 판다.** 한 버킷에 섞으면 한도가
--    영상 기준(60MB)으로 올라가서, 대화방 사진도 60MB 까지 올라간다.
--    사진과 영상은 크기도 수명도 다르니 칸을 나눠 둔다.


-- ─────────────────────────────────────────────────────────────
-- 1) trip-videos 버킷 (신규)
-- ─────────────────────────────────────────────────────────────
-- 경로 규칙: {trip_id}/{user_id}/{시각}-{난수}.mp4
--   - chat-images 와 **똑같은 규칙**이다. 아래 삭제 정책이 경로 두 번째 칸을
--     사람 번호로 보기 때문에, 규칙이 어긋나면 남의 영상을 지울 수 있게 된다.
--
-- ⚠️ 공개 읽기 버킷이다. 주소를 아는 사람은 볼 수 있다(파일명에 난수가 있어
--    추측은 불가). chat-images 와 같은 수준으로 맞춘다 — 여기만 더 엄격하게
--    하면 재생 코드가 서명 주소를 따로 받아야 해서 화면이 느려진다.
--
-- ⚠️ `video/quicktime` 을 같이 넣는다. 아이폰에서 고른 영상은 실제로 .mov 인
--    경우가 있다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-videos',
  'trip-videos',
  true,
  62914560,                                   -- 60MB. 앱의 MAX_BYTES 와 같은 값이다
  array['video/mp4','video/quicktime']
)
on conflict (id) do nothing;

-- 읽기: 누구나 (주소를 알아야 함)
drop policy if exists "trip_videos_public_read" on storage.objects;
create policy "trip_videos_public_read"
  on storage.objects for select
  using (bucket_id = 'trip-videos');

-- 올리기: 로그인한 사용자만
drop policy if exists "trip_videos_insert_authenticated" on storage.objects;
create policy "trip_videos_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'trip-videos');

-- 지우기: 자기가 올린 것만 (경로 두 번째 칸이 user_id)
drop policy if exists "trip_videos_delete_own" on storage.objects;
create policy "trip_videos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'trip-videos'
    and (storage.foldername(name))[2] = (auth.uid())::text
  );
