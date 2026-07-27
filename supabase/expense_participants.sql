-- expense_participants: variable split members per expense
-- Run in Supabase SQL editor if the table is not yet created.

create table if not exists public.expense_participants (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (expense_id, user_id)
);

create index if not exists expense_participants_expense_id_idx
  on public.expense_participants (expense_id);
create index if not exists expense_participants_user_id_idx
  on public.expense_participants (user_id);

alter table public.expense_participants enable row level security;

drop policy if exists "expense_participants_select_authenticated" on public.expense_participants;
create policy "expense_participants_select_authenticated"
  on public.expense_participants for select to authenticated using (true);

drop policy if exists "expense_participants_insert_authenticated" on public.expense_participants;
create policy "expense_participants_insert_authenticated"
  on public.expense_participants for insert to authenticated with check (true);

drop policy if exists "expense_participants_update_authenticated" on public.expense_participants;
create policy "expense_participants_update_authenticated"
  on public.expense_participants for update to authenticated using (true) with check (true);

drop policy if exists "expense_participants_delete_authenticated" on public.expense_participants;
create policy "expense_participants_delete_authenticated"
  on public.expense_participants for delete to authenticated using (true);

-- Optional backfill: existing expenses without participants → all trip members
-- insert into public.expense_participants (expense_id, user_id)
-- select e.id, tm.user_id
-- from public.expenses e
-- join public.trip_members tm on tm.trip_id = e.trip_id
-- where not exists (
--   select 1 from public.expense_participants ep where ep.expense_id = e.id
-- )
-- on conflict do nothing;
