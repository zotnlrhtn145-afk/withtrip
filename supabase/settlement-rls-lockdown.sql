-- 정산 테이블 RLS 잠그기 + expense_participants 무결성 제약
--
-- 배경:
--   expenses / expense_participants / settlements 의 정책이 전부 `true` 였다.
--   즉 **로그인만 하면 남의 여행 지출을 읽고 쓰고 지울 수 있었다.**
--   (settlement_guests 만 제대로 막혀 있었다 — 그 규칙을 나머지에도 맞춘다)
--
--   같이, expense_participants 에 (expense_id, guest_id) 유니크가 없어
--   같은 게스트가 한 지출에 두 번 들어갈 수 있었다. user_id 쪽에만 유니크가 있었다.
--
-- 규칙: 여행 소유자 + **수락한** 멤버만. settlement_guests 와 동일하게 맞춘다.
--   (초대 대기 중인 사람은 정산을 볼 이유가 없다. 대화방 쪽 is_trip_participant 는
--    pending 도 포함하지만, 정산은 돈이 걸려 있으므로 더 좁게 간다.)

-- ── 도우미 ───────────────────────────────────────────────
-- SECURITY DEFINER 로 두는 이유: 정책 안에서 trips/trip_members 를 직접 읽으면
-- 그 테이블의 RLS 가 다시 걸려 재귀가 생긴다.

create or replace function public.can_access_trip_settlement(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.user_id = auth.uid()
  ) or exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id
      and m.user_id = auth.uid()
      and m.status = 'accepted'
  );
$$;

-- expense_participants 에는 trip_id 가 없다 (expense_id 를 타고 가야 한다).
-- 정책 안에서 expenses 를 직접 읽으면 expenses 의 RLS 가 또 걸리므로 여기서 우회한다.
create or replace function public.can_access_expense(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_trip_settlement(
    (select e.trip_id from public.expenses e where e.id = p_expense_id)
  );
$$;

-- ── expenses ────────────────────────────────────────────
alter table public.expenses enable row level security;

drop policy if exists "expenses_select_authenticated" on public.expenses;
drop policy if exists "expenses_insert_authenticated" on public.expenses;
drop policy if exists "expenses_update_authenticated" on public.expenses;
drop policy if exists "expenses_delete_authenticated" on public.expenses;

drop policy if exists "expenses_select_participant" on public.expenses;
create policy "expenses_select_participant" on public.expenses
  for select to authenticated
  using (public.can_access_trip_settlement(trip_id));

drop policy if exists "expenses_insert_participant" on public.expenses;
create policy "expenses_insert_participant" on public.expenses
  for insert to authenticated
  with check (public.can_access_trip_settlement(trip_id));

drop policy if exists "expenses_update_participant" on public.expenses;
create policy "expenses_update_participant" on public.expenses
  for update to authenticated
  using (public.can_access_trip_settlement(trip_id))
  with check (public.can_access_trip_settlement(trip_id));

drop policy if exists "expenses_delete_participant" on public.expenses;
create policy "expenses_delete_participant" on public.expenses
  for delete to authenticated
  using (public.can_access_trip_settlement(trip_id));

-- ── expense_participants ────────────────────────────────
alter table public.expense_participants enable row level security;

drop policy if exists "expense_participants_select_authenticated" on public.expense_participants;
drop policy if exists "expense_participants_insert_authenticated" on public.expense_participants;
drop policy if exists "expense_participants_update_authenticated" on public.expense_participants;
drop policy if exists "expense_participants_delete_authenticated" on public.expense_participants;

drop policy if exists "expense_participants_select_participant" on public.expense_participants;
create policy "expense_participants_select_participant" on public.expense_participants
  for select to authenticated
  using (public.can_access_expense(expense_id));

drop policy if exists "expense_participants_insert_participant" on public.expense_participants;
create policy "expense_participants_insert_participant" on public.expense_participants
  for insert to authenticated
  with check (public.can_access_expense(expense_id));

drop policy if exists "expense_participants_update_participant" on public.expense_participants;
create policy "expense_participants_update_participant" on public.expense_participants
  for update to authenticated
  using (public.can_access_expense(expense_id))
  with check (public.can_access_expense(expense_id));

drop policy if exists "expense_participants_delete_participant" on public.expense_participants;
create policy "expense_participants_delete_participant" on public.expense_participants
  for delete to authenticated
  using (public.can_access_expense(expense_id));

-- ── settlements ─────────────────────────────────────────
alter table public.settlements enable row level security;

drop policy if exists "settlements_select_authenticated" on public.settlements;
drop policy if exists "settlements_insert_authenticated" on public.settlements;
drop policy if exists "settlements_update_authenticated" on public.settlements;
drop policy if exists "settlements_delete_authenticated" on public.settlements;

drop policy if exists "settlements_select_participant" on public.settlements;
create policy "settlements_select_participant" on public.settlements
  for select to authenticated
  using (public.can_access_trip_settlement(trip_id));

drop policy if exists "settlements_insert_participant" on public.settlements;
create policy "settlements_insert_participant" on public.settlements
  for insert to authenticated
  with check (public.can_access_trip_settlement(trip_id));

drop policy if exists "settlements_update_participant" on public.settlements;
create policy "settlements_update_participant" on public.settlements
  for update to authenticated
  using (public.can_access_trip_settlement(trip_id))
  with check (public.can_access_trip_settlement(trip_id));

drop policy if exists "settlements_delete_participant" on public.settlements;
create policy "settlements_delete_participant" on public.settlements
  for delete to authenticated
  using (public.can_access_trip_settlement(trip_id));

-- ── expense_participants 무결성 ─────────────────────────
-- 게스트 중복 방지. user_id 쪽에는 이미 UNIQUE (expense_id, user_id) 가 있다.
create unique index if not exists expense_participants_expense_guest_uidx
  on public.expense_participants (expense_id, guest_id)
  where guest_id is not null;

-- 사람이 아무도 안 가리키는 행(둘 다 null)이나 둘 다 가리키는 행을 막는다.
alter table public.expense_participants
  drop constraint if exists expense_participants_one_person_chk;
alter table public.expense_participants
  add constraint expense_participants_one_person_chk
  check (num_nonnulls(user_id, guest_id) = 1);
