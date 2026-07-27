-- Expenses & Settlements for trip cost splitting
-- Run in Supabase SQL editor

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null,
  amount integer not null check (amount > 0),
  category text not null check (category in ('숙소', '식사', '교통', '기타')),
  payer_id uuid not null references auth.users (id) on delete cascade,
  expense_date date not null default current_date,
  receipt_url text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_trip_id_idx on public.expenses (trip_id);
create index if not exists expenses_payer_id_idx on public.expenses (payer_id);
create index if not exists expenses_created_at_idx on public.expenses (created_at desc);

-- Existing projects: ensure receipt_url column exists
alter table public.expenses add column if not exists receipt_url text;

-- Storage: also run supabase/receipts-storage.sql (bucket `receipts` + policies)

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, from_user_id, to_user_id)
);

create index if not exists settlements_trip_id_idx on public.settlements (trip_id);

-- Per-expense participants (variable split)
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

alter table public.expenses enable row level security;
alter table public.settlements enable row level security;

-- Authenticated members can manage expenses/settlements for trips they belong to.
-- Policies are intentionally permissive for authenticated users; tighten with trip_members checks if needed.

drop policy if exists "expenses_select_authenticated" on public.expenses;
create policy "expenses_select_authenticated"
  on public.expenses for select to authenticated using (true);

drop policy if exists "expenses_insert_authenticated" on public.expenses;
create policy "expenses_insert_authenticated"
  on public.expenses for insert to authenticated with check (true);

drop policy if exists "expenses_update_authenticated" on public.expenses;
create policy "expenses_update_authenticated"
  on public.expenses for update to authenticated using (true) with check (true);

drop policy if exists "expenses_delete_authenticated" on public.expenses;
create policy "expenses_delete_authenticated"
  on public.expenses for delete to authenticated using (true);

drop policy if exists "settlements_select_authenticated" on public.settlements;
create policy "settlements_select_authenticated"
  on public.settlements for select to authenticated using (true);

drop policy if exists "settlements_insert_authenticated" on public.settlements;
create policy "settlements_insert_authenticated"
  on public.settlements for insert to authenticated with check (true);

drop policy if exists "settlements_update_authenticated" on public.settlements;
create policy "settlements_update_authenticated"
  on public.settlements for update to authenticated using (true) with check (true);

drop policy if exists "settlements_delete_authenticated" on public.settlements;
create policy "settlements_delete_authenticated"
  on public.settlements for delete to authenticated using (true);
