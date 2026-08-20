-- 안 읽은 개수 알림을 **사람마다 자기 앞으로만** 보낸다.
--
-- 왜 바꾸는가:
--   지금까지는 앱이 6개 표를 **필터 없이** 통째로 구독했다. 그러면 그 표에
--   무엇이 바뀌든 **접속 중인 모든 사람에게** 전달 여부를 따진다.
--   사람이 늘면 `변경 건수 × 접속자 수` 로 곱해져서 늘어난다.
--
--   이제는 DB 가 "이 사람 숫자가 바뀔 수 있다"를 알고, **그 사람 앞으로만** 쏜다.
--   각자는 자기 것 하나만 듣는다. 곱셈이 사라지고 비례만 남는다.
--
-- ⚠️ 기능은 하나도 안 바뀐다. 앱은 신호를 받으면 예전처럼 다시 세기만 한다.
--    신호에 개수를 담지 않는 이유: 개수를 계산하는 규칙(차단·나간 방·읽음 시각)이
--    한 곳(앱)에만 있어야 두 곳이 어긋나지 않는다.

-- ── 사람마다 자기만 아는 열쇠 ────────────────────────────
-- ⚠️ 원래는 토픽을 `unread:{사용자 id}` 로 두고 비공개 채널로 잠그려 했다.
--    그런데 그 잠금은 `realtime.messages` 에 정책을 걸어야 하는데, 그 표는
--    우리 소유가 아니라 정책을 만들 수 없다(권한 거부 확인).
--
--    그래서 **토픽 이름 자체를 비밀로** 만든다. 사람마다 추측 불가능한 열쇠를
--    주고, 그 열쇠를 토픽 이름으로 쓴다. 열쇠는 본인만 읽을 수 있다.
--    사용자 id 는 여기저기 드러나지만 이 열쇠는 드러나지 않는다.
create table if not exists public.user_realtime_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.user_realtime_keys enable row level security;

-- 자기 열쇠만 읽는다
drop policy if exists urk_read_own on public.user_realtime_keys;
create policy urk_read_own on public.user_realtime_keys
  for select to authenticated using (user_id = auth.uid());

/**
 * 내 열쇠를 가져온다. 없으면 만들어서 준다.
 * (앱이 처음 켜질 때 한 번 부른다)
 */
create or replace function public.my_realtime_key()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare k uuid;
begin
  if auth.uid() is null then return null; end if;
  insert into public.user_realtime_keys (user_id) values (auth.uid())
    on conflict (user_id) do nothing;
  select key into k from public.user_realtime_keys where user_id = auth.uid();
  return k;
end $$;

grant execute on function public.my_realtime_key() to authenticated;

/**
 * 한 사람에게 "다시 세라"고 알린다.
 *
 * 토픽은 그 사람의 열쇠. 열쇠를 모르면 들을 수 없다.
 */
create or replace function public.notify_unread(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare k uuid;
begin
  if p_user is null then return; end if;
  -- 아직 열쇠가 없는 사람도 있다 — 그때 만들어 둔다
  insert into public.user_realtime_keys (user_id) values (p_user) on conflict (user_id) do nothing;
  select key into k from public.user_realtime_keys where user_id = p_user;
  if k is null then return; end if;
  /*
    ⚠️ 신호에 **개수를 담지 않는다.** 개수를 계산하는 규칙(차단·나간 방·읽음 시각)이
       앱 한 곳에만 있어야 두 곳이 어긋나지 않는다. 여기서는 "다시 세라"만 알린다.
       덕분에 신호가 새어 나가도 알 수 있는 게 없다.
  */
  perform realtime.send(jsonb_build_object('at', now()), 'recount', 'u:' || k::text, false);
end $$;

/**
 * 여러 사람에게 한 번에.
 * ⚠️ 보낸 사람은 뺀다 — 자기가 보낸 메시지 때문에 자기 숫자가 늘지 않는다.
 */
create or replace function public.notify_unread_many(p_users uuid[], p_except uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare u uuid;
begin
  foreach u in array coalesce(p_users, '{}') loop
    if u is not null and (p_except is null or u <> p_except) then
      perform public.notify_unread(u);
    end if;
  end loop;
end $$;

-- ── 대화 메시지 ────────────────────────────────────────────
create or replace function public.tg_unread_trip_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare members uuid[];
begin
  select array_agg(distinct uid) into members
    from (
      select t.user_id as uid from public.trips t where t.id = new.trip_id
      union
      select m.user_id from public.trip_members m
       where m.trip_id = new.trip_id and coalesce(m.status,'accepted') = 'accepted'
    ) s;
  perform public.notify_unread_many(members, new.user_id);
  return null;
end $$;

drop trigger if exists tg_unread_trip_message on public.trip_messages;
create trigger tg_unread_trip_message
  after insert on public.trip_messages
  for each row execute function public.tg_unread_trip_message();

-- ── 1:1 메시지 ─────────────────────────────────────────────
create or replace function public.tg_unread_dm_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare a uuid; b uuid;
begin
  select t.user_a, t.user_b into a, b from public.dm_threads t where t.id = new.thread_id;
  perform public.notify_unread_many(array[a, b], new.sender_id);
  return null;
end $$;

drop trigger if exists tg_unread_dm_message on public.dm_messages;
create trigger tg_unread_dm_message
  after insert on public.dm_messages
  for each row execute function public.tg_unread_dm_message();

-- ── 알림 ───────────────────────────────────────────────────
create or replace function public.tg_unread_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_unread(new.user_id);
  return null;
end $$;

drop trigger if exists tg_unread_notification on public.notifications;
create trigger tg_unread_notification
  after insert or update of is_read on public.notifications
  for each row execute function public.tg_unread_notification();

-- ── 읽음 표시 (내가 읽으면 내 숫자가 준다) ─────────────────
create or replace function public.tg_unread_self()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_unread(new.user_id);
  return null;
end $$;

drop trigger if exists tg_unread_chat_read on public.trip_chat_reads;
create trigger tg_unread_chat_read
  after insert or update on public.trip_chat_reads
  for each row execute function public.tg_unread_self();

drop trigger if exists tg_unread_dm_read on public.dm_reads;
create trigger tg_unread_dm_read
  after insert or update on public.dm_reads
  for each row execute function public.tg_unread_self();

-- ── 친구 요청 ──────────────────────────────────────────────
create or replace function public.tg_unread_friendship()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_unread_many(array[new.user_id, new.friend_id], null);
  return null;
end $$;

drop trigger if exists tg_unread_friendship on public.friendships;
create trigger tg_unread_friendship
  after insert or update on public.friendships
  for each row execute function public.tg_unread_friendship();

-- ── 왜 realtime.messages 정책이 없나 ──────────────────────
-- 그 표는 supabase_realtime_admin 소유라 우리가 정책을 만들 수 없다(확인함).
-- 대신 위처럼 **토픽 이름 자체를 비밀**로 만들어 같은 효과를 얻는다.
