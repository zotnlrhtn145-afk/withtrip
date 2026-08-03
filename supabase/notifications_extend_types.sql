-- WITHTRIP: notifications.type 확장 — 친구 요청 수락 + 새 클립 게시 알림
-- Supabase Dashboard → SQL Editor에서 실행하세요.

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
      'trip_invite',
      'clip_invite',
      'friend_request',
      'clip_like',
      'clip_comment',
      'friend_accepted',
      'clip_post'
    ));
exception when others then
  null;
end $$;
