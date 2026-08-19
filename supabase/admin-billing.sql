-- 실제로 나가는 돈을 계산하기 위한 표.
--
-- 왜 이렇게 만드는가:
--   구글·Supabase·Vercel 중 **지출액을 API 로 알려주는 곳은 사실상 없다.**
--   (Vercel 공개 API 에 billing 경로가 없고, Supabase Management API 도
--    addons 만 준다. 구글은 BigQuery 청구서 내보내기를 켜야만 나온다.)
--
--   그래서 두 갈래로 간다.
--   1) **쓴 만큼 나가는 돈**(구글 Places·Gemini)은 **우리가 직접 센다.**
--      나가는 호출을 전부 기록하고 단가를 곱한다 — 열쇠 없이도 실제와 맞고,
--      무엇보다 **어느 호출이 돈을 먹는지** 보여서 줄일 데를 찾을 수 있다.
--   2) **매달 똑같이 나가는 돈**(Vercel·Supabase 요금제·EAS·개발자 계정)은
--      한 번 적어 두면 **다음 달부터 자동으로 굴러간다**(admin_recurring).
--
--   나중에 BigQuery 청구서 내보내기를 켜면 1)의 추정치를 실제 청구액으로
--   덮어쓴다 — source 를 'api' 로 넣으면 화면이 그쪽을 우선해 보여 준다.

-- ── 유료 API 호출 기록 ─────────────────────────────────────
-- ⚠️ 한 줄에 한 번의 바깥 호출. **캐시로 막은 호출은 여기 안 들어온다** —
--    그게 정확히 "아낀 돈"이라서, 줄었는지 늘었는지가 이 표에 그대로 보인다.
create table if not exists public.api_calls (
  id bigserial primary key,
  at timestamptz not null default now(),
  -- "google_places" | "google_geocode" | "google_photo" | "gemini"
  vendor text not null,
  -- 세부 항목. 단가가 여기에 붙는다 (textsearch · details · photo · 모델이름)
  endpoint text not null,
  -- 부른 곳 (/api/places/search 등) — 어느 기능이 돈을 먹는지 보려고
  caller text,
  -- Gemini 는 토큰 수로 돈을 매긴다
  in_tokens integer,
  out_tokens integer,
  -- 성공 여부. 실패한 호출도 대개 과금된다 — 빼지 않고 표시만 한다
  ok boolean not null default true,
  ms integer
);

create index if not exists api_calls_at_idx on public.api_calls (at desc);
create index if not exists api_calls_vendor_idx on public.api_calls (vendor, endpoint, at desc);

alter table public.api_calls enable row level security;
-- 정책 없음 = 일반 사용자 접근 불가. 서버(service_role)만 쓰고 읽는다.

-- ── 단가표 ─────────────────────────────────────────────────
-- ⚠️ 단가는 **바뀐다.** 코드에 박으면 조용히 틀린 금액을 보여 주게 된다.
--    표로 두고, 언제부터 적용인지(from_date)를 같이 남긴다.
create table if not exists public.api_prices (
  vendor text not null,
  endpoint text not null,
  -- 1000회당 달러 (Gemini 는 100만 토큰당)
  usd_per_1k numeric(12,6) not null default 0,
  usd_per_1m_in numeric(12,6),
  usd_per_1m_out numeric(12,6),
  -- 매달 공짜로 주는 횟수 (구글은 계정마다 무료 구간이 있다)
  free_monthly integer not null default 0,
  from_date date not null default '2024-01-01',
  note text,
  primary key (vendor, endpoint, from_date)
);

alter table public.api_prices enable row level security;

-- 2026년 8월 기준 공개 단가. 바뀌면 새 from_date 로 한 줄 더 넣는다.
insert into public.api_prices (vendor, endpoint, usd_per_1k, free_monthly, note) values
  ('google_places', 'textsearch', 32.00, 0,    'Places Text Search (Essentials)'),
  ('google_places', 'details',    17.00, 0,    'Place Details'),
  ('google_places', 'photo',       7.00, 0,    'Place Photo'),
  ('google_geocode','geocode',     5.00, 0,    'Geocoding'),
  ('gemini',        'default',      0.00, 0,   '토큰 단가는 usd_per_1m_* 로 계산')
