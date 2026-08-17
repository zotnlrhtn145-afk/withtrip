-- 다녀옴이 남았는데 저장 목록과 안 이어진 장소를 다시 잇는다.
--
-- ⚠️ 무슨 일이 있었나: 상세 화면이 구글에서 받은 `place_id` 를
--    `saved_places.google_place_id` 에 적어 두는데, **결과를 안 보고 흘려보냈다.**
--    그 쓰기가 실패하면 다녀옴은 `place_visits` 에만 남고 목록은 그 가게를
--    알아보지 못한다 — 사용자 눈에는 "체크했는데 목록에 체크가 안 된다"로 보인다.
--    (실제로 "오레노라멘 강남" 이 그 상태였다)
--
-- 앱은 고쳤다(`linkSavedPlaceKey` 로 기다리고, 다녀옴을 누를 때 한 번 더 잡는다).
-- 이미 어긋난 행은 여기서 되돌린다.
--
-- ⚠️ **이름이 정확히 같을 때만** 잇는다. 좌표로 이으면 59% 밖에 안 맞고
--    잘못 이으면 남의 가게 리뷰가 내 장소에 붙는다 — 조용히 틀리는 쪽이 더 나쁘다.
-- ⚠️ 비어 있는 칸만 채운다. 이미 적힌 열쇠는 건드리지 않는다.

update public.saved_places s
   set google_place_id = p.google_place_id
  from public.place_visits v
  join public.places p on p.google_place_id = v.google_place_id
 where v.user_id = s.user_id
   and s.google_place_id is null
   and lower(btrim(s.place_name)) = lower(btrim(p.name));

-- 리뷰 쪽도 같은 이유로 끊길 수 있다
update public.saved_places s
   set google_place_id = p.google_place_id
  from public.place_reviews r
  join public.places p on p.google_place_id = r.google_place_id
 where r.user_id = s.user_id
   and s.google_place_id is null
   and lower(btrim(s.place_name)) = lower(btrim(p.name));
