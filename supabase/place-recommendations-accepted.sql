-- 친구 추천찜에 'accepted' 단계를 넣는다.
--
-- ⚠️ 예전 흐름: 알림에서 **수락하면 곧바로 나의 찜(saved_places)에 복사**됐다.
--    그러면 남이 보낸 것이 내 찜 목록에 그냥 섞여 들어간다. 사용자가
--    "친구추천찜에만 등록되고, 나의 찜으로는 선택적으로 보내지게 해 달라"고 한 이유다.
--
-- 새 흐름:
--    pending  — 아직 안 봤다
--    accepted — 받았다. **친구 추천찜 탭에만** 있다. 나의 찜에는 없다.
--    saved    — 내가 골라서 나의 찜으로 옮겼다 (saved_place_id 가 그 행)
--    dismissed— 안 받는다 (목록에서 숨김)
--
-- ⚠️ 기존 'saved' 행은 그대로 둔다. 이미 나의 찜에 들어가 있으므로 맞는 상태다.

alter table public.place_recommendations
  drop constraint if exists place_recommendations_status_check;

alter table public.place_recommendations
  add constraint place_recommendations_status_check
  check (status = any (array['pending', 'accepted', 'saved', 'dismissed']));
