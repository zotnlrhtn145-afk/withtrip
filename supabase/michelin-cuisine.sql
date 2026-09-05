-- 미쉐린 곳의 요리 종류와 가격대.
--
-- ⚠️ **목록 카드에 이미 같이 나온다** — 「₩₩₩₩ · 중식」. 등급을 읽을 때 같은
--    자리에서 읽으면 되므로 **추가 비용이 없다.** 처음엔 이름과 별만 저장해서
--    한 번 더 긁어야 했다.
-- ⚠️ `cuisine` 은 미쉐린이 쓰는 말 그대로 둔다(곰탕·두부·소바…). 우리 분류로
--    바꾸는 것은 화면에서 한다 — 원본을 뭉개면 되돌릴 수 없다.
alter table public.michelin_places
  add column if not exists cuisine text,
  add column if not exists price_range text;

create index if not exists michelin_places_cuisine on public.michelin_places (cuisine);
