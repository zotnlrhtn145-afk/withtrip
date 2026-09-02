-- WITHTRIP: 현금으로 낸 외화 — 순수 "추가"만 하는 마이그레이션
--
-- ─────────────────────────────────────────────────────────────
-- 왜 카드와 따로 다뤄야 하나
-- ─────────────────────────────────────────────────────────────
--     카드   그날 기준환율 × (1 + 카드 수수료)   ← 원가가 나중에 확정된다
--     현금   환전할 때 이미 정해졌다             ← 기준환율도 수수료도 무관
--
-- 지금은 현금으로 낸 외화에도 **카드 수수료 2.3% 가 잘못 붙는다.**
--
-- 그리고 환전 환율은 사람마다 크게 다르다 —
--   트래블카드 충전 +0% · 은행 우대 90% +0.2% · 우대 없이 +1.75% · 공항 +3~5%
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️ 환율이 아니라 「얼마 내고 얼마 받았나」 를 담는다
-- ─────────────────────────────────────────────────────────────
-- 베트남처럼 **두 번 바꾸는** 경우가 흔하다.
--
--     100만원  →  $700  →  17,500,000동
--
-- 이때 중간 통화(달러)는 **알 필요가 없다.** 처음 낸 원화와 최종 받은 현지
-- 돈만 있으면 실효환율이 나온다 — 1동 = 1,000,000 ÷ 17,500,000 = 0.0571원.
--
-- 환율 한 숫자만 받으면 사용자가 저 나눗셈을 직접 해야 하고, 두 번 바꾼
-- 경우에는 무엇으로 나눠야 할지도 헷갈린다. **두 숫자를 그대로 받는다.**
--
-- 대원칙 준수 확인:
--   - 새 표 하나 + 기존 표에 기본값 있는 칸 하나
--   - 지금 쌓인 지출은 전부 카드/원화라 기본값 그대로가 정답이다


-- ─────────────────────────────────────────────────────────────
-- 1) 이 지출을 현금으로 냈나
-- ─────────────────────────────────────────────────────────────
alter table public.expenses
  add column if not exists paid_cash boolean not null default false;

comment on column public.expenses.paid_cash is
  '현금으로 냈나. true 면 카드 수수료를 안 붙이고, 그 사람이 환전한 환율로 '
  '환산한다(trip_cash_rates). 원화 지출에는 뜻이 없다.';


-- ─────────────────────────────────────────────────────────────
-- 2) 사람·통화별 환전 실적
-- ─────────────────────────────────────────────────────────────
-- ⚠️ **통화마다 따로다.** 카드 수수료율은 카드 특성이라 통화와 무관하지만,
--    환전은 통화마다 따로 하므로 엔화·홍콩달러를 한 값으로 묶을 수 없다.
create table if not exists public.trip_cash_rates (
  trip_id uuid not null references public.trips(id) on delete cascade,
  /** 환전한 사람. 이 사람이 현금으로 낸 지출에만 쓴다 */
  user_id uuid not null references public.profiles(id) on delete cascade,
  /** 받은 통화 (JPY·VND…) */
  currency text not null,
  /** 낸 원화 */
  krw_paid numeric not null,
  /** 받은 현지 돈 */
  foreign_received numeric not null,
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id, currency),
  /* 0 으로 나누는 일을 DB 에서 막는다 — 화면이 실수해도 데이터는 안전해야 한다 */
  constraint trip_cash_rates_positive check (krw_paid > 0 and foreign_received > 0)
);

comment on table public.trip_cash_rates is
  '여행별·사람별·통화별 환전 실적. 「얼마 내고 얼마 받았나」 를 그대로 담는다 — '
  '실효환율 = krw_paid / foreign_received. '
  '⚠️ 환율 한 숫자로 받지 않는 이유: 100만원 → $700 → 1750만동 처럼 두 번 바꾸는 '
  '경우가 흔한데, 그때도 처음과 끝만 넣으면 되기 때문이다(중간 통화는 무관).';

alter table public.trip_cash_rates enable row level security;

/* 카드 수수료율(trip_fx_fees)과 같은 규칙 — 읽기는 모두, 쓰기도 여행 사람이면 */
drop policy if exists "trip_cash_rates_select" on public.trip_cash_rates;
create policy "trip_cash_rates_select"
  on public.trip_cash_rates for select
  using (can_access_trip_settlement(trip_id));

drop policy if exists "trip_cash_rates_insert" on public.trip_cash_rates;
create policy "trip_cash_rates_insert"
  on public.trip_cash_rates for insert
  to authenticated
  with check (can_access_trip_settlement(trip_id));

drop policy if exists "trip_cash_rates_update" on public.trip_cash_rates;
create policy "trip_cash_rates_update"
  on public.trip_cash_rates for update
  to authenticated
  using (can_access_trip_settlement(trip_id))
  with check (can_access_trip_settlement(trip_id));

drop policy if exists "trip_cash_rates_delete" on public.trip_cash_rates;
create policy "trip_cash_rates_delete"
  on public.trip_cash_rates for delete
  to authenticated
  using (can_access_trip_settlement(trip_id));