on conflict do nothing;

insert into public.api_prices (vendor, endpoint, usd_per_1k, usd_per_1m_in, usd_per_1m_out, note) values
  ('gemini', 'gemini-2.5-flash', 0, 0.30, 2.50, 'Flash'),
  ('gemini', 'gemini-2.5-pro',   0, 1.25, 10.00, 'Pro'),
  ('gemini', 'gemini-2.0-flash', 0, 0.10, 0.40, 'Flash 2.0')
on conflict do nothing;

-- ── 매달 고정으로 나가는 돈 ────────────────────────────────
-- ⚠️ 한 번 적으면 **다음 달부터 저절로 붙는다.** 매달 손으로 넣게 하면
--    한 달 빠뜨리는 순간 합계가 조용히 틀린다.
create table if not exists public.admin_recurring (
  id uuid primary key default gen_random_uuid(),
  vendor text not null,
  label text not null,
  amount numeric(14,2) not null,
  currency text not null default 'USD',
  started_on date not null default date_trunc('month', now())::date,
  -- 해지했으면 그 달을 적는다. 비어 있으면 계속 나가는 중
  ended_on date,
  note text,
  unique (vendor, label, started_on)
);

alter table public.admin_recurring enable row level security;

-- ── 환율 ───────────────────────────────────────────────────
-- ⚠️ 달러로 청구되는 걸 원으로 보려면 환율이 필요하다. 그날 값을 남겨 둔다 —
--    나중에 "그때 얼마였지"를 되짚을 수 있어야 검증이 된다.
create table if not exists public.fx_rates (
  on_date date primary key,
  usd_krw numeric(10,2) not null
);

alter table public.fx_rates enable row level security;

-- ── 한 달치 비용 한 번에 ───────────────────────────────────
create or replace function public.admin_month_costs(p_month date)
returns table (
  vendor text,
  label text,
  amount numeric,
  currency text,
  source text,
  calls bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select date_trunc('month', p_month)::date as m_from,
           (date_trunc('month', p_month) + interval '1 month')::date as m_to
  ),
  -- 호출한 만큼 나가는 돈 — 횟수 × 단가
  metered as (
    select c.vendor,
           c.endpoint as label,
           count(*)::bigint as calls,
           sum(coalesce(c.in_tokens,0))::numeric as in_tok,
           sum(coalesce(c.out_tokens,0))::numeric as out_tok
      from public.api_calls c, bounds b
     where c.at >= b.m_from and c.at < b.m_to
     group by 1, 2
  ),
  priced as (
    select m.vendor,
           m.label,
           -- 단가표에서 그 달에 유효한 가장 최근 값을 쓴다
           coalesce(
             (select p.usd_per_1k from public.api_prices p
               where p.vendor = m.vendor and p.endpoint = m.label
                 and p.from_date <= p_month
               order by p.from_date desc limit 1), 0) as per_1k,
           coalesce(
             (select p.usd_per_1m_in from public.api_prices p
               where p.vendor = m.vendor and p.endpoint = m.label
                 and p.from_date <= p_month
               order by p.from_date desc limit 1), 0) as per_1m_in,
           coalesce(
             (select p.usd_per_1m_out from public.api_prices p
               where p.vendor = m.vendor and p.endpoint = m.label
                 and p.from_date <= p_month
               order by p.from_date desc limit 1), 0) as per_1m_out,
           m.calls, m.in_tok, m.out_tok
      from metered m
  )
  select vendor, label,
         round(calls::numeric / 1000 * per_1k
               + in_tok / 1000000 * per_1m_in
               + out_tok / 1000000 * per_1m_out, 2) as amount,
         'USD'::text, 'metered'::text, calls
    from priced

  union all

  -- 매달 고정으로 나가는 돈
  select r.vendor, r.label, r.amount, r.currency, 'recurring'::text, 0::bigint
    from public.admin_recurring r, bounds b
   where r.started_on < b.m_to
     and (r.ended_on is null or r.ended_on >= b.m_from)

  union all

  -- 손으로 적었거나 청구서에서 가져온 값 (있으면 이게 진짜다)
  select c.vendor, coalesce(c.label, '기타'), c.amount, c.currency, c.source, 0::bigint
    from public.admin_costs c, bounds b
   where c.month = b.m_from

  order by 3 desc
