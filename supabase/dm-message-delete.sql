-- 1:1 대화에서 **내 메시지를 지울 수 있게** 한다.
--
-- 신고: "영상에서처럼 대화가 삭제가 안 됩니다"
--
-- ## ⚠️ 화면에도 없었고, DB 에도 없었다
--
--   1. 앱 — 1:1 대화의 길게 누르기 메뉴에 「삭제」가 아예 없었다.
--      단톡방(`chat/[tripId].tsx`)에는 있었는데 1:1 에만 없었다.
--      **같은 기능이 화면 두 곳에 따로 있으면 이렇게 한쪽만 빠진다.**
--
--   2. DB — `dm_messages` 의 정책은 INSERT·SELECT 둘뿐이었다(실측).
--      `trip_messages` 에는 "내 것 수정" 정책이 있는데 여기엔 없다.
--      정책이 없으면 RLS 가 전부 막으므로, 버튼을 달아도 **조용히 실패**한다.
--      오류도 안 나고 아무 일도 안 일어나서 원인을 찾기가 특히 어렵다.
--
-- ## ⚠️ 행을 지우지 않는다
--
-- `deleted_at` 만 찍어서 「삭제된 메시지입니다」로 바꾼다(카톡·단톡과 같다).
-- 진짜로 지우면 상대 화면에서 말풍선이 통째로 사라져 대화 흐름이 끊긴다.
-- 그래서 필요한 권한은 **delete 가 아니라 update** 다.

create policy "dm_messages_update_own"
  on public.dm_messages for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

comment on policy "dm_messages_update_own" on public.dm_messages is
  '내 1:1 메시지 지우기(deleted_at) 전용. 실제 제한은 아래 트리거가 건다.';

/**
 * 지우는 것 말고는 못 바꾸게 한다.
 *
 * ⚠️ **이걸 정책(`with check`)으로 하려다 말았다.** `dm_messages` 안에서
 *    `dm_messages` 를 다시 읽어야 하는데, 그 조회에 또 RLS 가 걸려
 *    **재귀에 빠질 수 있다.** 트리거는 RLS 밖에서 돌고 예전 값(`OLD`)을
 *    그냥 들고 있어서 이런 위험이 없다.
 *
 * ⚠️ 왜 막나: 정책만 있으면 보낸 뒤에 **말을 몰래 바꿀 수 있다.**
 *    지운 흔적은 남기되 내용 왜곡은 못 하게 한다.
 */
create or replace function public.dm_messages_only_soft_delete()
returns trigger
language plpgsql
as $$
begin
  if NEW.content is distinct from OLD.content
     or NEW.kind is distinct from OLD.kind
     or NEW.payload is distinct from OLD.payload
     or NEW.sender_id is distinct from OLD.sender_id
     or NEW.thread_id is distinct from OLD.thread_id then
    raise exception '메시지 내용은 고칠 수 없습니다';
  end if;
  return NEW;
end $$;

drop trigger if exists dm_messages_soft_delete_only on public.dm_messages;
create trigger dm_messages_soft_delete_only
  before update on public.dm_messages
  for each row execute function public.dm_messages_only_soft_delete();
