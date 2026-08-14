-- WITHTRIP: 대화 투표 + 리액션 — 순수 "추가"만 하는 마이그레이션
--
-- ⚠️ 아직 실행하지 않았습니다. 사용자 확인 후에만 실행하세요.
--
-- 대원칙 준수 확인:
--   - 기존 테이블/컬럼/행을 하나도 건드리지 않습니다
--   - 새 테이블 3개 생성만 합니다
--   - 실패해도 기존 대화 기능은 그대로 동작합니다


-- ─────────────────────────────────────────────────────────────
-- 왜 payload(JSONB) 가 아니라 별도 테이블인가
-- ─────────────────────────────────────────────────────────────
-- 투표 "선택"은 **사람당 한 행**이어야 한다.
-- JSONB 배열에 담으면 두 명이 동시에 누를 때 한 명의 표가 사라진다
-- (읽고 → 고쳐서 → 통째로 덮어쓰기 때문). 유니크 제약으로 DB 가 막아줘야 한다.
-- 리액션도 같은 이유다.


-- ─────────────────────────────────────────────────────────────
-- 1) trip_votes — 투표 본체
-- ─────────────────────────────────────────────────────────────
create table if not exists public.trip_votes (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  message_id   uuid references public.trip_messages(id) on delete cascade,
  created_by   uuid not null,
  question     text not null,
  options      text[] not null,               -- 보기 목록 (순서 = 인덱스)
  multi        boolean not null default false, -- 복수 선택 허용
  closed_at    timestamptz,                    -- 마감 시각. NULL 이면 진행 중
  created_at   timestamptz not null default now()
);

create index if not exists trip_votes_trip_idx on public.trip_votes (trip_id, created_at desc);
create index if not exists trip_votes_message_idx on public.trip_votes (message_id);

comment on table public.trip_votes is '여행 단톡 투표. "어디 갈까"·"몇 시 출발" 같은 결정을 대화에서 바로 한다.';
comment on column public.trip_votes.message_id is '이 투표가 붙은 대화 메시지. 메시지가 지워지면 같이 사라진다.';


-- ─────────────────────────────────────────────────────────────
-- 2) trip_vote_selections — 누가 무엇을 골랐나
-- ─────────────────────────────────────────────────────────────
-- (vote_id, user_id, option_index) 유니크 → 같은 보기에 두 번 투표되지 않는다.
-- 단일 선택 투표에서 보기를 바꾸면 앱이 기존 행을 지우고 새로 넣는다.
create table if not exists public.trip_vote_selections (
  id           uuid primary key default gen_random_uuid(),
  vote_id      uuid not null references public.trip_votes(id) on delete cascade,
  user_id      uuid not null,
  option_index integer not null,
  created_at   timestamptz not null default now(),
  unique (vote_id, user_id, option_index)
);

create index if not exists trip_vote_selections_vote_idx on public.trip_vote_selections (vote_id);


-- ─────────────────────────────────────────────────────────────
-- 3) trip_message_reactions — 메시지 공감
-- ─────────────────────────────────────────────────────────────
-- (message_id, user_id, emoji) 유니크 → 같은 사람이 같은 이모지를 두 번 못 단다.
create table if not exists public.trip_message_reactions (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.trip_messages(id) on delete cascade,
  user_id    uuid not null,
  emoji      text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists trip_message_reactions_msg_idx on public.trip_message_reactions (message_id);


-- ─────────────────────────────────────────────────────────────
-- 4) RLS — 같은 여행 멤버만 읽고 쓴다
-- ─────────────────────────────────────────────────────────────
alter table public.trip_votes enable row level security;
alter table public.trip_vote_selections enable row level security;
alter table public.trip_message_reactions enable row level security;

-- 투표: 그 여행 멤버면 보고 만들 수 있다. 마감은 만든 사람만.
drop policy if exists "trip_votes_select_members" on public.trip_votes;
create policy "trip_votes_select_members" on public.trip_votes for select
  using (exists (select 1 from public.trip_members m
                 where m.trip_id = trip_votes.trip_id and m.user_id = auth.uid()));

drop policy if exists "trip_votes_insert_members" on public.trip_votes;
create policy "trip_votes_insert_members" on public.trip_votes for insert
  with check (created_by = auth.uid()
              and exists (select 1 from public.trip_members m
                          where m.trip_id = trip_votes.trip_id and m.user_id = auth.uid()));

drop policy if exists "trip_votes_update_owner" on public.trip_votes;
create policy "trip_votes_update_owner" on public.trip_votes for update
  using (created_by = auth.uid());

-- 선택: 같은 여행 멤버끼리 서로의 표가 보여야 결과를 셀 수 있다. 쓰기는 본인 것만.
drop policy if exists "trip_vote_selections_select_members" on public.trip_vote_selections;
create policy "trip_vote_selections_select_members" on public.trip_vote_selections for select
  using (exists (select 1 from public.trip_votes v
                 join public.trip_members m on m.trip_id = v.trip_id
                 where v.id = trip_vote_selections.vote_id and m.user_id = auth.uid()));

drop policy if exists "trip_vote_selections_write_own" on public.trip_vote_selections;
create policy "trip_vote_selections_write_own" on public.trip_vote_selections for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 리액션: 같은 방 멤버끼리 보이고, 쓰기는 본인 것만.
drop policy if exists "trip_message_reactions_select_members" on public.trip_message_reactions;
create policy "trip_message_reactions_select_members" on public.trip_message_reactions for select
  using (exists (select 1 from public.trip_messages msg
                 join public.trip_members m on m.trip_id = msg.trip_id
                 where msg.id = trip_message_reactions.message_id and m.user_id = auth.uid()));

drop policy if exists "trip_message_reactions_write_own" on public.trip_message_reactions;
create policy "trip_message_reactions_write_own" on public.trip_message_reactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────
-- 5) 실시간 — 남이 투표하거나 공감하면 바로 반영
-- ─────────────────────────────────────────────────────────────
-- 이미 열려 있는 소켓에 채널만 붙는 것이라 동시 접속 수는 늘지 않습니다.
alter publication supabase_realtime add table public.trip_vote_selections;
alter publication supabase_realtime add table public.trip_message_reactions;
