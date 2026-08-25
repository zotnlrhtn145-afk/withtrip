-- 빈칸을 모아 두고 한가할 때 채운다.
--
-- ⚠️ **저장하는 순간에 AI 를 부르지 않는다.** 느리고(사용자가 기다린다) 매번
--    돈이 나간다. 대신 "이건 아직 모른다" 를 적어 두고, 배치가 20건씩 묶어
--    처리한다 — 20건에 AI 호출 한 번이다.
--
-- ⚠️ 큐는 **가게(`places`) 단위**다. 찜 단위로 두면 500명이 찜한 곳을 500번
--    분류한다. 한 번 채우면 그 가게를 찜한 모두가 같이 얻는다.

create table if not exists public.place_fill_queue (
  google_place_id text primary key,
  /** 무엇이 비었나: 'category' | 'photo' */
  need text not null,
  tries integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists place_fill_queue_need_idx on public.place_fill_queue (need, tries);

alter table public.place_fill_queue enable row level security;
-- 서버(service_role)만 읽고 쓴다.
