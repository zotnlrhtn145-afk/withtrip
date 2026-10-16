-- 공동 현금 장부: 기존 이월금/개인 지출은 변경하지 않습니다.
create table public.trip_wallet_entries (
 id uuid primary key default gen_random_uuid(),
 trip_id uuid not null references public.trips(id) on delete cascade,
 person_id uuid not null,
 currency text not null check (currency ~ '^[A-Z]{3}$'),
 kind text not null check (kind in ('deposit','refund')),
 amount numeric not null check (amount > 0 and amount <= 2000000000),
 fx_rate numeric not null check (fx_rate > 0 and fx_rate <= 10000000),
 payout_currency text,
 payout_amount numeric,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 check ((payout_currency is null and payout_amount is null) or (kind='refund' and payout_currency='KRW' and payout_amount > 0 and payout_amount <= 2000000000))
);
create index trip_wallet_entries_trip_currency_idx on public.trip_wallet_entries(trip_id,currency,created_at);
alter table public.trip_wallet_entries enable row level security;
revoke all on public.trip_wallet_entries from anon, authenticated;
grant select,insert on public.trip_wallet_entries to authenticated;
create policy wallet_read on public.trip_wallet_entries for select to authenticated using (public.can_access_trip_settlement(trip_id));
create policy wallet_add on public.trip_wallet_entries for insert to authenticated with check (created_by=auth.uid() and public.can_access_trip_settlement(trip_id));

create function public.check_wallet_entry() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare available numeric;
begin
 if auth.uid() is null or not public.can_access_trip_settlement(new.trip_id) then raise exception '공동 지갑 접근 권한이 없습니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.trip_id::text,0));
 if not (exists(select 1 from trips where id=new.trip_id and user_id=new.person_id)
 or exists(select 1 from trip_members where trip_id=new.trip_id and user_id=new.person_id and status='accepted')
 or exists(select 1 from settlement_guests where trip_id=new.trip_id and id=new.person_id)) then raise exception '여행 참여자를 선택해 주세요.'; end if;
 if new.amount <> round(new.amount,case when new.currency in ('KRW','VND','JPY') then 0 else 2 end) then raise exception '통화의 소수 자릿수를 확인해 주세요.'; end if;
 if new.currency='KRW' and new.fx_rate<>1 then raise exception '원화 환율은 1이어야 합니다.'; end if;
 if new.kind='refund' then
  select coalesce(sum(case when kind='deposit' then amount else -amount end),0) into available from trip_wallet_entries where trip_id=new.trip_id and currency=new.currency;
  available:=available-coalesce((select sum(amount) from expenses where trip_id=new.trip_id and currency=new.currency and from_pool),0);
  if new.amount>available then raise exception '공동 지갑 잔액보다 많이 돌려줄 수 없습니다.'; end if;
 end if;
 return new;
end $$;
revoke all on function public.check_wallet_entry() from public, anon, authenticated;
create trigger wallet_entry_check before insert on public.trip_wallet_entries for each row execute function public.check_wallet_entry();

create function public.check_wallet_expense() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare available numeric; previous numeric:=0;
begin
 if not new.from_pool then return new; end if;
 if auth.uid() is null or not public.can_access_trip_settlement(new.trip_id) then raise exception '공동 지갑 접근 권한이 없습니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.trip_id::text,0));
 if tg_op='UPDATE' and old.from_pool and old.trip_id=new.trip_id and old.currency=new.currency then previous:=old.amount; end if;
 select coalesce(sum(case when kind='deposit' then amount else -amount end),0) into available from trip_wallet_entries where trip_id=new.trip_id and currency=new.currency;
 available:=available-coalesce((select sum(amount) from expenses where trip_id=new.trip_id and currency=new.currency and from_pool),0)+previous;
 if new.amount>available then raise exception '공동 지갑 잔액이 부족합니다. 먼저 입금해 주세요.'; end if;
 if new.amount<=0 or new.amount<>round(new.amount,case when new.currency in ('KRW','VND','JPY') then 0 else 2 end) then raise exception '현금 금액을 확인해 주세요.'; end if;
 new.paid_cash:=true;
 return new;
end $$;
revoke all on function public.check_wallet_expense() from public, anon, authenticated;
create trigger wallet_expense_check before insert or update on public.expenses for each row execute function public.check_wallet_expense();

