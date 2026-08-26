-- 1:1 대화에서 **내 메시지를 지울 수 있게** 한다.
--
-- 신고: "영상에서처럼 대화가 삭제가 안 됩니다"
--
-- ## ⚠️ 화면에도 없었고, DB 에도 없었다
--
-- 두 군데가 동시에 빠져 있었다.
--
--   1. 앱 — 1:1 대화의 길게 누르기 메뉴에 「삭제」가 아예 없었다.
--      단톡방(`chat/[tripId].tsx`)에는 있었는데 1:1(`dm/[threadId].tsx`)에만
--      없었다. **같은 기능이 화면 두 곳에 따로 있으면 이렇게 한쪽만 빠진다.**
--
--   2. DB — `trip_messages` 에는 "내 것 수정" 정책이 있는데(`trip_chat.sql`),
--      `dm_messages` 에는 **update 정책이 하나도 없다.** 정책이 없으면
--      RLS 가 전부 막으므로, 앱에서 버튼을 달아도 **조용히 실패**한다.
--      오류도 안 나고 아무 일도 안 일어나서 원인을 찾기가 특히 어렵다.
--
-- ## ⚠️ 행을 지우지 않는다
--
-- `deleted_at` 만 찍어서 「삭제된 메시지입니다」로 바꾼다(카톡·단톡과 같다).
-- 진짜로 지우면 상대 화면에서 말풍선이 통째로 사라져 대화 흐름이 끊긴다.
-- 그래서 필요한 권한은 **delete 가 아니라 update** 다.
--
-- ⚠️ 내용을 고치는 데 쓰이지 않게 `deleted_at` 외의 칸은 그대로여야 한다.
--    보낸 뒤 몰래 말을 바꾸는 걸 막는다 — 지운 흔적은 남기되 왜곡은 못 하게.

create policy "dm_messages_update_own"
  on public.dm_messages for update to authenticated
  using (sender_id = auth.uid())
  with check (
    sender_id = auth.uid()
    -- 지우는 것만 허용한다. 글자·종류·첨부는 못 바꾼다.
    and content is not distinct from (select m.content from public.dm_messages m where m.id = dm_messages.id)
    and kind is not distinct from (select m.kind from public.dm_messages m where m.id = dm_messages.id)
  );

comment on policy "dm_messages_update_own" on public.dm_messages is
  '내 1:1 메시지 지우기(deleted_at) 전용. 내용 수정은 막는다.';
