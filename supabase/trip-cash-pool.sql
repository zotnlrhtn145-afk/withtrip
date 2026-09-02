-- WITHTRIP: 공동 현금 지갑 — 순수 "추가"만 하는 마이그레이션
--
-- ─────────────────────────────────────────────────────────────
-- 실제로 사람들이 하는 방식
-- ─────────────────────────────────────────────────────────────
-- "만엔씩 걷자" 하고 **현지통화로 똑같이** 모은다. 각자 얼마의 환율로 바꿨는지
-- 따져서 걷지 않는다.
--
-- 그래서 공동 지갑은 **현지통화로만** 관리한다.
--
--     각자 넣은 금액   A 10,000엔 · B 10,000엔 · C 10,000엔
--     지출            8,500엔
--     남은 돈         21,500엔  ← 똑같이 넣었으니 똑같이 나온다
--
-- ⚠️ 원화 환산은 **맨 마지막에 한 번**만 한다. 중간에 사람마다 다른 환율로
--    환산하면, 봉투에 섞인 돈을 누구 것인지 가르는 셈이라 오히려 불공정해진다.
--
-- ⚠️ 이걸 「사람마다 환전 실적」(trip_cash_rates)과 헷갈리면 안 된다.
--    저건 **혼자 쓴 현금**에 쓰고, 이건 **같이 모아 쓴 현금**에 쓴다.
--
-- 대원칙 준수 확인:
--   - 새 표 하나 + 기존 표에 기본값 있는 칸 하나
--   - 지금 쌓인 지출은 전부 개인 결제라 기본값 그대로가 정답이다


-- ─────────────────────────────────────────────────────────────
-- 1) 이 지출을 공동 지갑에서 냈나
-- ─────────────────────────────────────────────────────────────
alter table public.expenses
  add column if not exists from_pool boolean not null default false;

comment on column public.expenses.from_pool is
  '공동 현금 지갑에서 낸 지출인가. true 면 payer_id 는 «누가 계산했나» 일 뿐 '
  '«누가 돈을 냈나» 가 아니다 — 낸 사람은 지갑에 돈을 넣은 사람들이다. '
  '⚠️ 그래서 정산에서 이 지출은 payer 의 «낸 금액» 에 더하지 않는다.';


-- ─────────────────────────────────────────────────────────────
-- 2) 누가 얼마를 넣었나 (현지통화)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.trip_cash_pool (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  /** 모은 통화 (JPY·VND…) */
  currency text not null,
  /**
   * 넣은 금액 — **현지통화 그대로**다.
   * ⚠️ 원화로 담지 않는다. "만엔씩" 이 실제로 오간 단위이고, 원화로 바꿔
   *    담으면 사람마다 다른 환율이 끼어들어 봉투를 다시 가르게 된다.
   */
  amount numeric not null check (amount > 0),
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id, currency)
);

comment on table public.trip_cash_pool is
  '공동 현금 지갑에 각자 넣은 금액(현지통화). "만엔씩 걷자" 를 그대로 담는다. '
  '정산에서는 이 금액이 그 사람의 «낸 돈» 이 되고, 지갑에서 나간 지출은 '
  '참여자들이 나눠 부담한다.';

alter table public.trip_cash_pool enable row level security;

/* 카드 수수료율·환전 실적과 같은 규칙 */
drop policy if exists "trip_cash_pool_select" on public.trip_cash_pool;
create policy "trip_cash_pool_select"
  on public.trip_cash_pool for select
  using (can_access_trip_settlement(trip_id));

drop policy if exists "trip_cash_pool_insert" on public.trip_cash_pool;
create policy "trip_cash_pool_insert"
  on public.trip_cash_pool for insert
  to authenticated
  with check (can_access_trip_settlement(trip_id));

drop policy if exists "trip_cash_pool_update" on public.trip_cash_pool;
create policy "trip_cash_pool_update"
  on public.trip_cash_pool for update
  to authenticated
  using (can_access_trip_settlement(trip_id))
  with check (can_access_trip_settlement(trip_id));

drop policy if exists "trip_cash_pool_delete" on public.trip_cash_pool;
create policy "trip_cash_pool_delete"
  on public.trip_cash_pool for delete
  to authenticated
  using (can_access_trip_settlement(trip_id));
