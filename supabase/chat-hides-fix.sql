-- WITHTRIP: 대화 목록에서 지우기가 **한 번도 통한 적이 없던 것** 고치기
--
-- ─────────────────────────────────────────────────────────────
-- 무엇이 잘못돼 있었나 (신고: "그리고 여전히 삭제가 안되")
-- ─────────────────────────────────────────────────────────────
-- 표의 조건 두 개가 **서로 모순**이었다.
--
--   PRIMARY KEY (user_id, trip_id, thread_id)   → 세 칸 모두 NOT NULL 이 된다
--   CHECK (여행이면 thread_id 가 NULL, 1:1이면 trip_id 가 NULL)
--
-- 기본키가 세 칸을 전부 NOT NULL 로 만드는데, 체크는 **둘 중 하나가 반드시
-- NULL** 이라고 한다. 두 조건을 동시에 만족하는 행은 존재할 수 없다.
--
-- 실제로 확인했다 — `select count(*) from chat_hides` 가 **0** 이다.
-- 만든 날부터 지금까지 단 한 행도 들어간 적이 없다. 화면은 먼저 지워 놓고
-- 저장에 실패하니 "삭제 실패" 만 뜨고 목록이 되살아났다.
--
-- ─────────────────────────────────────────────────────────────
-- 어떻게 고치나
-- ─────────────────────────────────────────────────────────────
-- ⚠️ 부분 유니크 인덱스(`WHERE trip_id IS NOT NULL`)를 그대로 두고 기본키만
--    없애면 **여전히 안 된다.** 앱은 `upsert(onConflict: "user_id,trip_id")`
--    를 쓰는데, 포스트그레스는 `ON CONFLICT (a,b)` 로 **부분 인덱스를 고르지
--    못한다**(같은 조건의 WHERE 를 문장에 함께 적어야 하는데 PostgREST 는
--    그걸 안 붙인다). 42P10 으로 또 실패한다.
--
-- ⚠️ 그렇다고 (user_id, trip_id) 에 **온전한** 유니크를 걸 수도 없다. 1:1
--    대화는 trip_id 가 NULL 이라, `NULLS NOT DISTINCT` 를 쓰면 **한 사람의
--    1:1 대화가 전부 한 줄로 뭉개진다.** 안 쓰면 NULL 끼리는 안 부딪혀서
--    같은 여행을 두 번 지울 수 있다.
--
-- 그래서 **둘을 하나로 합친 칸**을 만들고 거기에 기본키를 건다.
-- 여행이든 1:1이든 `target_id` 는 늘 값이 있으므로 규칙이 단순해진다.
--
-- 대원칙 준수 확인:
--   - 지우는 데이터가 없다 (표가 비어 있다 — 0행)
--   - 다른 표는 건드리지 않는다
--   - 실패해도 대화 기능 자체는 그대로다


-- 1) 두 칸을 비울 수 있게 한다 (기본키를 먼저 없애야 NOT NULL 이 풀린다)
alter table public.chat_hides drop constraint if exists chat_hides_pkey;
alter table public.chat_hides alter column trip_id drop not null;
alter table public.chat_hides alter column thread_id drop not null;

-- 2) 여행이든 1:1이든 **늘 값이 있는** 칸을 하나 만든다
alter table public.chat_hides
  add column if not exists target_id uuid
  generated always as (coalesce(trip_id, thread_id)) stored;

comment on column public.chat_hides.target_id is
  '여행 대화방이면 trip_id, 1:1이면 thread_id. 기본키를 걸기 위한 칸이다 — 직접 넣지 않는다(자동 계산).';

-- 3) 새 기본키. 한 사람이 한 대화를 두 번 지울 수 없다.
--    ⚠️ 앱의 upsert 는 이제 onConflict: "user_id,target_id" 를 쓴다.
alter table public.chat_hides
  add constraint chat_hides_pkey primary key (user_id, target_id);

-- 4) 예전 부분 인덱스는 이제 할 일이 없다 — 위 기본키가 같은 일을 한다.
--    남겨 두면 쓰기마다 인덱스를 두 벌씩 갱신하게 된다.
drop index if exists public.chat_hides_trip_uniq;
drop index if exists public.chat_hides_thread_uniq;
