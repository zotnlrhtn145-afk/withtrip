-- One immutable row moves both currencies atomically. No expense or personal deposit is created.
create table public.trip_wallet_exchanges (
 id uuid primary key,
 trip_id uuid not null references public.trips(id) on delete cascade,
 from_currency text not null check (from_currency ~ '^[A-Z]{3}$'),
 to_currency text not null check (to_currency ~ '^[A-Z]{3}$' and to_currency<>from_currency),
 from_amount numeric not null check (from_amount>0 and from_amount<=2000000000),
 to_amount numeric not null check (to_amount>0 and to_amount<=2000000000),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default clock_timestamp()
);
create index trip_wallet_exchanges_trip_idx on public.trip_wallet_exchanges(trip_id);
alter table public.trip_wallet_exchanges enable row level security;
revoke all on public.trip_wallet_exchanges from public, anon, authenticated;
grant select,insert on public.trip_wallet_exchanges to authenticated;
create policy exchange_read on public.trip_wallet_exchanges for select to authenticated using (public.can_access_trip_settlement(trip_id));
create policy exchange_add on public.trip_wallet_exchanges for insert to authenticated with check (created_by=auth.uid() and public.can_access_trip_settlement(trip_id));
-- Capability marker is compatibility, never authentication. RLS still verifies membership.
create function public.require_cash_exchange_client(p_trip uuid,p_required boolean default false) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.can_access_trip_settlement(p_trip) then return false; end if;
 if coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-withtrip-wallet-version','')<>'2'
 and (p_required or exists(select 1 from trip_wallet_exchanges where trip_id=p_trip)) then
  raise exception '환전 내역이 있는 공동 지갑입니다. 위드트립 앱을 최신 버전으로 업데이트해 주세요.';
 end if;
 return true;
end $$;
revoke all on function public.require_cash_exchange_client(uuid,boolean) from public,anon;
grant execute on function public.require_cash_exchange_client(uuid,boolean) to authenticated;
alter policy wallet_read on public.trip_wallet_entries using (public.can_access_trip_settlement(trip_id) and public.require_cash_exchange_client(trip_id));
create function public.check_wallet_exchange() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare available numeric;
begin
 if auth.uid() is null or not public.can_access_trip_settlement(new.trip_id) then raise exception '공동 지갑 접근 권한이 없습니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.trip_id::text,0));
 perform public.require_cash_exchange_client(new.trip_id,true);
 if new.from_amount<>round(new.from_amount,case when new.from_currency in ('KRW','VND','JPY') then 0 else 2 end)
 or new.to_amount<>round(new.to_amount,case when new.to_currency in ('KRW','VND','JPY') then 0 else 2 end) then raise exception '통화의 소수 자릿수를 확인해 주세요.'; end if;
 select coalesce(sum(case when kind='deposit' then amount else -amount end),0) into available from trip_wallet_entries where trip_id=new.trip_id and currency=new.from_currency;
 available:=available+coalesce((select sum(case when to_currency=new.from_currency then to_amount else 0 end-case when from_currency=new.from_currency then from_amount else 0 end) from trip_wallet_exchanges where trip_id=new.trip_id),0);
 available:=available-coalesce((select sum(amount) from expenses where trip_id=new.trip_id and currency=new.from_currency and from_pool),0);
 if new.from_amount>available then raise exception '환전할 공동 현금이 부족합니다.'; end if;
 new.created_at:=clock_timestamp();
 return new;
end $$;
revoke all on function public.check_wallet_exchange() from public,anon,authenticated;
create trigger wallet_exchange_check before insert on public.trip_wallet_exchanges for each row execute function public.check_wallet_exchange();

create or replace function public.check_wallet_entry() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare available numeric;
begin
 if auth.uid() is null or not public.can_access_trip_settlement(new.trip_id) then raise exception '공동 지갑 접근 권한이 없습니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.trip_id::text,0));
 perform public.require_cash_exchange_client(new.trip_id);
 if not (exists(select 1 from trips where id=new.trip_id and user_id=new.person_id)
 or exists(select 1 from trip_members where trip_id=new.trip_id and user_id=new.person_id and status='accepted')
 or exists(select 1 from settlement_guests where trip_id=new.trip_id and id=new.person_id)) then raise exception '여행 참여자를 선택해 주세요.'; end if;
 if new.amount <> round(new.amount,case when new.currency in ('KRW','VND','JPY') then 0 else 2 end) then raise exception '통화의 소수 자릿수를 확인해 주세요.'; end if;
 if new.currency='KRW' and new.fx_rate<>1 then raise exception '원화 환율은 1이어야 합니다.'; end if;
 if new.kind='refund' then
  select coalesce(sum(case when kind='deposit' then amount else -amount end),0) into available from trip_wallet_entries where trip_id=new.trip_id and currency=new.currency;
  available:=available+coalesce((select sum(case when to_currency=new.currency then to_amount else 0 end-case when from_currency=new.currency then from_amount else 0 end) from trip_wallet_exchanges where trip_id=new.trip_id),0);
 available:=available-coalesce((select sum(amount) from expenses where trip_id=new.trip_id and currency=new.currency and from_pool),0);
  if new.amount>available then raise exception '공동 지갑 잔액보다 많이 돌려줄 수 없습니다.'; end if;
 end if;
 new.created_at:=clock_timestamp();
 return new;
