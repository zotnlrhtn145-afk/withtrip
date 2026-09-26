alter table public.google_maps_budget
  add column if not exists notification_user_id uuid references auth.users(id) on delete set null;

-- Bind only the existing sole administrator; never broadcast to all members.
do $$
begin
  if (select count(*) from auth.users u join public.bug_admins b on lower(b.email)=lower(u.email)) <> 1 then
    raise exception 'A single budget notification recipient must be configured';
  end if;
  update public.google_maps_budget set notification_user_id=(
    select u.id from auth.users u join public.bug_admins b on lower(b.email)=lower(u.email)
  ) where id=true and notification_user_id is null;
end $$;

create table public.google_maps_budget_alerts (
  version bigint primary key,
  notification_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.google_maps_budget_alerts enable row level security;
revoke all on public.google_maps_budget_alerts from public, anon, authenticated;
grant select, insert on public.google_maps_budget_alerts to service_role;

create function public.notify_google_maps_budget_exhausted()
returns trigger language plpgsql security invoker set search_path='' as $$
declare alert_id uuid := gen_random_uuid();
begin
  -- Initial zero approval is already explained; emit only for approved tranches.
  if not new.paused or new.version <= 0 or new.notification_user_id is null then return new; end if;
  insert into public.google_maps_budget_alerts(version,notification_id)
    values(new.version,alert_id) on conflict(version) do nothing;
  if not found then return new; end if;
  -- Notification + deduplication are atomic. Existing INSERT webhook delivers push.
  insert into public.notifications(id,user_id,type,message,payload,status,is_read)
    values(alert_id,new.notification_user_id,'announcement',
      '구글 지도·장소 사용 한도에 도달해 새 유료 조회를 중지했어요. 관리자 비용 화면에서 다음 10만 원 사용을 승인해 주세요. 자동 결제·자동 승인은 하지 않았어요.',
      jsonb_build_object('kind','maps_budget_exhausted','budgetVersion',new.version,
        'approvalUrl','https://www.withtrip.co.kr/_admin/costs'), 'pending', false);
  return new;
end;
$$;
revoke all on function public.notify_google_maps_budget_exhausted() from public,anon,authenticated;
grant execute on function public.notify_google_maps_budget_exhausted() to service_role;
create trigger google_maps_budget_exhausted_notification
  after update on public.google_maps_budget
  for each row when (new.paused = true and new.version > 0)
  execute function public.notify_google_maps_budget_exhausted();
