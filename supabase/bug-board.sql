-- 버그 신고 게시판.
--
-- 왜 만드는가:
--   지금은 카톡 단톡방으로 받는다. 시간순으로 흘러가서 **무엇이 남았는지**를
--   알 수 없고, 사진이 안 올라가는 일도 잦고, 기기·버전이 안 적혀 있어서
--   같은 걸 다시 물어봐야 한다.
--
-- 핵심은 자동화다: 관리자가 고칠 것을 골라 두면 대기열에 쌓이고,
-- 정해진 주기로 그 대기열을 읽어 하나씩 고치고 처리 내용을 되쓴다.

-- ── 누가 관리자인가 ────────────────────────────────────────
-- ⚠️ 이메일을 코드에 박지 않는다. 사람이 바뀔 때마다 배포해야 하고,
--    급할 때 못 바꾼다. 표에 두면 SQL 한 줄로 넣고 뺀다.
create table if not exists public.bug_admins (
  email text primary key,
  note text,
  added_at timestamptz not null default now()
);

alter table public.bug_admins enable row level security;
-- 읽기는 로그인한 사람 모두에게 연다 — 화면이 "내가 관리자인가"를 물어봐야 한다.
-- (여기엔 이메일만 있고, 진짜 통제는 아래 정책들이 한다)
drop policy if exists bug_admins_read on public.bug_admins;
create policy bug_admins_read on public.bug_admins
  for select to authenticated using (true);

insert into public.bug_admins (email, note) values
  ('ohbong1213@nate.com', '오수환')
on conflict (email) do nothing;

/**
 * 지금 로그인한 사람이 관리자인가.
 *
 * ⚠️ 정책 안에서 부를 것이므로 stable + security definer 로 둔다.
 */
create or replace function public.is_bug_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bug_admins a
     where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

grant execute on function public.is_bug_admin() to authenticated;

-- ── 신고 ───────────────────────────────────────────────────
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  -- 'low' | 'mid' | 'high'
  severity text not null default 'mid' check (severity in ('low','mid','high')),
  -- 'ios' | 'android' | 'web' | 'both'
  platform text not null default 'android' check (platform in ('ios','android','web','both')),
  -- ⚠️ 신고자가 손으로 안 적어도 되게 앱이 넣어 준다. "갤럭시요" 만 적혀 오던 걸 막는다
  device text,
  os_version text,
  app_version text,
  /*
    new       — 갓 들어옴
    seen      — 관리자가 확인함
    queued    — 고쳐 달라고 요청됨 (대기열에 있음)
    fixing    — 지금 고치는 중
    resolved  — 고쳐짐
    wontfix   — 안 고치기로 함
  */
  status text not null default 'new'
    check (status in ('new','seen','queued','fixing','resolved','wontfix')),
  -- 어떻게 고쳤나 (자동으로 채워진다)
  resolution text,
  -- 어떻게 확인했나
  verification text,
  -- 손댄 파일·커밋 같은 부스러기
  resolution_meta jsonb,
  resolved_at timestamptz,
  /** 고친 게 아직 배포 전인지 — 사용자는 "고쳤다는데 왜 그대로지?" 를 가장 답답해한다 */
  shipped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bug_reports_status_idx on public.bug_reports (status, created_at desc);
create index if not exists bug_reports_reporter_idx on public.bug_reports (reporter_id, created_at desc);

alter table public.bug_reports enable row level security;

-- 로그인한 사람은 다 본다. 남이 이미 신고한 걸 또 쓰지 않게 하려면 보여야 한다.
drop policy if exists bug_reports_read on public.bug_reports;
create policy bug_reports_read on public.bug_reports
  for select to authenticated using (true);

-- 자기 이름으로만 쓴다
drop policy if exists bug_reports_insert on public.bug_reports;
create policy bug_reports_insert on public.bug_reports
  for insert to authenticated with check (reporter_id = auth.uid());

/*
  ⚠️ 고치는 쪽 값(status·resolution)은 **관리자만** 바꾼다.
     신고자가 자기 글을 고칠 수 있게 열어 두면 상태까지 같이 바뀌어서,
     대기열이 조용히 뒤엉킨다. 신고자에게는 제목·내용만 연다.
*/
drop policy if exists bug_reports_update_admin on public.bug_reports;
create policy bug_reports_update_admin on public.bug_reports
  for update to authenticated using (public.is_bug_admin()) with check (public.is_bug_admin());

drop policy if exists bug_reports_delete_admin on public.bug_reports;
create policy bug_reports_delete_admin on public.bug_reports
  for delete to authenticated using (public.is_bug_admin());

