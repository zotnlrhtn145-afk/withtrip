-- 나의 찜에 '꼭 가고 싶은 곳' 별표.
--
-- 배경: 인스타 공유로 담기가 쉬워지면서 나의 찜이 200곳을 넘겼다.
-- 그중 레스토랑만 185곳이라, 카테고리 필터를 걸어도 "진짜 가고 싶은 곳"을
-- 찾으려면 계속 훑어야 했다.
--
-- ⚠️ **여행에 담는 것(trip_id)과는 다른 축이다.**
--    trip_id 는 "이번 여행에 갈 곳", starred 는 "언젠가 꼭 가고 싶은 곳" —
--    여행과 무관한 개인의 우선순위다. 둘을 섞으면 안 된다.
--
-- 등급을 여러 단계로 두지 않고 켜기/끄기 하나로 둔 이유:
-- 담는 건 순간인데 등급을 정하라고 하면 그 순간이 무거워진다.
-- 별표가 너무 많아지면 그때 목록(폴더)으로 올리면 되고, 데이터는 그대로 옮겨간다.

alter table public.saved_places
  add column if not exists starred boolean not null default false;

-- 별표만 보는 필터가 기본 동작이 될 것이므로 인덱스를 둔다.
-- (사용자별 + 별표 켜진 것만 — 부분 인덱스라 가볍다)
create index if not exists saved_places_user_starred_idx
  on public.saved_places (user_id)
  where starred;
