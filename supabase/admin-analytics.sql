-- 관리자 페이지가 쓰는 표들 — 방문 집계 · 비용 · 콘텐츠 가리기.
--
-- ⚠️ 여기 있는 표는 **관리자만** 본다. RLS 로 일반 사용자를 전부 막고,
--    관리자 페이지는 service_role 로만 읽는다(서버에서만 부른다).
--    page_views 만 예외로 **쓰기는 누구나** 가능하다 — 방문 기록을 남겨야 하니까.
--    단 읽기는 막는다. 남의 이동 경로가 보이면 안 된다.

-- ── 방문 기록 ──────────────────────────────────────────────
-- ⚠️ 한 줄에 한 방문. 나중에 일별로 굴려 담을 수 있게 원본을 남긴다.
-- ⚠️ **개인 식별은 최소로.** ip 는 통째로 저장하지 않고 **해시 앞부분만** 남긴다
--    (같은 사람인지 세는 데는 충분하고, 되돌려 알아낼 수는 없다).
create table if not exists public.page_views (
  id bigserial primary key,
  at timestamptz not null default now(),
  -- "web" | "app"
  source text not null,
  -- 화면 이름. 웹은 경로(/saved), 앱은 라우트(saved) — 앞의 슬래시를 떼고 맞춘다
  path text not null,
  -- 묶어 보기 위한 큰 분류: 저장 · 대화 · 여행 · 홈 · 정산 · 클립 · 기타
  category text,
  user_id uuid,
  -- 방문자 구분용 짧은 해시 (ip+UA 를 하루 소금과 함께 해시한 앞 16자)
  visitor text,
  referrer text
);

create index if not exists page_views_at_idx on public.page_views (at desc);
create index if not exists page_views_cat_idx on public.page_views (category, at desc);

alter table public.page_views enable row level security;

-- 쓰기만 열어 둔다. 읽기는 아무에게도 안 준다(관리자는 service_role 로 읽는다).
drop policy if exists page_views_insert_any on public.page_views;
create policy page_views_insert_any on public.page_views
  for insert to anon, authenticated with check (true);

-- ── 비용 ───────────────────────────────────────────────────
-- 매달 나가는 돈. 자동으로 가져오는 것과 손으로 적는 것을 한 표에 둔다.
-- ⚠️ **통화를 섞지 않는다.** 서비스는 달러로 청구되고 우리는 원으로 본다 —
--    받은 그대로(amount, currency)와 그날 환율을 같이 남겨야 나중에 검증된다.
create table if not exists public.admin_costs (
  id uuid primary key default gen_random_uuid(),
  -- 어느 달 (그 달 1일로 맞춰 넣는다)
  month date not null,
  -- "google" | "supabase" | "vercel" | "eas" | "gemini" | "기타"
  vendor text not null,
  label text,
  amount numeric(14,2) not null default 0,
  currency text not null default 'USD',
  krw numeric(14,0),
  -- "api"(자동 수집) | "manual"(손으로 입력)
  source text not null default 'manual',
  note text,
  updated_at timestamptz not null default now(),
  unique (month, vendor, label)
);

alter table public.admin_costs enable row level security;
-- 일반 사용자는 아예 접근 불가 (정책을 하나도 안 만든다 = 전부 거부)

-- ── 콘텐츠 가리기 ──────────────────────────────────────────
-- ⚠️ **지우지 않고 가린다.** 잘못 가린 것을 되돌릴 수 있어야 하고,
--    무엇을 왜 가렸는지 남아야 나중에 기준을 다듬을 수 있다.
create table if not exists public.content_hides (
  id uuid primary key default gen_random_uuid(),
  -- "clip" | "review" | "message" | "place"
  kind text not null,
  target_id uuid not null,
  reason text,
  hidden_by text,
  hidden_at timestamptz not null default now(),
  unique (kind, target_id)
);

alter table public.content_hides enable row level security;
-- 읽기만 열어 둔다 — 앱·웹이 "가려진 글은 그리지 않기" 위해 봐야 한다
drop policy if exists content_hides_read on public.content_hides;
create policy content_hides_read on public.content_hides
  for select to anon, authenticated using (true);

-- ── 관리자 화면이 쓰는 집계 ────────────────────────────────
-- ⚠️ 화면에서 매번 큰 표를 훑지 않게 여기서 한 번에 묶는다.

create or replace function public.admin_daily_visits(p_from date, p_to date)
returns table (day date, views bigint, visitors bigint, users bigint)
language sql
stable
security definer
set search_path = public
as $$
  select (at at time zone 'Asia/Seoul')::date as day,
         count(*)::bigint,
         count(distinct visitor)::bigint,
         count(distinct user_id)::bigint
    from public.page_views
   where at >= p_from and at < (p_to + 1)
   group by 1 order by 1
$$;

create or replace function public.admin_category_visits(p_from date, p_to date)
returns table (category text, views bigint, visitors bigint)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(category,'기타'), count(*)::bigint, count(distinct visitor)::bigint
    from public.page_views
   where at >= p_from and at < (p_to + 1)
   group by 1 order by 2 desc
$$;

-- 관리자 대시보드 위쪽 숫자들
create or replace function public.admin_overview()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_new_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'trips', (select count(*) from public.trips),
    'places', (select count(*) from public.saved_places),
    'messages', (select count(*) from public.trip_messages),
    'clips', (select count(*) from public.trip_clips),
    'reviews', (select count(*) from public.place_reviews),
    'reports_open', (select count(*) from public.reports where coalesce(status,'open') = 'open'),
    'hidden', (select count(*) from public.content_hides),
    'views_yesterday', (
      select count(*) from public.page_views
       where (at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date - 1),
    'visitors_yesterday', (
      select count(distinct visitor) from public.page_views
       where (at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date - 1)
  )
$$;

revoke execute on function public.admin_daily_visits(date,date) from anon, authenticated;
revoke execute on function public.admin_category_visits(date,date) from anon, authenticated;
revoke execute on function public.admin_overview() from anon, authenticated;
