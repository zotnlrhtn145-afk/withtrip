-- 일정에 좌표를 붙인다.
--
-- 왜 필요한가: 일정이 어디쯤인지 앱도 웹도 모른다. 그래서 "앞 일정에서 얼마나
-- 먼지", "숙소에서 얼마나 걸리는지"를 아예 계산할 수 없었다. 숙소
-- (`trip_accommodations`)에는 이미 lat/lng 가 있는데 일정에만 없었다.
--
-- ⚠️ **좌표는 대부분 공짜로 얻는다.** 장소 검색 결과와 찜에는 이미 lat/lng 가
--    들어 있다. 지금까지는 일정으로 저장할 때 그걸 그냥 버리고 있었다.
--    주소만 있는 옛 일정은 한 번 지오코딩해서 채운다(월 1만 건 무료 안).
--
-- ⚠️ `place_ref_id` 로 `places` 를 참조하는 길도 있었지만 **한 건도 안 채워져
--    있었다.** 앞으로도 검색을 안 거친 일정(직접 입력·대화에서 추출)은 places
--    행이 없다. 그래서 숙소와 같은 방식으로 **일정에 직접** 둔다.

alter table public.trip_schedules add column if not exists lat double precision;
alter table public.trip_schedules add column if not exists lng double precision;

comment on column public.trip_schedules.lat is '위도. 검색·찜에서 온 일정은 저장할 때 같이 넣고, 주소만 있는 것은 지오코딩으로 채운다.';
comment on column public.trip_schedules.lng is '경도.';

-- 지도에서 "이 여행 근처" 를 훑을 때 쓴다
create index if not exists trip_schedules_coords_idx
  on public.trip_schedules (trip_id, lat, lng)
  where lat is not null;
