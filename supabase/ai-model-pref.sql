-- 실제로 통한 AI 모델을 기억해 둔다.
--
-- 왜 필요한가: 지금은 요청이 올 때마다 **모델 목록을 받아 앞에서부터 하나씩
-- 시도**한다. 앞 모델이 과부하(503)면 두 번 재시도하고, 그래도 안 되면 다음
-- 모델로 넘어간다. 한 번 성공하는 데 호출이 여러 번 나갈 수 있다.
--
-- ⚠️ 서버는 요청마다 새로 뜨기 때문에 **메모리에 기억해 봐야 금방 사라진다.**
--    (도시 커버 150장을 만들던 날, 이 낭비가 150번 곱해졌다)
--    그래서 표에 남긴다 — 다음 요청은 통했던 모델부터 시도한다.
--
-- ⚠️ 모델 이름을 코드에 박지 않는다. 계정마다 보이는 모델이 다르고, 구글이
--    조용히 없애기도 한다. 어디까지나 "**지난번에 통했던 것**" 을 먼저 볼 뿐,
--    실패하면 예전처럼 목록을 훑는다.

create table if not exists public.ai_model_pref (
  /** 용도. 예: 'cover-image', 'text' */
  purpose text primary key,
  model text not null,
  /** 연속 실패 횟수 — 몇 번 실패하면 이 기억을 버린다 */
  fails integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.ai_model_pref is
  '지난번에 실제로 통한 AI 모델. 다음 요청이 그것부터 시도해 헛호출을 줄인다.';

alter table public.ai_model_pref enable row level security;
-- 서버(service_role)만 읽고 쓴다. 앱에서 건드릴 이유가 없다.

/** 통한 모델을 기억한다 */
create or replace function public.remember_ai_model(p_purpose text, p_model text)
returns void language sql security definer set search_path = public as $$
  insert into public.ai_model_pref (purpose, model, fails, updated_at)
  values (p_purpose, p_model, 0, now())
  on conflict (purpose) do update
     set model = excluded.model, fails = 0, updated_at = now();
$$;

/**
 * 실패를 센다. 3번 연속 실패하면 기억을 지운다 —
 * 구글이 그 모델을 없앴을 수 있으므로 다시 목록부터 찾게 한다.
 */
create or replace function public.ai_model_failed(p_purpose text)
returns void language sql security definer set search_path = public as $$
  update public.ai_model_pref set fails = fails + 1, updated_at = now() where purpose = p_purpose;
  delete from public.ai_model_pref where purpose = p_purpose and fails >= 3;
$$;

revoke all on function public.remember_ai_model(text, text) from public, anon, authenticated;
revoke all on function public.ai_model_failed(text) from public, anon, authenticated;
