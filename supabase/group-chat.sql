-- 단톡방 — 아직 여행이 아닌 방. (이미 적용됨)
--
-- 친구들과 먼저 모여 이야기하다가 여행이 정해지면 그때 여행클립이 된다.
--
-- ⚠️ **새 표를 만들지 않고 trips 를 쓴다.** 대화 기능(사진·투표·공지·정산·읽음)이
--    전부 trip_id 에 매달려 있다. 방을 위한 표를 따로 만들면 그 화면 전체를
--    한 벌 더 만들어야 하고, 두 벌이 조용히 어긋난다.
--
-- ⚠️ 대신 **여행 목록에는 안 뜨게** 한다. kind='chat' 인 동안은 대화 목록에만 있다.
--    여행클립으로 만들면 같은 행이 kind='trip' 이 되어 그때부터 여행 목록에 나타난다.
--    (행을 새로 만들지 않는다 — 그때까지 나눈 대화·사진·투표가 다 끊긴다)
alter table public.trips
  add column if not exists kind text not null default 'trip'
  check (kind in ('trip', 'chat'));

comment on column public.trips.kind is
  '''trip'' = 여행클립, ''chat'' = 아직 여행이 아닌 단톡방. 여행 목록은 ''trip'' 만 보여준다.';

create index if not exists trips_kind_idx on public.trips (kind) where kind = 'chat';
