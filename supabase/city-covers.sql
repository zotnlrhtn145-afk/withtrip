-- WITHTRIP: 도시 대표 커버 이미지 — 순수 "추가"만 하는 마이그레이션
--
-- ⚠️ 아직 실행하지 않았습니다. 사용자 확인 후에만 실행하세요.
--
-- 대원칙 준수: 새 테이블 1개 생성만. 기존 테이블·행·컬럼 변경 없음.


-- ─────────────────────────────────────────────────────────────
-- 왜 필요한가
-- ─────────────────────────────────────────────────────────────
-- 지금은 여행을 만들 때마다 AI 커버를 **새로 생성**한다. 그래서
--   1) 같은 제주도라도 여행마다 다른 이미지가 나온다 → 대표 이미지 느낌이 안 난다
--   2) 가끔 그 도시와 상관없는 그림이 나온다
--   3) 만들 때마다 비용이 든다
--
-- 도시당 한 장만 만들어 두고 **모두 그걸 재사용**한다.
--   - 같은 도시 = 항상 같은 이미지
--   - 이미 만든 도시는 기다림 없이 즉시 표시
--   - 비용은 도시 수만큼만 (여행 수와 무관)

create table if not exists public.city_covers (
  -- 정규화된 도시 키 (영문 소문자, 예: "jeju", "osaka"). 조회의 기준.
  city_key    text primary key,
  -- 화면·프롬프트에 쓸 표기 (예: "Jeju, South Korea")
  city_label  text not null,
  -- 어떤 명소를 그렸는지 (나중에 마음에 안 들면 이걸 보고 다시 만든다)
  landmark    text,
  image_url   text not null,
  created_at  timestamptz not null default now()
);

comment on table public.city_covers is
  '도시별 대표 커버 이미지. 도시당 한 장만 만들어 모든 여행이 재사용한다.';
comment on column public.city_covers.city_key is
  '정규화된 영문 소문자 키. 같은 도시가 두 번 만들어지지 않게 하는 기준.';

alter table public.city_covers enable row level security;

-- 누구나 읽는다 (공용 자산). 쓰기는 서버(service_role)만 — 정책을 만들지 않는다.
drop policy if exists "city_covers_select_all" on public.city_covers;
create policy "city_covers_select_all"
  on public.city_covers for select
  using (true);
