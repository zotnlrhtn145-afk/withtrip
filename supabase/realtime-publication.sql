-- 실시간으로 방송해야 하는 표들.
--
-- ⚠️ 여기 없으면 그 표의 변화는 **아무에게도 안 간다.** 앱에서는 구독을 걸어
--    두었기 때문에 오류도 없이 그냥 조용하다 — 그래서 알아채기가 아주 어렵다.
--
-- 실제로 겪은 일:
--   dm_reads 가 빠져 있어서 1:1 대화에서 상대가 읽어도 "1" 이 안 사라졌다.
--   notifications 가 빠져 있어서 알림 배지가 저절로 안 줄었다.
--   friendships 가 빠져 있어서 친구 요청 숫자가 늦게 반영됐다.

alter publication supabase_realtime add table public.dm_reads;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.friendships;

-- 확인용
-- select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename;