-- 지출과 분담자는 한 트랜잭션으로 저장합니다. 중간 실패 시 잔액도 원복됩니다.
create function public.save_cash_wallet_expense(p_trip_id uuid,p_expense_id uuid,p_fields jsonb,p_parts jsonb)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare saved uuid; part jsonb; pid uuid; total numeric; fixed numeric:=0; blanks integer:=0; seen uuid[]:='{}';
begin
 if auth.uid() is null or not public.can_access_trip_settlement(p_trip_id) then raise exception '정산 접근 권한이 없습니다.'; end if;
 if jsonb_typeof(p_parts)<>'array' or jsonb_array_length(p_parts)=0 then raise exception '분담자를 선택해 주세요.'; end if;
 total:=(p_fields->>'amount')::numeric;
 if total is null or total<=0 then raise exception '금액을 확인해 주세요.'; end if;
 if not exists(select 1 from trips where id=p_trip_id and user_id=(p_fields->>'payer_id')::uuid)
 and not exists(select 1 from trip_members where trip_id=p_trip_id and user_id=(p_fields->>'payer_id')::uuid and status='accepted') then raise exception '계산한 사람을 확인해 주세요.'; end if;
 for part in select value from jsonb_array_elements(p_parts) loop
  pid:=(part->>'id')::uuid;
  if pid is null or pid=any(seen) then raise exception '중복되거나 누락된 분담자입니다.'; end if;
  seen:=array_append(seen,pid);
  if not exists(select 1 from trips where id=p_trip_id and user_id=pid)
  and not exists(select 1 from trip_members where trip_id=p_trip_id and user_id=pid and status='accepted')
  and not exists(select 1 from settlement_guests where trip_id=p_trip_id and id=pid) then raise exception '여행 참여자가 아닙니다.'; end if;
  if part->>'amount' is null then blanks:=blanks+1;
  else
   if (part->>'amount')::numeric<0 or (part->>'amount')::numeric<>round((part->>'amount')::numeric,case when p_fields->>'currency' in ('KRW','VND','JPY') then 0 else 2 end) then raise exception '분담액을 확인해 주세요.'; end if;
   fixed:=fixed+(part->>'amount')::numeric;
  end if;
 end loop;
 if fixed>total or (blanks=0 and fixed<>total) then raise exception '분담액 합계를 확인해 주세요.'; end if;
 if p_expense_id is null then
  insert into expenses(trip_id,title,amount,category,payer_id,expense_date,expense_time,currency,fx_rate,from_pool,paid_cash)
  values(p_trip_id,p_fields->>'title',total,p_fields->>'category',(p_fields->>'payer_id')::uuid,(p_fields->>'expense_date')::date,p_fields->>'expense_time',p_fields->>'currency',(p_fields->>'fx_rate')::numeric,(p_fields->>'from_pool')::boolean,(p_fields->>'paid_cash')::boolean) returning id into saved;
 else
  update expenses set title=p_fields->>'title',amount=total,category=p_fields->>'category',payer_id=(p_fields->>'payer_id')::uuid,expense_date=(p_fields->>'expense_date')::date,expense_time=p_fields->>'expense_time',currency=p_fields->>'currency',fx_rate=(p_fields->>'fx_rate')::numeric,from_pool=(p_fields->>'from_pool')::boolean,paid_cash=(p_fields->>'paid_cash')::boolean where id=p_expense_id and trip_id=p_trip_id returning id into saved;
  if saved is null then raise exception '지출을 찾을 수 없거나 수정 권한이 없습니다.'; end if;
  delete from expense_participants where expense_id=saved;
 end if;
 for part in select value from jsonb_array_elements(p_parts) loop
  pid:=(part->>'id')::uuid;
  if exists(select 1 from settlement_guests where trip_id=p_trip_id and id=pid) then
   insert into expense_participants(expense_id,guest_id,share_amount) values(saved,pid,(part->>'amount')::numeric);
  else insert into expense_participants(expense_id,user_id,share_amount) values(saved,pid,(part->>'amount')::numeric);
  end if;
 end loop;
 return saved;
end $$;
revoke all on function public.save_cash_wallet_expense(uuid,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.save_cash_wallet_expense(uuid,uuid,jsonb,jsonb) to authenticated;
