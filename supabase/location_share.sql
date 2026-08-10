-- WITHTRIP: 위치(목적지) 공유 — 저장 안 해도 길찾기 목적지를 친구/여행에 공유.
-- 받는 사람은 알림으로 받고(앱·웹 공통), 탭/클릭하면 티맵/카카오내비/구글맵 길찾기로 연결.
-- 전부 idempotent.

-- ── 알림에 payload (길찾기 좌표 등) ──────────────────────────
alter table public.notifications add column if not exists payload jsonb;
comment on column public.notifications.payload is 'type=location_share 이면 { name, lat, lng, address }';

-- ── notifications.type 에 location_share 추가 ────────────────
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'notifications'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%type%in%';

  if constraint_name is not null then
    execute format('alter table public.notifications drop constraint %I', constraint_name);
  end if;

  alter table public.notifications
    add constraint notifications_type_check
    check (type in (
      'trip_invite', 'clip_invite', 'friend_request', 'clip_like', 'clip_comment',
      'friend_accepted', 'clip_post', 'place_recommendation', 'location_share'
    ));
exception when others then
  null;
end $$;

-- ── RPC: 친구 1명에게 위치 공유 알림 ─────────────────────────
create or replace function public.notify_location_friend(
  p_user_id uuid,
  p_actor_id uuid,
  p_message text,
  p_payload jsonb
)
returns public.notifications
language plpgsql security definer set search_path = public as $$
declare new_row public.notifications;
begin
  if auth.uid() is null or p_actor_id is distinct from auth.uid() then
    raise exception 'not authorized';
  end if;
  if p_user_id is null or p_user_id = p_actor_id then
    return null;
  end if;
  insert into public.notifications (user_id, actor_id, sender_id, type, message, payload, is_read, status)
  values (p_user_id, p_actor_id, p_actor_id, 'location_share',
          coalesce(nullif(trim(p_message), ''), '위치 공유'), p_payload, false, 'pending')
  returning * into new_row;
  return new_row;
end;
$$;

revoke all on function public.notify_location_friend(uuid, uuid, text, jsonb) from public;
grant execute on function public.notify_location_friend(uuid, uuid, text, jsonb) to authenticated;

-- ── RPC: 여행 참여자 전원(본인 제외)에게 위치 공유 알림 ──────
create or replace function public.notify_location_trip(
  p_trip_id uuid,
  p_actor_id uuid,
  p_message text,
  p_payload jsonb
)
returns integer
language plpgsql security definer set search_path = public as $$
declare cnt int := 0; m record;
begin
  if auth.uid() is null or p_actor_id is distinct from auth.uid() then
    raise exception 'not authorized';
  end if;
  for m in
    select distinct uid from (
      select user_id as uid from public.trip_members where trip_id = p_trip_id and status = 'accepted'
      union
      select user_id as uid from public.trips where id = p_trip_id
    ) t
    where uid is not null and uid <> p_actor_id
  loop
    insert into public.notifications (user_id, actor_id, sender_id, type, message, payload, is_read, status)
    values (m.uid, p_actor_id, p_actor_id, 'location_share',
            coalesce(nullif(trim(p_message), ''), '위치 공유'), p_payload, false, 'pending');
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;

revoke all on function public.notify_location_trip(uuid, uuid, text, jsonb) from public;
grant execute on function public.notify_location_trip(uuid, uuid, text, jsonb) to authenticated;
