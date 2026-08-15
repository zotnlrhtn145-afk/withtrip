-- AI 엔드포인트 호출량 제한용 카운터.
--
-- 배경: /api/parse-receipt, /api/generate-trip-cover 같은 AI 라우트가
-- 인증 없이 열려 있다. URL 만 알면 누구나 반복해서 부를 수 있고,
-- 이미지 생성은 호출당 단가가 높다.
--
-- 인증을 붙이면 이미 배포된 앱(스토어 1.0 + TestFlight)이 전부 죽는다.
-- 어느 클라이언트도 인증 헤더를 보내지 않기 때문이다.
-- 그래서 클라이언트를 안 건드리는 **호출량 제한**으로 먼저 막는다.
--
-- 람다는 인스턴스마다 메모리가 따로라 in-memory 카운터로는 못 막는다.
-- DB 에 두어야 여러 인스턴스가 같은 숫자를 본다.

create table if not exists public.api_usage_counters (
  bucket text primary key,
  count integer not null default 0,
  expires_at timestamptz not null
);

create index if not exists api_usage_counters_expires_idx
  on public.api_usage_counters (expires_at);

-- 아무도 직접 읽고 쓸 일이 없다. 서버(service_role)만 쓴다.
alter table public.api_usage_counters enable row level security;

/**
 * 카운터를 1 올리고 올린 뒤 값을 돌려준다.
 *
 * 창(window)이 지났으면 1 로 되돌린다. upsert 한 번으로 처리해서
 * 동시에 들어와도 숫자가 어긋나지 않는다.
 */
create or replace function public.bump_api_counter(p_bucket text, p_ttl_seconds integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.api_usage_counters as c (bucket, count, expires_at)
  values (p_bucket, 1, now() + make_interval(secs => p_ttl_seconds))
  on conflict (bucket) do update
    set count = case when c.expires_at < now() then 1 else c.count + 1 end,
        expires_at = case when c.expires_at < now()
                          then now() + make_interval(secs => p_ttl_seconds)
                          else c.expires_at end
  returning c.count into v_count;
  return v_count;
end $$;

-- 만료된 행 청소 (크론이 없어도 테이블이 무한정 커지진 않게 가끔 부른다)
create or replace function public.sweep_api_counters()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.api_usage_counters where expires_at < now() - interval '1 day';
$$;
