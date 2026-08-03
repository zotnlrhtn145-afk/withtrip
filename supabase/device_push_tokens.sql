-- WITHTRIP: 기기 푸시 토큰 (Expo Push) — 새 메시지/초대 등 푸시 발송 대상
-- 앱이 시작될 때 각 기기의 Expo 푸시 토큰을 여기에 upsert 한다.
-- Supabase Dashboard → SQL Editor에서 실행하세요.

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,                       -- ExponentPushToken[...]
  platform text check (platform in ('ios', 'android')),
  device_name text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists device_push_tokens_user_id_idx
  on public.device_push_tokens (user_id);

alter table public.device_push_tokens enable row level security;

-- 본인 토큰만 등록/조회/삭제 (발송은 service-role Edge Function이 처리)
drop policy if exists "device_push_tokens_rw_own" on public.device_push_tokens;
create policy "device_push_tokens_rw_own"
  on public.device_push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';
