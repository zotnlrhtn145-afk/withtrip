-- Apply before server release. No billing state or user data is modified.
create table public.ai_billing_alerts (
  provider text not null check (provider = 'gemini'),
  alert_day date not null,
  http_status integer not null check (http_status in (402,403,429)),
  created_at timestamptz not null default now(),
  primary key (provider, alert_day)
);
alter table public.ai_billing_alerts enable row level security;
revoke all on public.ai_billing_alerts from public, anon, authenticated;
grant select, insert on public.ai_billing_alerts to service_role;

create function public.notify_ai_billing_failure()
returns trigger language plpgsql security invoker set search_path='' as $$
declare recipient uuid;
begin
  select notification_user_id into recipient from public.google_maps_budget where id=true;
  if recipient is null then raise exception 'AI billing alert recipient is not configured'; end if;
  insert into public.notifications(user_id,type,message,payload,status,is_read)
  values(recipient,'announcement',
    'Gemini AI 분석이 결제·선불 크레딧 문제로 중단됐어요. Google 지도 승인 한도와 별개입니다. AI Studio의 잔액을 확인해 주세요. 자동 충전은 하지 않았어요.',
    jsonb_build_object('kind','ai_billing_unavailable','provider',new.provider,
      'checkUrl','https://aistudio.google.com/billing'), 'pending',false);
  return new;
end;
$$;
revoke all on function public.notify_ai_billing_failure() from public,anon,authenticated;
grant execute on function public.notify_ai_billing_failure() to service_role;
create trigger ai_billing_failure_notification after insert on public.ai_billing_alerts
for each row execute function public.notify_ai_billing_failure();
