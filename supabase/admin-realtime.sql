-- 실시간(Realtime) 사용량을 관리자 화면에서 본다.
--
-- 왜 필요한가: 무료 한도(월 200만 건 · 동시 접속 200명)를 넘기면 그때부터
-- 돈이 나간다. 그런데 넘기기 전에는 아무 신호가 없어서, 청구서를 보고서야
-- 안다. 미리 보이게 해 둔다.
--
-- ⚠️ 여기서 세는 건 **DB 가 직접 쏜 신호**(broadcast)다. 대화방을 열어 둔
--    동안 오가는 `postgres_changes` 는 여기 안 잡힌다 — 그건 Supabase 쪽
--    계기판에서만 보인다. 화면에도 그렇게 적어 둔다.
create or replace function public.admin_realtime_usage()
returns jsonb
language sql
security definer
set search_path = public, realtime
as $$
  select jsonb_build_object(
    'this_month', (
      select count(*) from realtime.messages
       where inserted_at >= date_trunc('month', now())
    ),
    'last_24h', (
      select count(*) from realtime.messages
       where inserted_at >= now() - interval '24 hours'
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
        from (
          select date_trunc('day', inserted_at)::date as d, count(*) as n
            from realtime.messages
           where inserted_at >= now() - interval '14 days'
           group by 1
        ) s
    ),
    'free_limit', 2000000,
    'keys', (select count(*) from public.user_realtime_keys)
  );
$$;

revoke all on function public.admin_realtime_usage() from public, anon, authenticated;
