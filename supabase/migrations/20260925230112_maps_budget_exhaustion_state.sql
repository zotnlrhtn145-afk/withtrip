create or replace function public.reserve_google_maps_budget(p_request_id uuid, p_operation text, p_units integer, p_caller text default null)
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
  update public.google_maps_budget set reserved_won=reserved_won+cost,
    paused=(approved_won-safety_won-reserved_won-cost < 20),
    blocked_at=case when approved_won-safety_won-reserved_won-cost < 20 then now() else blocked_at end,
    updated_at=now() where id=true;
  return jsonb_build_object('allowed',true,'remaining_won',b.approved_won-b.safety_won-b.reserved_won-cost);
end;
$$;

