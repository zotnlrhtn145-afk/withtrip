-- WITHTRIP: 신고(reports) + 차단(blocks) — App Store 가이드라인 1.2(사용자 생성 콘텐츠) 대응
-- Supabase Dashboard → SQL Editor 또는 scripts/supabase-deploy.sh 로 실행 (전부 idempotent)

-- ── 차단 (blocks) ────────────────────────────────────────────
-- blocker_id 가 blocked_id 를 차단. 양방향으로 서로의 콘텐츠를 숨긴다.
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_no_self check (blocker_id <> blocked_id),
  unique (blocker_id, blocked_id)
);

comment on table public.blocks is '사용자 차단 (blocker_id 가 blocked_id 를 차단)';

create index if not exists blocks_blocker_idx on public.blocks (blocker_id);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

drop policy if exists "blocks_select_own" on public.blocks;
drop policy if exists "blocks_insert_own" on public.blocks;
drop policy if exists "blocks_delete_own" on public.blocks;

-- 내가 차단한 목록 + 나를 차단한 목록(양방향 숨김을 위해) 둘 다 조회 가능
create policy "blocks_select_own"
  on public.blocks for select to authenticated
  using (blocker_id = auth.uid() or blocked_id = auth.uid());

create policy "blocks_insert_own"
  on public.blocks for insert to authenticated
  with check (blocker_id = auth.uid());

create policy "blocks_delete_own"
  on public.blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- ── 신고 (reports) ───────────────────────────────────────────
-- 사용자/콘텐츠 신고. 운영자가 service_role(콘솔)로 검토하고 status 로 처리한다.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid references public.profiles (id) on delete set null,
  content_type text not null default 'user'
    check (content_type in ('user', 'profile', 'dm_message', 'trip_message', 'saved_place', 'spot')),
  content_id text, -- 신고 대상 콘텐츠 id (메시지/장소 등). 사용자 신고면 null 가능
  reason text not null default 'other'
    check (reason in ('spam', 'harassment', 'inappropriate', 'hate', 'violence', 'illegal', 'other')),
  detail text, -- 신고자 상세 설명
  content_excerpt text, -- 신고 시점의 콘텐츠 스냅샷 (검토용)
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

comment on table public.reports is '사용자/콘텐츠 신고 (1.2 대응). 운영자가 status 로 처리.';

create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists reports_target_idx on public.reports (target_user_id);
create index if not exists reports_status_idx on public.reports (status);

alter table public.reports enable row level security;

drop policy if exists "reports_select_own" on public.reports;
drop policy if exists "reports_insert_own" on public.reports;

-- 신고자는 자기 신고만 조회 (운영자는 service_role 로 전체 조회)
create policy "reports_select_own"
  on public.reports for select to authenticated
  using (reporter_id = auth.uid());

create policy "reports_insert_own"
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- ── helper: 나와 서로 차단된(내가 차단했거나 나를 차단한) 사용자 id 목록 ──
-- 목록/검색/채팅에서 양방향으로 숨기기 위해 사용.
create or replace function public.blocked_user_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select blocked_id from public.blocks where blocker_id = auth.uid()
  union
  select blocker_id from public.blocks where blocked_id = auth.uid()
$$;
