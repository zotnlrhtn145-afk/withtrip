-- 지출에 **시각**을 담는다.
--
-- 신고: "정산에서 결제한 일(날짜)은 정렬이 되는데 시간도 최신순으로 됐으면"
--
-- ## ⚠️ 날짜만 있었다
--
-- `expense_date` 는 `date` 라 하루 안에서는 순서가 없다. 그래서 같은 날 지출이
-- 매번 뒤죽박죽으로 보였다(정렬 기준이 없으면 DB 가 주는 대로 나온다).
--
-- ## ⚠️ 시각은 이미 들어오고 있었는데 버리고 있었다
--
-- 카드 승인 문자에는 `08/26 19:24` 처럼 **시각이 같이 온다.** 날짜만 쓰고
-- 시각은 버렸다. 담을 칸을 만들어 그대로 살린다 — 새로 물어볼 것이 없다.
--
-- ⚠️ `timestamptz` 가 아니라 **`text` 로 둔다.** 카드 문자의 시각은 그 지역
--    벽시계 시각이다. 시간대를 붙이면 해외 여행에서 "현지 19:24" 가 한국 시간
--    으로 환산돼 엉뚱한 날로 넘어간다. 보이는 대로 담는 게 맞다.
--
-- ⚠️ 비어 있어도 된다. 손으로 적은 지출에는 시각이 없다 — 그때는 등록 순서로
--    정렬한다(아래 인덱스와 화면 정렬 참고).

alter table public.expenses
  add column if not exists expense_time text;

comment on column public.expenses.expense_time is
  '결제 시각 HH:MM (그 지역 벽시계). 카드 문자에서 읽는다. 없으면 등록 순서로 정렬.';

-- 같은 날 안에서 최신순으로 보는 정렬을 받쳐 준다
create index if not exists expenses_trip_when_idx
  on public.expenses (trip_id, expense_date desc, expense_time desc, created_at desc);
