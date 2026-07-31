-- WITHTRIP: auto-sync profiles.nickname / avatar_url from auth.users (Kakao/Google OAuth)
-- + account deletion request flag for 마이페이지 회원 탈퇴
-- Run in Supabase Dashboard → SQL Editor

-- ---------------------------------------------------------------------------
-- profiles: deletion request flag (no destructive delete — reviewed manually)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists deletion_requested_at timestamptz;

comment on column public.profiles.deletion_requested_at is '회원 탈퇴 요청 시각 — 실제 삭제는 운영자가 수동 처리';

-- ---------------------------------------------------------------------------
-- Sync nickname / avatar_url from auth.users.raw_user_meta_data
-- (Kakao → nickname/avatar_url, Google → name/picture — Supabase normalizes
-- both into raw_user_meta_data on the auth.users row.)
-- Never clobbers a nickname/avatar the user already set in-app — only fills
-- the value in when the profiles column is still empty.
-- ---------------------------------------------------------------------------
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nickname text := coalesce(
    nullif(trim(meta->>'nickname'), ''),
    nullif(trim(meta->>'name'), ''),
    nullif(trim(meta->>'full_name'), ''),
    nullif(trim(meta->>'preferred_username'), '')
  );
  v_avatar text := coalesce(
    nullif(trim(meta->>'avatar_url'), ''),
    nullif(trim(meta->>'picture'), '')
  );
begin
  insert into public.profiles (id, email, nickname, avatar_url)
  values (new.id, new.email, v_nickname, v_avatar)
  on conflict (id) do update
    set email = excluded.email,
        nickname = coalesce(public.profiles.nickname, excluded.nickname),
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);
  return new;
end;
$$;

revoke all on function public.sync_profile_from_auth() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.sync_profile_from_auth();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of raw_user_meta_data, email on auth.users
  for each row execute function public.sync_profile_from_auth();

-- Backfill: create/fill profiles rows for users who signed up before this migration.
insert into public.profiles (id, email, nickname, avatar_url)
select
  u.id,
  u.email,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'nickname'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'preferred_username'), '')
  ),
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'avatar_url'), ''),
    nullif(trim(u.raw_user_meta_data->>'picture'), '')
  )
from auth.users u
on conflict (id) do update
  set nickname = coalesce(public.profiles.nickname, excluded.nickname),
      avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);
