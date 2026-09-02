-- WITHTRIP: 사람마다 다른 카드 수수료율
--
-- ─────────────────────────────────────────────────────────────
-- 왜 여행에 하나로는 부족한가
-- ─────────────────────────────────────────────────────────────
-- 처음엔 `trips.fx_fee_rate` 하나로 뒀다. 그런데 **사람마다 쓰는 카드가 다르다.**
-- 카드마다 국제브랜드 수수료·해외서비스 수수료가 조금씩 달라서, 한 사람 카드로
-- 맞춘 값을 남에게 그대로 쓰면 그만큼 어긋난다.
--
-- 그리고 **각자 자기 명세서만 보면 된다** — 남의 카드 명세서를 볼 일도, 한
-- 사람이 모두를 대신해 찾아 헤맬 일도 없다. 각자 한 건씩만 넣으면 된다.
--
-- ⚠️ 안 넣은 사람은 `trips.fx_fee_rate`(어림값 2.3%)로 계산한다. **한 명이라도
--    안 넣었다고 정산이 멈추면 안 된다** — 어림값으로라도 답은 나와야 한다.
--
-- 대원칙 준수 확인:
--   - 새 표 하나만 만든다. 기존 표·행을 건드리지 않는다
--   - trips.fx_fee_rate 는 그대로 둔다 (안 맞춘 사람의 기본값으로 계속 쓴다)
--   - 실패해도 지금 정산은 그대로 동작한다

create table if not exists public.trip_fx_fees (
  trip_id uuid not null references public.trips(id) on delete cascade,
  /** 결제자. 이 사람이 낸 지출에만 이 수수료율을 쓴다 */
  user_id uuid not null references public.profiles(id) on delete cascade,
  /** 카드 해외 결제 수수료율 (0.0236 = 2.36%) */
  fee_rate numeric not null,
  /**
   * 무엇으로 맞췄는지 — 되짚어 볼 수 있게 남긴다.
   * ⚠️ 나중에 "이 숫자 왜 이래?" 가 반드시 나온다. 근거가 없으면 답할 수 없다.
   */
  source_expense_id uuid references public.expenses(id) on delete set null,
  actual_krw numeric,
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

comment on table public.trip_fx_fees is
  '여행별·사람별 카드 해외 결제 수수료율. 각자 자기 명세서에서 결제 한 건의 '
  '실제 청구액을 넣으면 역산된다. 없으면 trips.fx_fee_rate(어림값)를 쓴다.';

alter table public.trip_fx_fees enable row level security;

/*
  ⚠️ **읽기는 여행 사람 모두에게 연다.** 정산 금액을 계산하려면 남의 수수료율도
     필요하다 — 내 몫이 남이 낸 지출에서도 나오기 때문이다.
  ⚠️ 쓰기도 여행 사람이면 되게 둔다. 카드값을 대신 불러 주는 일이 흔한데
     (「내 거 2.4% 나왔어」), 본인만 쓰게 막으면 그걸 못 넣는다.
     같은 여행에 있는 사람끼리라 위험이 크지 않다.
*/
drop policy if exists "trip_fx_fees_select" on public.trip_fx_fees;
create policy "trip_fx_fees_select"
  on public.trip_fx_fees for select
  using (can_access_trip_settlement(trip_id));

drop policy if exists "trip_fx_fees_insert" on public.trip_fx_fees;
create policy "trip_fx_fees_insert"
  on public.trip_fx_fees for insert
  to authenticated
  with check (can_access_trip_settlement(trip_id));

drop policy if exists "trip_fx_fees_update" on public.trip_fx_fees;
create policy "trip_fx_fees_update"
  on public.trip_fx_fees for update
  to authenticated
  using (can_access_trip_settlement(trip_id))
  with check (can_access_trip_settlement(trip_id));

drop policy if exists "trip_fx_fees_delete" on public.trip_fx_fees;
create policy "trip_fx_fees_delete"
  on public.trip_fx_fees for delete
  to authenticated
  using (can_access_trip_settlement(trip_id));