$$;

-- 일별 API 비용 — 어느 날 갑자기 튀었는지 보려고
create or replace function public.admin_daily_api_cost(p_from date, p_to date)
returns table (day date, vendor text, calls bigint, usd numeric)
language sql
stable
security definer
set search_path = public
as $$
  select (c.at at time zone 'Asia/Seoul')::date as day,
         c.vendor,
         count(*)::bigint,
         round(sum(
           coalesce((select p.usd_per_1k from public.api_prices p
                      where p.vendor = c.vendor and p.endpoint = c.endpoint
                        and p.from_date <= (c.at at time zone 'Asia/Seoul')::date
                      order by p.from_date desc limit 1), 0) / 1000
           + coalesce(c.in_tokens,0)::numeric / 1000000 *
             coalesce((select p.usd_per_1m_in from public.api_prices p
                        where p.vendor = c.vendor and p.endpoint = c.endpoint
                          and p.from_date <= (c.at at time zone 'Asia/Seoul')::date
                        order by p.from_date desc limit 1), 0)
           + coalesce(c.out_tokens,0)::numeric / 1000000 *
             coalesce((select p.usd_per_1m_out from public.api_prices p
                        where p.vendor = c.vendor and p.endpoint = c.endpoint
                          and p.from_date <= (c.at at time zone 'Asia/Seoul')::date
                        order by p.from_date desc limit 1), 0)
         ), 4) as usd
    from public.api_calls c
   where c.at >= p_from and c.at < (p_to + 1)
   group by 1, 2
   order by 1, 2
$$;

-- 어느 기능이 돈을 먹는지 (줄일 데 찾기)
create or replace function public.admin_cost_by_caller(p_from date, p_to date)
returns table (caller text, calls bigint, usd numeric)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(c.caller, '(알 수 없음)'),
         count(*)::bigint,
         round(sum(
           coalesce((select p.usd_per_1k from public.api_prices p
                      where p.vendor = c.vendor and p.endpoint = c.endpoint
                        and p.from_date <= (c.at at time zone 'Asia/Seoul')::date
                      order by p.from_date desc limit 1), 0) / 1000
           + coalesce(c.in_tokens,0)::numeric / 1000000 *
             coalesce((select p.usd_per_1m_in from public.api_prices p
                        where p.vendor = c.vendor and p.endpoint = c.endpoint
                          and p.from_date <= (c.at at time zone 'Asia/Seoul')::date
                        order by p.from_date desc limit 1), 0)
           + coalesce(c.out_tokens,0)::numeric / 1000000 *
             coalesce((select p.usd_per_1m_out from public.api_prices p
                        where p.vendor = c.vendor and p.endpoint = c.endpoint
                          and p.from_date <= (c.at at time zone 'Asia/Seoul')::date
                        order by p.from_date desc limit 1), 0)
         ), 4) as usd
    from public.api_calls c
   where c.at >= p_from and c.at < (p_to + 1)
   group by 1
   order by 3 desc nulls last
$$;

revoke execute on function public.admin_month_costs(date) from anon, authenticated;
revoke execute on function public.admin_daily_api_cost(date,date) from anon, authenticated;
revoke execute on function public.admin_cost_by_caller(date,date) from anon, authenticated;
