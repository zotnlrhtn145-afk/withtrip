-- WITHTRIP: 답장 + 읽음 표시 — 순수 "추가"만 하는 마이그레이션
--
-- ⚠️ 아직 실행하지 않았습니다. 사용자 확인 후에만 실행하세요.
--
-- 대원칙 준수 확인:
--   - 기존 테이블/행을 하나도 바꾸지 않습니다
--   - NULL 허용 컬럼 2개 추가 + 읽기 정책 1개 추가 + 실시간 발행 1개 추가
--   - 기존 정책은 지우지 않습니다 (읽기 정책을 "추가"만 합니다)


-- ─────────────────────────────────────────────────────────────
-- 1) reply_to — 어떤 메시지에 대한 답장인지
-- ─────────────────────────────────────────────────────────────
-- payload(JSONB)에 넣지 않는 이유: payload 는 kind 별 데이터(위치/사진)를 담는 자리다.
-- 답장은 kind 와 무관한 **부가 속성**이라(사진에도 답장할 수 있다) 컬럼으로 둔다.
--
-- 외래키를 걸되 ON DELETE SET NULL 로 한다 —
-- 원본이 사라져도 답장 메시지 자체는 남아야 한다.
alter table public.trip_messages
  add column if not exists reply_to uuid references public.trip_messages(id) on delete set null;

alter table public.dm_messages
  add column if not exists reply_to uuid references public.dm_messages(id) on delete set null;

comment on column public.trip_messages.reply_to is '답장 대상 메시지 id. NULL 이면 일반 메시지.';
comment on column public.dm_messages.reply_to is '답장 대상 메시지 id. NULL 이면 일반 메시지.';

create index if not exists trip_messages_reply_to_idx on public.trip_messages (reply_to)
  where reply_to is not null;


-- ─────────────────────────────────────────────────────────────
-- 2) 읽음 기록을 같은 여행 멤버끼리 볼 수 있게
-- ─────────────────────────────────────────────────────────────
-- 지금 정책(trip_chat_reads_rw_own)은 **본인 행만** 보입니다.
-- 그래서 "몇 명이 아직 안 읽었는지"를 셀 수 없습니다.
--
-- 기존 정책은 그대로 두고 **읽기 정책만 추가**합니다.
-- (Postgres 는 정책이 여러 개면 OR 로 합칩니다 — 기존 권한이 줄지 않습니다)
--
-- 노출되는 정보는 "그 사람이 이 방을 언제까지 읽었는가" 뿐입니다.
-- 같은 여행에 속한 멤버끼리만 보입니다.
drop policy if exists "trip_chat_reads_select_members" on public.trip_chat_reads;
create policy "trip_chat_reads_select_members"
  on public.trip_chat_reads for select
  using (
    exists (
      select 1 from public.trip_members m
      where m.trip_id = trip_chat_reads.trip_id
        and m.user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────
-- 3) 읽음 기록을 실시간으로 받기
-- ─────────────────────────────────────────────────────────────
-- 상대가 읽으면 화면의 "안 읽음" 숫자가 바로 줄어야 의미가 있습니다.
-- 이미 열려 있는 소켓에 채널만 하나 더 붙는 것이라 **동시 접속 수는 늘지 않습니다.**
alter publication supabase_realtime add table public.trip_chat_reads;
