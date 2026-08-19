-- 관리자가 가린 글을 앱·웹에서 **실제로 안 보이게** 한다.
--
-- 왜 여기서 막는가:
--   가려진 글을 걸러 내는 코드를 읽는 자리마다 넣으면(웹 화면, 앱 화면, 목록,
--   검색, 공유 미리보기…) **한 곳만 빠뜨려도 그 길로 그대로 보인다.**
--   읽는 길이 몇 개인지 세는 것보다, 아예 못 읽게 만드는 편이 확실하다.
--
-- ⚠️ **restrictive** 정책으로 만든다. 보통 정책(permissive)은 여러 개를 OR 로
--    묶어서, 새로 하나 추가해도 기존 정책 중 하나만 통과하면 그냥 보인다.
--    restrictive 는 AND 로 묶인다 — **기존 정책을 건드리지 않고** 조건을 하나
--    더 얹을 수 있다.
--
-- ⚠️ service_role 은 RLS 를 아예 지나가므로 **관리자 화면에서는 계속 보인다.**
--    가린 것을 되돌리려면 봐야 하니까, 이게 맞다.

-- 여행클립
drop policy if exists trip_clips_not_hidden on public.trip_clips;
create policy trip_clips_not_hidden on public.trip_clips
  as restrictive for select to anon, authenticated
  using (not exists (
    select 1 from public.content_hides h
     where h.kind = 'clip' and h.target_id = trip_clips.id));

-- 맛집 리뷰
drop policy if exists place_reviews_not_hidden on public.place_reviews;
create policy place_reviews_not_hidden on public.place_reviews
  as restrictive for select to anon, authenticated
  using (not exists (
    select 1 from public.content_hides h
     where h.kind = 'review' and h.target_id = place_reviews.id));

-- 담은 장소
drop policy if exists saved_places_not_hidden on public.saved_places;
create policy saved_places_not_hidden on public.saved_places
  as restrictive for select to anon, authenticated
  using (not exists (
    select 1 from public.content_hides h
     where h.kind = 'place' and h.target_id = saved_places.id));

-- 대화
drop policy if exists trip_messages_not_hidden on public.trip_messages;
create policy trip_messages_not_hidden on public.trip_messages
  as restrictive for select to anon, authenticated
  using (not exists (
    select 1 from public.content_hides h
     where h.kind = 'message' and h.target_id = trip_messages.id));

-- ⚠️ 가린 목록을 읽는 건 **모두에게 열어 둬야 한다.** 위 정책들이 이 표를
--    들여다보기 때문이다. 막아 두면 정책이 늘 "가려진 게 없다"로 읽혀서
--    아무것도 안 가려진다 — 조용히 실패하는 종류다.
--    (여기에는 무엇을 가렸는지만 있고, 글 내용은 없다)
