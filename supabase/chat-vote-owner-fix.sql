-- WITHTRIP: 방금 만든 정책의 결함 수정 — 여행 소유자가 빠져 있었다
--
-- 문제
--   trips.user_id (여행을 만든 사람)는 trip_members 에 행이 없다.
--   그런데 오늘 만든 정책들이 trip_members 만 확인해서,
--   **여행을 만든 사람이 자기 방에서 투표를 못 만들고, 읽음 기록도 못 본다.**
--
-- 고치는 방법
--   "그 여행의 멤버 **또는** 소유자" 로 조건을 넓힌다.
--   오늘 만든 정책만 다시 만든다. 다른 테이블의 기존 정책은 건드리지 않는다.
--
-- 대원칙 준수: 테이블·행·컬럼 변경 없음. 정책만 교체.


-- 같은 조건을 여러 정책이 쓰므로 함수로 뺀다 (한 곳만 고치면 되도록)
create or replace function public.is_trip_participant(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.user_id = auth.uid()
  ) or exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = auth.uid()
  );
$$;

comment on function public.is_trip_participant(uuid) is
  '이 여행에 속한 사람인가 — 소유자(trips.user_id) 또는 멤버(trip_members). 대화 관련 RLS 가 공통으로 쓴다.';


-- ── 읽음 기록 (오늘 만든 정책) ──────────────────────────────
drop policy if exists "trip_chat_reads_select_members" on public.trip_chat_reads;
create policy "trip_chat_reads_select_members"
  on public.trip_chat_reads for select
  using (public.is_trip_participant(trip_chat_reads.trip_id));


-- ── 투표 (오늘 만든 정책) ───────────────────────────────────
drop policy if exists "trip_votes_select_members" on public.trip_votes;
create policy "trip_votes_select_members" on public.trip_votes for select
  using (public.is_trip_participant(trip_votes.trip_id));

drop policy if exists "trip_votes_insert_members" on public.trip_votes;
create policy "trip_votes_insert_members" on public.trip_votes for insert
  with check (created_by = auth.uid() and public.is_trip_participant(trip_votes.trip_id));

drop policy if exists "trip_vote_selections_select_members" on public.trip_vote_selections;
create policy "trip_vote_selections_select_members" on public.trip_vote_selections for select
  using (exists (
    select 1 from public.trip_votes v
    where v.id = trip_vote_selections.vote_id
      and public.is_trip_participant(v.trip_id)
  ));


-- ── 리액션 (오늘 만든 정책) ─────────────────────────────────
drop policy if exists "trip_message_reactions_select_members" on public.trip_message_reactions;
create policy "trip_message_reactions_select_members" on public.trip_message_reactions for select
  using (exists (
    select 1 from public.trip_messages msg
    where msg.id = trip_message_reactions.message_id
      and public.is_trip_participant(msg.trip_id)
  ));
