-- 대화 상단 고정 (카톡식).
--
-- ⚠️ **여행 대화방과 1:1 대화를 한 표에 담는다.** 목록에서는 둘이 섞여 있고
--    사용자에겐 그냥 "대화"다. 표를 둘로 나누면 정렬할 때마다 둘을 합쳐야 하고,
--    한쪽만 고치는 실수가 난다.
--    그래서 방을 가리키는 열쇠를 문자열 하나로 둔다: 'trip:<uuid>' 또는 'dm:<uuid>'.
--    (앱 목록의 ChatItem.key 와 같은 값이라 화면 코드에서 바로 쓴다)
--
-- ⚠️ **행이 있으면 고정된 것**이다. 풀면 행을 지운다.
--    on/off 컬럼을 두면 "기본값이 뭐냐"를 매번 따져야 하는데, 고정은 기본이 꺼짐이다.
--    (알림 끄기 trip_chat_mutes 와 같은 방식)
--
-- ⚠️ 외래키를 걸지 않는다. 열쇠가 두 표(trips / dm_threads)를 가리키므로
--    한쪽으로 걸 수 없다. 방이 사라지면 목록에 안 뜨므로 고정만 남아도 해가 없다.
create table if not exists public.chat_pins (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  chat_key   text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, chat_key)
);

comment on table public.chat_pins is
  '상단에 고정한 대화. 행이 있으면 고정된 것. 풀면 행을 지운다.';
comment on column public.chat_pins.chat_key is
  '''trip:<uuid>'' 또는 ''dm:<uuid>''. 여행 대화방과 1:1 대화를 한 표에 담으려고 문자열로 둔다.';

alter table public.chat_pins enable row level security;

-- 본인 것만 보고 바꾼다 (남이 뭘 고정했는지는 알 필요가 없다)
drop policy if exists "chat_pins_rw_own" on public.chat_pins;
create policy "chat_pins_rw_own" on public.chat_pins for all
  to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
