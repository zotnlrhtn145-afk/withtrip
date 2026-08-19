-- 관리자 로그인에 쓰는 값.
--
-- 왜 환경변수에서 여기로 옮겼는가:
--   소금·해시·서명열쇠를 Vercel 환경변수에 넣으려면 **사람이 손으로 네 개를
--   붙여넣고 재배포**해야 한다. 그 단계를 안 하면 화면은 떠 있는데 로그인만
--   안 되는, 원인을 짐작하기 어려운 상태가 된다.
--   비밀번호를 표에 (해시로) 두는 건 원래 모든 서비스가 하는 방식이다.
--
-- ⚠️ **비밀번호 원문은 여기에도 없다.** 소금과 해시만 있다.
--    해시는 PBKDF2-SHA256 21만 번이라 거꾸로 풀 수 없다.
--
-- ⚠️ 정책을 하나도 만들지 않는다 = 일반 사용자는 **한 줄도 못 읽는다.**
--    서버(service_role)만 읽는다.

create table if not exists public.admin_credentials (
  -- 한 줄만 있으면 된다 — 여러 줄이 생겨 어느 게 진짜인지 헷갈리는 걸 막는다
  id boolean primary key default true check (id),
  username text not null,
  pw_salt text not null,
  pw_hash text not null,
  -- 세션 쿠키에 서명하는 열쇠. 바꾸면 열려 있던 모든 로그인이 즉시 끊긴다
  session_secret text not null,
  updated_at timestamptz not null default now()
);

alter table public.admin_credentials enable row level security;
-- 정책 없음 = 전부 거부
