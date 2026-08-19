-- 검색어 → 장소 목록 캐시.
--
-- 왜 필요한가:
--   Places 요금에서 **Text Search 가 제일 비싸다**(1000회당 $32. Details 는 $17,
--   사진은 $7). 그런데 Details 는 이미 `places` 표에 캐시되고 있었고,
--   **Text Search 만 캐시 없이 매번 그대로 나가고 있었다.**
--   사람들이 찾는 곳은 크게 겹친다("강남 라멘", "제주 흑돼지"…). 한 번 받아 두면
--   두 번째부터는 공짜다.
--
-- ⚠️ 캐시하는 건 **place_id 목록뿐**이다. 이름·평점 같은 내용은 여기 두지 않는다.
--    구글 약관상 place_id 는 오래 보관해도 되지만 나머지 내용은 30일 제한이 있고,
--    그 내용은 어차피 `places` 표가 자기 수명을 따로 관리한다.

create table if not exists public.place_search_cache (
  -- 정규화한 검색어 + 종류. 띄어쓰기·대소문자가 달라도 같은 칸에 들어가게 만든다
  q_key text primary key,
  -- 구글이 준 순서 그대로 (순서 자체가 관련도다)
  place_ids text[] not null,
  at timestamptz not null default now(),
  -- 이 줄이 구글 호출을 몇 번 막았는지. 아낀 돈을 관리자 화면에서 보여 준다
  hits integer not null default 0,
  last_hit_at timestamptz
);

create index if not exists place_search_cache_at_idx on public.place_search_cache (at desc);

alter table public.place_search_cache enable row level security;
-- 정책 없음 = 서버(service_role)만 쓴다. 검색어는 사용자가 무엇을 찾았는지라
-- 남에게 보일 이유가 없다.

-- 캐시가 몇 번이나 구글 호출을 막았는지 (관리자 화면의 "아낀 돈")
create or replace function public.admin_search_cache_savings(p_from date, p_to date)
returns table (hits bigint, entries bigint)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(hits), 0)::bigint, count(*)::bigint
    from public.place_search_cache
   where coalesce(last_hit_at, at) >= p_from
     and coalesce(last_hit_at, at) < (p_to + 1)
$$;

revoke execute on function public.admin_search_cache_savings(date,date) from anon, authenticated;

-- 캐시 적중을 한 번에 세는 함수 (읽고-더하고-쓰기를 하면 동시에 들어올 때 어긋난다)
create or replace function public.bump_search_cache_hit(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.place_search_cache
     set hits = hits + 1, last_hit_at = now()
   where q_key = p_key
$$;

revoke execute on function public.bump_search_cache_hit(text) from anon, authenticated;