end $$;
revoke all on function public.check_wallet_entry() from public, anon, authenticated;

create or replace function public.check_wallet_expense() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare available numeric; previous numeric:=0;
begin
 if tg_op='UPDATE' and old.from_pool then perform pg_advisory_xact_lock(hashtextextended(old.trip_id::text,0)); end if;
 if tg_op='UPDATE' and old.from_pool and exists(select 1 from trip_wallet_exchanges where trip_id=old.trip_id and created_at>=old.created_at) then
  raise exception '환전에 반영된 공동 지출은 수정할 수 없습니다. 장부 확인이 필요합니다.';
 end if;
 if not new.from_pool then return new; end if;
 if auth.uid() is null or not public.can_access_trip_settlement(new.trip_id) then raise exception '공동 지갑 접근 권한이 없습니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.trip_id::text,0));
 perform public.require_cash_exchange_client(new.trip_id);
 if tg_op='UPDATE' and old.from_pool and old.trip_id=new.trip_id and old.currency=new.currency then previous:=old.amount; end if;
 select coalesce(sum(case when kind='deposit' then amount else -amount end),0) into available from trip_wallet_entries where trip_id=new.trip_id and currency=new.currency;
 available:=available+coalesce((select sum(case when to_currency=new.currency then to_amount else 0 end-case when from_currency=new.currency then from_amount else 0 end) from trip_wallet_exchanges where trip_id=new.trip_id),0);
 available:=available-coalesce((select sum(amount) from expenses where trip_id=new.trip_id and currency=new.currency and from_pool),0)+previous;
 if new.amount>available then raise exception '공동 지갑 잔액이 부족합니다. 먼저 입금해 주세요.'; end if;
 if new.amount<=0 or new.amount<>round(new.amount,case when new.currency in ('KRW','VND','JPY') then 0 else 2 end) then raise exception '현금 금액을 확인해 주세요.'; end if;
 if tg_op='INSERT' then new.created_at:=clock_timestamp(); end if;
 new.paid_cash:=true;
 return new;
end $$;
revoke all on function public.check_wallet_expense() from public, anon, authenticated;
-- Preserve inputs used to allocate an immutable exchange. Corrections require an explicit ledger adjustment.
create function public.protect_exchanged_cash_expense() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if old.from_pool and exists(select 1 from trips where id=old.trip_id) then
  perform pg_advisory_xact_lock(hashtextextended(old.trip_id::text,0));
  if exists(select 1 from trip_wallet_exchanges where trip_id=old.trip_id and created_at>=old.created_at) then
   raise exception '환전에 반영된 공동 지출은 삭제할 수 없습니다. 장부 확인이 필요합니다.';
  end if;
 end if;
 return old;
end $$;
revoke all on function public.protect_exchanged_cash_expense() from public,anon,authenticated;
create trigger protect_exchanged_cash_expense before delete on public.expenses for each row execute function public.protect_exchanged_cash_expense();
create function public.protect_exchanged_cash_parts() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare e record; target uuid;
begin
 target:=case when tg_op='DELETE' then old.expense_id else new.expense_id end;
 for e in select id,trip_id,created_at from expenses where from_pool and (id=target or (tg_op='UPDATE' and id=old.expense_id)) loop
  perform pg_advisory_xact_lock(hashtextextended(e.trip_id::text,0));
  if exists(select 1 from trip_wallet_exchanges where trip_id=e.trip_id and created_at>=e.created_at) then
   raise exception '환전에 반영된 공동 지출의 분담자는 변경할 수 없습니다. 장부 확인이 필요합니다.';
  end if;
 end loop;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.protect_exchanged_cash_parts() from public,anon,authenticated;
create trigger protect_exchanged_cash_parts before insert or update or delete on public.expense_participants for each row execute function public.protect_exchanged_cash_parts();
