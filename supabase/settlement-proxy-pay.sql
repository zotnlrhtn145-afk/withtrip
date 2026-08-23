-- 대납: 남의 몫을 **대신 내주는** 경우.
--
-- 정산을 마칠 때 흔히 있는 일이다. 송금 정리는 이렇게 나왔는데
--
--     김동현 → 리뷰어   30,000원
--
-- 실제로는 오정환이 리뷰어에게 30,000원을 줬다. 김동현이 현금이 없거나,
-- 계좌이체가 안 되거나, 그냥 대신 내준 것이다.
--
-- ## 왜 "완료" 표시만으로는 안 되나
--
-- 그렇게 하면 **김동현의 빚이 사라진다.** 실제로는 갚을 상대가 리뷰어에서
-- 오정환으로 바뀐 것뿐인데 앱에서는 아무도 안 받을 돈이 된다. 대신 내준
-- 사람만 손해를 본다 — 정산 앱이 절대 하면 안 되는 일이다.
--
-- ## 어떻게 푸나
--
-- 대납은 **실제로 오간 돈**이므로 잔액에 그대로 반영한다.
--
--     오정환의 낸 돈 += 30,000     진짜로 냈으니까
--     리뷰어의 낸 돈 -= 30,000     받았으니 그만큼 덜 받을 상태가 된다
--     김동현은 그대로              아직 아무한테도 안 갚았다
--
-- 그러면 최소 송금을 다시 계산했을 때 갚을 상대가 저절로 바뀐다.
-- "남은 빚" 목록을 따로 만들 필요가 없다 — 원래 쓰던 계산이 답을 낸다.
--
-- ## ⚠️ `settlements` 에 컬럼 하나 붙이는 걸로는 안 된다 (해 보고 실패했다)
--
-- 처음엔 `settlements.paid_by` 로 했다. `settlements` 는 (여행, 보내는 이,
-- 받는 이) 하나당 한 줄이고 완료 여부를 담는 표다.
--
-- 그런데 **대납 뒤에 다시 계산한 송금이 같은 짝으로 나오는 경우가 있다.**
-- 실기기에서 그대로 나왔다 — 리뷰어가 90,000원을 내고 셋이 나눠 오정환·김동현이
-- 각 30,000원씩 빚졌고, 오정환이 김동현 몫을 대신 냈다. 그러면 오정환 자신의
-- 빚은 그대로라 최소 송금이 "김동현 → 리뷰어 30,000원" 한 줄로 정리된다
-- (오정환이 가운데서 상쇄된다). 옳은 답이다.
--
-- 짝이 같으니 **새로 생긴 빚이 옛 줄의 '완료' 를 물려받아** 이미 갚은 것으로
-- 표시됐다. 한 줄에 "끝난 옛 빚" 과 "안 갚은 새 빚" 을 동시에 담을 수 없다.
--
-- 그래서 대납은 **따로 적는다.** `settlements` 는 계속 계산된 송금의 완료
-- 표시로만 쓴다.
--
-- ⚠️ 외래키를 걸지 않는다. `settlements` 도 이미 외래키를 뗀 상태다 —
--    **정산 전용 게스트**(`settlement_guests`)는 `auth.users` 에 없기 때문이다.
--    대납자도, 대납받는 사람도 게스트일 수 있다.
--    (settlements-allow-guests.sql 에 그 사연이 적혀 있다)

-- 처음 시도의 흔적을 지운다. 쓰지 않는 칸을 남겨 두면 다음 사람이 그걸 믿는다.
alter table public.settlements drop column if exists paid_by;

create table if not exists public.settlement_proxies (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  /** 원래 낼 사람 — 이 사람의 빚은 사라지지 않고 갚을 상대만 바뀐다 */
  debtor_id uuid not null,
  /** 실제로 받은 사람 */
  to_user_id uuid not null,
  /** 대신 낸 사람 */
  payer_id uuid not null,
  amount integer not null check (amount > 0),
  created_by uuid,
  created_at timestamptz not null default now()
);

comment on table public.settlement_proxies is
  '대납 — 남의 몫을 대신 내준 기록. 실제로 오간 돈이므로 정산 잔액에 그대로 반영된다.';

create index if not exists settlement_proxies_trip_idx
  on public.settlement_proxies (trip_id);

alter table public.settlement_proxies enable row level security;

/*
  같은 여행 사람만 읽고 쓴다.
  ⚠️ 게스트는 계정이 없어서 `auth.uid()` 로 못 가린다 — 여행에 속한 사람인지만 본다.
*/
drop policy if exists "settlement_proxies_rw" on public.settlement_proxies;
create policy "settlement_proxies_rw"
  on public.settlement_proxies
  for all
  to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = settlement_proxies.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members m
            where m.trip_id = t.id and m.user_id = auth.uid() and m.status = 'accepted'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = settlement_proxies.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members m
            where m.trip_id = t.id and m.user_id = auth.uid() and m.status = 'accepted'
          )
        )
    )
  );