-- ── 덧붙인 메모 ────────────────────────────────────────────
-- 신고 글이 부실할 때 관리자가 보태는 설명. 여러 번 쌓이고 신고글을 따라다닌다.
create table if not exists public.bug_notes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.bug_reports(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists bug_notes_report_idx on public.bug_notes (report_id, created_at);

alter table public.bug_notes enable row level security;

drop policy if exists bug_notes_read on public.bug_notes;
create policy bug_notes_read on public.bug_notes
  for select to authenticated using (true);

-- 메모는 관리자만 단다 (신고자는 원래 글에 쓰면 된다)
drop policy if exists bug_notes_insert on public.bug_notes;
create policy bug_notes_insert on public.bug_notes
  for insert to authenticated with check (public.is_bug_admin() and author_id = auth.uid());

drop policy if exists bug_notes_delete on public.bug_notes;
create policy bug_notes_delete on public.bug_notes
  for delete to authenticated using (public.is_bug_admin());

-- ── 첨부 (사진·영상) ───────────────────────────────────────
-- ⚠️ 파일 자체는 Storage 에 두고 여기엔 경로만 남긴다.
--    해결되면 원본은 지우고 작은 미리보기만 남길 수 있게 purged_at 을 둔다.
create table if not exists public.bug_media (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.bug_reports(id) on delete cascade,
  -- 'image' | 'video'
  kind text not null check (kind in ('image','video')),
  path text not null,
  thumb_path text,
  bytes bigint,
  created_at timestamptz not null default now(),
  -- 원본을 지운 시각. 비어 있으면 아직 원본이 있다
  purged_at timestamptz
);

create index if not exists bug_media_report_idx on public.bug_media (report_id, created_at);

alter table public.bug_media enable row level security;

drop policy if exists bug_media_read on public.bug_media;
create policy bug_media_read on public.bug_media
  for select to authenticated using (true);

drop policy if exists bug_media_insert on public.bug_media;
create policy bug_media_insert on public.bug_media
  for insert to authenticated with check (
    exists (select 1 from public.bug_reports r
             where r.id = report_id and r.reporter_id = auth.uid())
    or public.is_bug_admin()
  );

drop policy if exists bug_media_delete on public.bug_media;
create policy bug_media_delete on public.bug_media
  for delete to authenticated using (public.is_bug_admin());

-- ── 대기열 ─────────────────────────────────────────────────
-- 관리자가 "이거 고쳐 달라" 고 보낸 것들. 자동 처리기가 여기를 읽는다.
create table if not exists public.bug_queue (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.bug_reports(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  -- 'waiting' | 'running' | 'done' | 'failed'
  state text not null default 'waiting' check (state in ('waiting','running','done','failed')),
  -- 실패했으면 왜
  error text,
  -- ⚠️ 같은 신고를 두 번 줄 세우지 않는다. 두 번 고치려다 커밋이 엉킨다
  unique (report_id)
);

create index if not exists bug_queue_state_idx on public.bug_queue (state, requested_at);

alter table public.bug_queue enable row level security;

drop policy if exists bug_queue_read on public.bug_queue;
create policy bug_queue_read on public.bug_queue
  for select to authenticated using (true);

-- 대기열에 넣는 건 관리자만
drop policy if exists bug_queue_insert on public.bug_queue;
create policy bug_queue_insert on public.bug_queue
  for insert to authenticated with check (public.is_bug_admin());

drop policy if exists bug_queue_update on public.bug_queue;
create policy bug_queue_update on public.bug_queue
  for update to authenticated using (public.is_bug_admin()) with check (public.is_bug_admin());

drop policy if exists bug_queue_delete on public.bug_queue;
create policy bug_queue_delete on public.bug_queue
  for delete to authenticated using (public.is_bug_admin());

-- ── 목록 한 번에 읽기 ──────────────────────────────────────
/**
 * 목록 화면이 쓰는 값.
 *
 * ⚠️ 신고마다 글쓴이·메모수·첨부수를 따로 물어보면 줄 수만큼 왕복이 생긴다.
 *    한 번에 묶어서 준다.
 */
create or replace function public.bug_list(p_status text default null, p_limit int default 50)
returns table (
  id uuid,
  title text,
  body text,
  severity text,
  platform text,
  device text,
  app_version text,
  status text,
  reporter_name text,
  is_mine boolean,
  note_count bigint,
  media_count bigint,
  has_video boolean,
  resolution text,
  shipped boolean,
  created_at timestamptz,
  resolved_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.title, r.body, r.severity, r.platform, r.device, r.app_version, r.status,
         coalesce(p.nickname, split_part(coalesce(p.email,''), '@', 1), '알 수 없음') as reporter_name,
         r.reporter_id = auth.uid() as is_mine,
         (select count(*) from public.bug_notes n where n.report_id = r.id) as note_count,
         (select count(*) from public.bug_media m where m.report_id = r.id) as media_count,
         exists (select 1 from public.bug_media m where m.report_id = r.id and m.kind = 'video') as has_video,
         r.resolution, r.shipped, r.created_at, r.resolved_at
    from public.bug_reports r
    left join public.profiles p on p.id = r.reporter_id
   where p_status is null
      or (p_status = 'open' and r.status in ('new','seen','queued','fixing'))
      or r.status = p_status
   order by
     -- 안 끝난 것 먼저, 그중에서도 심각한 것 먼저, 그다음 최신순
     case when r.status in ('resolved','wontfix') then 1 else 0 end,
     case r.severity when 'high' then 0 when 'mid' then 1 else 2 end,
     r.created_at desc
   limit p_limit
$$;

grant execute on function public.bug_list(text,int) to authenticated;
