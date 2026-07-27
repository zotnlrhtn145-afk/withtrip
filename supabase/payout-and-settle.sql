-- WITHTRIP: profiles payout fields + trips settlement completion
-- Run in Supabase Dashboard → SQL Editor

-- ---------------------------------------------------------------------------
-- profiles: bank / crypto payout receiving info
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nickname text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists bank_name text,
  add column if not exists account_number text,
  add column if not exists account_holder text,
  add column if not exists crypto_network text,
  add column if not exists crypto_address text;

comment on column public.profiles.bank_name is '정산 수령 은행명';
comment on column public.profiles.account_number is '정산 수령 계좌번호';
comment on column public.profiles.account_holder is '정산 수령 예금주';
comment on column public.profiles.crypto_network is '코인/네트워크 (Ethereum, Solana, USDT 등)';
comment on column public.profiles.crypto_address is '암호화폐 지갑 주소';

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;

-- Authenticated users can read profiles (needed for trip member embeds)
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- trips: settlement completion flags
-- ---------------------------------------------------------------------------
alter table public.trips
  add column if not exists is_settled boolean not null default false,
  add column if not exists settled_at timestamptz;

comment on column public.trips.is_settled is '여행 정산 완료 여부';
comment on column public.trips.settled_at is '정산 완료 시각';

-- Members (not only owners) may mark settlement complete for trips they joined
drop policy if exists "trips_update_member_settle" on public.trips;
create policy "trips_update_member_settle"
  on public.trips
  for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.trip_members tm
      where tm.trip_id = trips.id
        and tm.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.trip_members tm
      where tm.trip_id = trips.id
        and tm.user_id = auth.uid()
    )
  );
