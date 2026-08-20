-- 실시간으로 흘려보내는 양을 줄인다. 기능은 그대로다.
--
-- (1) 아무도 안 듣는 표는 실시간 대상에서 뺀다
--     `notifications` · `friendships` 는 안 읽은 개수 때문에 듣고 있었는데,
--     이제 그건 사람마다 자기 앞으로 오는 신호로 바뀌었다
--     (supabase/unread-broadcast.sql). 표를 그대로 두면 바뀔 때마다 실시간
--     서버까지 갔다가 아무한테도 안 가고 버려진다 — 세는 건 그대로 센다.
--
-- (2) 남은 구독에 **전부 필터가 걸리게** 한다
--     반응·투표는 `trip_id` 가 없어서 필터를 못 걸고 있었다. 그래서 대화방을
--     열어 둔 사람은 **앱 전체의 모든 반응**을 받아서 버리고 있었다.
--     `trip_id` 를 같이 적어 두고 그걸로 거른다.

-- ── (1) 안 듣는 표 빼기 ────────────────────────────────────
alter publication supabase_realtime drop table public.notifications;
alter publication supabase_realtime drop table public.friendships;

-- ── (2) 반응·투표에 trip_id 붙이기 ─────────────────────────
alter table public.trip_message_reactions add column if not exists trip_id uuid;
alter table public.trip_vote_selections   add column if not exists trip_id uuid;

update public.trip_message_reactions r
   set trip_id = m.trip_id
  from public.trip_messages m
 where m.id = r.message_id and r.trip_id is distinct from m.trip_id;

update public.trip_vote_selections s
   set trip_id = v.trip_id
  from public.trip_votes v
 where v.id = s.vote_id and s.trip_id is distinct from v.trip_id;

-- 앞으로 들어오는 것은 자동으로 채운다 — 앱이 따로 보내 줄 필요가 없다
create or replace function public.tg_fill_reaction_trip()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.trip_id is null then
    select m.trip_id into new.trip_id from public.trip_messages m where m.id = new.message_id;
  end if;
  return new;
end $$;

drop trigger if exists tg_fill_reaction_trip on public.trip_message_reactions;
create trigger tg_fill_reaction_trip
  before insert or update on public.trip_message_reactions
  for each row execute function public.tg_fill_reaction_trip();

create or replace function public.tg_fill_vote_trip()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.trip_id is null then
    select v.trip_id into new.trip_id from public.trip_votes v where v.id = new.vote_id;
  end if;
  return new;
end $$;

drop trigger if exists tg_fill_vote_trip on public.trip_vote_selections;
create trigger tg_fill_vote_trip
  before insert or update on public.trip_vote_selections
  for each row execute function public.tg_fill_vote_trip();

-- ⚠️ 지우기(DELETE) 는 실시간에 **키만** 실려 온다. 반응을 뗄 때도 화면이
--    움직여야 하므로, 지운 행의 trip_id 까지 실리게 복제 신원을 넓힌다.
--    (안 그러면 필터가 trip_id 를 못 봐서 지우기 신호가 통째로 사라진다)
alter table public.trip_message_reactions replica identity full;
alter table public.trip_vote_selections   replica identity full;
