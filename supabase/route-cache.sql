-- 두 지점 사이 실제 이동 시간을 **한 번만** 물어보고 계속 재사용한다.
--
-- 왜 필요한가: 직선거리 추정으로는 도쿄에서 "9.1km 도보 2시간 38분" 이 나오는데
-- 실제로는 지하철로 25분이다. 실제 시간을 물어야 쓸모가 있는데, 그건 돈이 든다.
--
-- ⚠️ **이 표가 비용의 거의 전부를 없앤다.**
--    좌표를 100m 단위로 반올림해 열쇠로 쓰기 때문에, "시부야 → 신주쿠" 는
--    **누가 어떤 여행에서 짜든 같은 줄**을 본다. 사용자가 늘수록 적중률이
--    올라가고, 새로 물어보는 일은 줄어든다.
--
-- ⚠️ 실패도 저장한다. 일본은 구글이 **대중교통 경로를 아예 주지 않는다**
--    (확인함 — 도쿄·오사카 모두 ZERO_RESULTS, 한국·베트남은 정상).
--    실패를 안 남기면 같은 구간을 볼 때마다 계속 물어보게 되고, 그게 다 요금이다.

create table if not exists public.route_cache (
  -- 반올림한 좌표 + 이동수단이 곧 열쇠다
  from_lat numeric(7,3) not null,
  from_lng numeric(7,3) not null,
  to_lat   numeric(7,3) not null,
  to_lng   numeric(7,3) not null,
  mode     text not null check (mode in ('walk','drive','transit')),

  /** 실제 이동 거리(m). 못 구했으면 null */
  distance_m integer,
  /** 실제 소요 시간(초). 못 구했으면 null */
  duration_s integer,
  /**
   * 구글이 경로를 못 준 경우 true.
   * ⚠️ null 과 구분해야 한다 — "아직 안 물어봤다" 와 "물어봤는데 없다" 는 다르다.
   */
  no_route boolean not null default false,

  fetched_at timestamptz not null default now(),
  hits integer not null default 0,

  primary key (from_lat, from_lng, to_lat, to_lng, mode)
);

comment on table public.route_cache is
  '두 지점 사이 실제 이동 시간 캐시. 좌표는 100m 단위로 반올림해 여러 여행이 같은 줄을 공유한다.';

-- 누구나 읽을 수 있다(개인 정보가 아니다 — 지점 사이 거리일 뿐).
-- 쓰기는 서버(service_role)만 한다. 앱에서 직접 넣으면 아무 값이나 들어올 수 있다.
alter table public.route_cache enable row level security;

drop policy if exists route_cache_read on public.route_cache;
create policy route_cache_read on public.route_cache
  for select to authenticated using (true);

/**
 * 캐시에서 찾기. 있으면 쓴 횟수를 올린다.
 *
 * ⚠️ 도보·차는 길이 잘 안 바뀌니 오래 두고 쓴다. 대중교통은 노선이 바뀔 수
 *    있어 90일이 지나면 없는 셈 친다(다시 물어본다).
 */
create or replace function public.route_cache_get(
  p_from_lat numeric, p_from_lng numeric,
  p_to_lat numeric, p_to_lng numeric,
  p_mode text
)
returns table (distance_m integer, duration_s integer, no_route boolean)
language plpgsql
security definer
set search_path = public
as $$
declare stale interval := case when p_mode = 'transit' then interval '90 days' else interval '2 years' end;
begin
  return query
  update public.route_cache c
     set hits = c.hits + 1
   where c.from_lat = round(p_from_lat, 3)
     and c.from_lng = round(p_from_lng, 3)
     and c.to_lat   = round(p_to_lat, 3)
     and c.to_lng   = round(p_to_lng, 3)
     and c.mode     = p_mode
     and c.fetched_at > now() - stale
  returning c.distance_m, c.duration_s, c.no_route;
end $$;

/** 새로 물어본 결과를 넣는다(서버만 부른다) */
create or replace function public.route_cache_put(
  p_from_lat numeric, p_from_lng numeric,
  p_to_lat numeric, p_to_lng numeric,
  p_mode text, p_distance_m integer, p_duration_s integer, p_no_route boolean
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.route_cache
    (from_lat, from_lng, to_lat, to_lng, mode, distance_m, duration_s, no_route, fetched_at, hits)
  values
    (round(p_from_lat,3), round(p_from_lng,3), round(p_to_lat,3), round(p_to_lng,3),
     p_mode, p_distance_m, p_duration_s, coalesce(p_no_route,false), now(), 0)
  on conflict (from_lat, from_lng, to_lat, to_lng, mode) do update
     set distance_m = excluded.distance_m,
         duration_s = excluded.duration_s,
         no_route   = excluded.no_route,
         fetched_at = now();
$$;

revoke all on function public.route_cache_put(numeric,numeric,numeric,numeric,text,integer,integer,boolean) from public, anon, authenticated;
