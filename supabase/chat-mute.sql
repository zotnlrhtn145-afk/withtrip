-- WITHTRIP: 방별 알림 끄기 — 순수 "추가"만 하는 마이그레이션
--
-- ⚠️ 아직 실행하지 않았습니다. 사용자 확인 후에만 실행하세요.
--
-- 대원칙 준수: 새 테이블 1개 생성만. 기존 테이블·행·컬럼 변경 없음.


-- ─────────────────────────────────────────────────────────────
-- trip_chat_mutes — 이 방의 알림을 끈 사람
-- ─────────────────────────────────────────────────────────────
-- **행이 있으면 꺼진 것**이다. 켜면 행을 지운다.
-- (on/off 컬럼을 두면 "기본값이 뭐냐"를 매번 따져야 하는데, 알림은 기본이 켜짐이다)
--
-- trip_members 에 컬럼을 붙이지 않은 이유:
--   여행을 만든 사람은 trip_members 에 행이 없다(trips.user_id 로만 존재).
--   방장이 자기 방 알림을 못 끄게 된다. 오늘 투표에서 같은 함정에 빠졌다.
create table if not exists public.trip_chat_mutes (
  trip_id    uuid not null references public.trips(id) on delete cascade,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

comment on table public.trip_chat_mutes is
  '대화 알림을 끈 사람. 행이 있으면 꺼진 것. 켜면 행을 지운다.';

alter table public.trip_chat_mutes enable row level security;

-- 본인 설정만 보고 바꾼다 (남이 껐는지는 알 필요가 없다)
drop policy if exists "trip_chat_mutes_rw_own" on public.trip_chat_mutes;
create policy "trip_chat_mutes_rw_own" on public.trip_chat_mutes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
