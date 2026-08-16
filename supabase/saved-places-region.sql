-- 저장한 장소에 나라·지역을 붙인다.
--
-- 배경: 나의 찜이 230곳인데 제주 65 · 부산 48 · 서울 27 처럼 지역이 몰려 있다.
-- 제주만 보려는데 230곳을 훑어야 했다.
--
-- ⚠️ **주소 문자열로 뽑으려 하지 말 것.** 형식이 제각각이다:
--      "대한민국 부산광역시 …"            (나라가 앞)
--      "… Osaka, 542-0076 일본"          (나라가 뒤)
--      "Japan, Kanagawa, Yokohama, …"    (영어)
--      "… Hồ Chí Minh, 베트남"           (도시가 현지어)
--    한국은 97% 뽑히지만 해외는 도시가 현지 표기라 우리 목록과 안 맞는다.
--    구글 address_components 가 정확한 답을 주므로 그걸 저장한다.
--
-- ⚠️ 한국어로 저장한다. 검색이 한국어로 들어오기 때문이다 —
--    "오사카"를 쳤을 때 주소가 "Osaka"인 곳도 나와야 한다.

alter table public.saved_places
  add column if not exists country_code text,   -- KR, JP, VN …
  add column if not exists country text,        -- 대한민국, 일본, 베트남 (한국어)
  add column if not exists region text;         -- 부산광역시, 오사카부, 호치민 (한국어)

-- 나라·지역 필터가 목록의 기본 동작이 되므로 인덱스를 둔다.
create index if not exists saved_places_user_country_idx
  on public.saved_places (user_id, country_code);

-- 한국어 검색이 주소·지역까지 걸리게 (지금은 클라이언트에서 걸러서 인덱스는 참고용)
create index if not exists saved_places_region_idx
  on public.saved_places (region)
  where region is not null;
