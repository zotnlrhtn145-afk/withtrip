-- WITHTRIP: 영업시간을 캐시에 담는다 — 순수 "추가"만 하는 마이그레이션
--
-- 대원칙 준수 확인:
--   - 기존 행을 하나도 바꾸지 않습니다 (전부 NULL 허용 칸 추가)
--   - 실패해도 지금 화면은 그대로 동작합니다
--
-- ─────────────────────────────────────────────────────────────
-- 왜 필요한가 (신고받은 실제 상황)
-- ─────────────────────────────────────────────────────────────
-- "3시에 양가형제에서 식사하려 했는데 알고 보니 브레이크타임이 3-4시였다.
--  급하게 찜에서 다른 데를 찾았는데 영업 중인지 알 수 없어 네이버를 찾아봤다."
--
-- 그런데 그 값은 **이미 우리가 받아오고 있었다.**
--
--     양가형제 — 월: 오전 11:00 ~ 오후 3:00,  오후 4:00 ~ 7:30
--                목요일: 휴무일
--
-- 다만 **상세 화면을 열어야만** 보였다. 찜 목록에서는 안 보인다.
-- 목록에 띄우려면 곳마다 구글에 다시 물어야 하는데(1000회 $17) 그건 못 한다.
-- → **캐시에 담아 둔다.**
--
-- ⚠️ **글자(weekday_text)만 담으면 안 된다.** "오전 11:00 ~ 오후 3:00, 오후
--    4:00~7:30" 같은 문장을 나중에 파싱하는 건 언어·표기가 바뀌면 깨진다.
--    구글은 같은 응답에 **`periods`(요일+시각 숫자)** 를 같이 준다 —
--    이미 `opening_hours` 를 요청하고 있으므로 **추가 비용이 0원**이다.
--    판단은 숫자로 하고, 글자는 화면에 그대로 보여 줄 때만 쓴다.


-- ─────────────────────────────────────────────────────────────
-- places 에 칸 추가
-- ─────────────────────────────────────────────────────────────
alter table public.places
  add column if not exists opening_periods jsonb,
  add column if not exists hours_text text[],
  add column if not exists utc_offset_min integer,
  add column if not exists hours_refreshed_at timestamptz;

comment on column public.places.opening_periods is
  '구글 opening_hours.periods 원본. [{open:{day,time},close:{day,time}}, ...] '
  '— day 는 0=일요일, time 은 "1100" 같은 네 자리. 브레이크타임이 있으면 같은 '
  '요일에 조각이 둘 이상 들어온다. **판단은 이 값으로 한다.**';

comment on column public.places.hours_text is
  '사람이 읽는 영업시간(구글 weekday_text). 화면에 그대로 보여 줄 때만 쓴다 — '
  '이 글자를 파싱해서 열림/닫힘을 판단하지 말 것.';

comment on column public.places.utc_offset_min is
  '그 장소의 UTC 시차(분). **없으면 안 된다** — 도쿄 가게가 열었는지를 한국 '
  '시각으로 재면 틀린다. 판단은 늘 그 가게의 현지 시각으로 한다.';

comment on column public.places.hours_refreshed_at is
  '영업시간을 마지막으로 받아 온 시각. 영업시간은 바뀌므로 오래되면 다시 받는다.';

-- 오래된 것부터 다시 받을 때 쓴다
create index if not exists places_hours_refreshed_idx
  on public.places (hours_refreshed_at nulls first);
