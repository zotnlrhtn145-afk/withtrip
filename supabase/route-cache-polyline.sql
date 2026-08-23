-- 길을 따라가는 선을 캐시에 같이 담는다.
--
-- 왜 필요한가: 지금 지도의 동선은 **직선**이다. 두 점을 자로 이은 것이라
-- 강 위를 가로지르고 건물을 뚫고 지나간다. "내비처럼 실제 가는 길" 이
-- 보여야 그 하루가 진짜로 어땠는지 읽힌다.
--
-- ⚠️ 거리·시간을 물을 때 **선까지 같이 받아 온다.** 따로 물으면 같은 구간을
--    두 번 호출하게 되고, 요금이 두 배가 된다.
--    (Distance Matrix 는 선을 안 준다 → Directions 로 바꾸면 거리·시간·선을
--     한 번에 준다. 요금 단가는 같은 급이다)
--
-- ⚠️ 선은 구글이 주는 **encoded polyline** 문자열 그대로 저장한다. 좌표
--    배열로 풀어서 넣으면 수백 개 점이 되어 캐시가 몇 배로 부푼다. 푸는 건
--    화면 쪽에서 하면 된다(짧은 코드다).

alter table public.route_cache
  add column if not exists polyline text;

comment on column public.route_cache.polyline is
  '구글 encoded polyline. 지도에 길 따라가는 선을 그리는 데 쓴다. 없으면 직선으로 그린다.';

create or replace function public.route_cache_put(
  p_from_lat numeric, p_from_lng numeric,
  p_to_lat numeric, p_to_lng numeric,
  p_mode text, p_distance_m integer, p_duration_s integer, p_no_route boolean,
  p_polyline text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.route_cache
    (from_lat, from_lng, to_lat, to_lng, mode, distance_m, duration_s, no_route, polyline, fetched_at, hits)
  values
    (round(p_from_lat,3), round(p_from_lng,3), round(p_to_lat,3), round(p_to_lng,3),
     p_mode, p_distance_m, p_duration_s, coalesce(p_no_route,false), p_polyline, now(), 0)
  on conflict (from_lat, from_lng, to_lat, to_lng, mode) do update
     set distance_m = excluded.distance_m,
         duration_s = excluded.duration_s,
         no_route   = excluded.no_route,
         /*
           ⚠️ 새로 받은 선이 없으면 **있던 걸 지우지 않는다.** 어쩌다 한 번
              선이 빠진 응답이 오면 캐시에 잘 담겨 있던 길이 날아가고, 그때부터
              그 구간만 직선으로 나온다.
         */
         polyline   = coalesce(excluded.polyline, public.route_cache.polyline),
         fetched_at = now();
$$;

revoke all on function public.route_cache_put(numeric,numeric,numeric,numeric,text,integer,integer,boolean,text)
  from public, anon, authenticated;

/*
  ⚠️ 반환 컬럼이 늘어나므로 **먼저 지운다.** 그냥 `create or replace` 하면
     "cannot change return type of existing function" 으로 막힌다.
*/
drop function if exists public.route_cache_get(numeric, numeric, numeric, numeric, text);

create or replace function public.route_cache_get(
  p_from_lat numeric, p_from_lng numeric,
  p_to_lat numeric, p_to_lng numeric,
  p_mode text
)
returns table (distance_m integer, duration_s integer, no_route boolean, polyline text)
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
  returning c.distance_m, c.duration_s, c.no_route, c.polyline;
end $$;

revoke all on function public.route_cache_get(numeric,numeric,numeric,numeric,text) from public, anon;
grant execute on function public.route_cache_get(numeric,numeric,numeric,numeric,text) to authenticated, service_role;
grant execute on function public.route_cache_put(numeric,numeric,numeric,numeric,text,integer,integer,boolean,text) to service_role;
