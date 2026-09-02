-- WITHTRIP: 지출 금액을 소수까지 담을 수 있게
--
-- ─────────────────────────────────────────────────────────────
-- 왜 (실측으로 막혔다)
-- ─────────────────────────────────────────────────────────────
-- `expenses.amount` 가 **integer** 라 `USD 16.70` 을 넣으면 거절당한다.
--
--     invalid input syntax for type integer: "16.7"
--
-- 달러·유로·파운드는 센트가 있어서, 소수를 못 담으면 **해외 결제가 통째로
-- 안 된다.** 카드 문자에도 그대로 온다 —
--
--     삼성0230해외승인 오*환
--     USD 16.70
--     04/19 18:51 PANDAEXPRESS1006
--
-- ⚠️ 반올림으로 때우면 안 된다. 16.70 → 17 이면 1.8% 가 어긋나는데,
--    수수료(2.3%)와 비슷한 크기라 애써 맞춘 정산이 도로 틀어진다.
--
-- ─────────────────────────────────────────────────────────────
-- 대원칙 준수 확인
-- ─────────────────────────────────────────────────────────────
--   - 기존 값은 그대로다. integer → numeric 은 **값을 잃지 않는 확장**이다
--     (72000 은 72000 그대로다)
--   - 원화 지출은 계속 정수로 들어온다 — 화면이 소수를 만들지 않는다
--   - 되돌릴 일이 생겨도 numeric → integer 로 줄이면 되지만, 그때는 소수가
--     있는 행을 먼저 정리해야 한다

alter table public.expenses
  alter column amount type numeric using amount::numeric;

comment on column public.expenses.amount is
  '결제 금액. currency 단위다. ⚠️ 정수가 아니다 — 달러·유로는 16.70 처럼 '
  '센트가 온다. 원화·엔화는 소수가 없어 정수로 들어온다.';

-- 정산 대상자별 금액도 같은 이유로 소수를 담아야 한다
-- (16.70 달러를 셋이 나누면 5.57 · 5.57 · 5.56)
alter table public.expense_participants
  alter column share_amount type numeric using share_amount::numeric;

comment on column public.expense_participants.share_amount is
  '이 사람이 낼 금액(지출의 currency 단위). NULL 이면 남은 금액을 다른 '
  'NULL 인 사람들과 나눠 낸다. ⚠️ 소수가 올 수 있다.';
