-- WITHTRIP: create_notification_safe RPC only
-- Supabase Dashboard → SQL Editor에서 실행하세요.
-- (notifications 테이블/컬럼이 이미 있을 때 RLS 42501 회피용)

create or replace function public.create_notification_safe(
  p_user_id uuid,
  p_actor_id uuid,
  p_type text,
  p_message text,
  p_reference_id uuid default null,
  p_trip_member_id uuid default null
)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  new_row public.notifications;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_actor_id is distinct from auth.uid() then
    raise exception 'actor_id must match authenticated user';
  end if;

  if p_user_id is null then
    raise exception 'user_id (recipient) is required';
  end if;

  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'message is required';
  end if;

  if p_type is null or length(trim(p_type)) = 0 then
    raise exception 'type is required';
  end if;

  if p_user_id = p_actor_id then
    raise exception 'cannot notify self';
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    sender_id,
    type,
    message,
    reference_id,
    trip_member_id,
    is_read,
    status
  ) values (
    p_user_id,
    p_actor_id,
    p_actor_id,
    p_type,
    p_message,
    p_reference_id,
    p_trip_member_id,
    false,
    'pending'
  )
  returning * into new_row;

  return new_row;
end;
$$;

revoke all on function public.create_notification_safe(uuid, uuid, text, text, uuid, uuid) from public;
grant execute on function public.create_notification_safe(uuid, uuid, text, text, uuid, uuid) to authenticated;
