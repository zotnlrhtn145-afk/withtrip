-- Maps spending approval is an application control, not prepaid Google billing.
-- New installations start closed. No automatic top-up or calendar reset.
begin;
create table public.google_maps_budget (
  id boolean primary key default true check (id),
  approved_won bigint not null default 0 check (approved_won >= 0),
  reserved_won bigint not null default 0 check (reserved_won >= 0),
  safety_won integer not null default 10000 check (safety_won >= 0),
  version integer not null default 0,
  paused boolean not null default true,
  blocked_at timestamptz default now(),
  updated_at timestamptz not null default now()
);
create table public.google_maps_budget_approvals (
  request_id uuid primary key,
  version integer not null unique,
  amount_won integer not null check (amount_won = 100000),
  approved_by text not null,
  created_at timestamptz not null default now()
);
create table public.google_maps_budget_reservations (
  request_id uuid primary key,
  operation text not null,
  cost_won bigint not null check (cost_won > 0),
  caller text,
  created_at timestamptz not null default now()
);
alter table public.google_maps_budget enable row level security;
alter table public.google_maps_budget_approvals enable row level security;
alter table public.google_maps_budget_reservations enable row level security;
revoke all on public.google_maps_budget, public.google_maps_budget_approvals, public.google_maps_budget_reservations from public, anon, authenticated;
grant select, insert, update on public.google_maps_budget, public.google_maps_budget_approvals, public.google_maps_budget_reservations to service_role;
insert into public.google_maps_budget(id) values(true);

create function public.reserve_google_maps_budget(p_request_id uuid, p_operation text, p_units integer, p_caller text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare b public.google_maps_budget%rowtype; unit_cost integer; cost bigint;
begin
  -- Conservative KRW reservation including VAT/FX headroom, no free tier credit.
  -- Verified 2026-09-26: photo $7/1k; search up to $40/1k; details up to $25/1k;
  -- legacy Contact/Atmosphere add-ons included in the 100 won reservation.
  unit_cost := case p_operation
    when 'photo' then 20 when 'geocode' then 20 when 'dynamic_map' then 20
    when 'details' then 100 when 'textsearch' then 100 when 'nearbysearch' then 100
    when 'autocomplete' then 100 when 'findplace' then 100
    when 'directions' then 50 when 'distance_matrix' then 50 else null end;
  if unit_cost is null or p_units is null or p_units < 1 or p_units > 625 or p_request_id is null then
    return jsonb_build_object('allowed',false,'reason','unsupported');
  end if;
  cost := unit_cost::bigint * p_units;
  select * into b from public.google_maps_budget where id = true for update;
  if not found then return jsonb_build_object('allowed',false,'reason','unavailable'); end if;
  -- A repeated reservation never spends twice; mismatched reuse is rejected.
  if exists(select 1 from public.google_maps_budget_reservations where request_id=p_request_id) then
    return jsonb_build_object('allowed', exists(select 1 from public.google_maps_budget_reservations
      where request_id=p_request_id and operation=p_operation and cost_won=cost), 'reason','reserved');
  end if;
  if b.paused or b.reserved_won + cost > b.approved_won - b.safety_won then
    update public.google_maps_budget set paused=true, blocked_at=coalesce(blocked_at,now()), updated_at=now() where id=true;
    return jsonb_build_object('allowed',false,'reason','approval_required');
  end if;
  insert into public.google_maps_budget_reservations(request_id,operation,cost_won,caller)
    values(p_request_id,p_operation,cost,left(p_caller,200));
  update public.google_maps_budget set reserved_won=reserved_won+cost,updated_at=now() where id=true;
  return jsonb_build_object('allowed',true,'remaining_won',b.approved_won-b.safety_won-b.reserved_won-cost);
end;
$$;

create function public.approve_google_maps_budget(p_request_id uuid, p_expected_version integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare b public.google_maps_budget%rowtype;
begin
  if p_request_id is null or p_expected_version is null then return false; end if;
  select * into b from public.google_maps_budget where id=true for update;
  if not found then return false; end if;
  if exists(select 1 from public.google_maps_budget_approvals where request_id=p_request_id) then return true; end if;
  -- Stale tabs, double submission with a different ID, and advance auto top-ups fail.
  if not b.paused or b.version <> p_expected_version then return false; end if;
  insert into public.google_maps_budget_approvals(request_id,version,amount_won,approved_by)
    values(p_request_id,b.version+1,100000,'owner-admin');
  update public.google_maps_budget set approved_won=approved_won+100000,version=version+1,
    paused=false,blocked_at=null,updated_at=now() where id=true;
  return true;
end;
$$;
revoke all on function public.reserve_google_maps_budget(uuid,text,integer,text), public.approve_google_maps_budget(uuid,integer) from public,anon,authenticated;
grant execute on function public.reserve_google_maps_budget(uuid,text,integer,text), public.approve_google_maps_budget(uuid,integer) to service_role;
commit;
