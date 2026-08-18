-- 읽음 시각을 **서버 시각**으로 찍는다.
--
-- ⚠️ 예전엔 앱이 `new Date().toISOString()` 을 보냈다. 그건 **기기 시계**다.
--    기기가 서버보다 몇 초라도 느리면, 방금 도착한 메시지(서버 시각)가
--    읽음 시각보다 **나중**이 되어 계속 "안 읽음"으로 남는다.
--    사용자가 "다 읽었는데 안 읽은 것으로 나온다"고 한 것이 이 증상이고,
--    아이폰·삼성 양쪽에서 같이 나타났다(기기 시계 문제라 기종을 안 가린다).
--
-- ⚠️ security definer 로 두고 auth.uid() 를 쓴다 — 남의 읽음 기록을 못 건드린다.

create or replace function public.mark_chat_read(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.trip_chat_reads (trip_id, user_id, last_read_at)
  values (p_trip_id, auth.uid(), now())
  on conflict (trip_id, user_id) do update set last_read_at = now();
end
$$;

create or replace function public.mark_dm_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.dm_reads (thread_id, user_id, last_read_at)
  values (p_thread_id, auth.uid(), now())
  on conflict (thread_id, user_id) do update set last_read_at = now();
end
$$;

grant execute on function public.mark_chat_read(uuid) to authenticated;
grant execute on function public.mark_dm_read(uuid) to authenticated;
