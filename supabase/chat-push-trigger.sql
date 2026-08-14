-- WITHTRIP: 대화 푸시 알림 트리거 — 순수 "추가"만 하는 마이그레이션
--
-- ⚠️ 아직 실행하지 않았습니다. 사용자 확인 후에만 실행하세요.
--
-- 대원칙 준수: 기존 테이블·행·컬럼 변경 없음. 함수 1개 + 트리거 1개 추가.


-- ─────────────────────────────────────────────────────────────
-- 왜 앱이 아니라 DB 가 부르나
-- ─────────────────────────────────────────────────────────────
-- 보내는 사람의 앱이 푸시 요청까지 하면, 메시지를 보낸 직후 앱이 꺼지거나
-- 네트워크가 끊기면 **메시지는 저장됐는데 알림만 안 가는** 상태가 된다.
-- 여행지에서 네트워크가 나쁜 걸 감안하면 자주 생길 수 있다.
--
-- DB 가 부르면 메시지가 저장된 것과 알림이 나가는 것이 항상 같이 간다.
-- pg_net 은 비동기라 메시지 저장을 느리게 만들지 않는다.


-- 푸시 API 주소·비밀값은 DB 설정에 둔다 (코드에 박지 않는다)
-- 실행 전에 아래 두 줄을 프로젝트에 맞게 설정해야 한다:
--   alter database postgres set app.push_endpoint = 'https://www.withtrip.co.kr/api/push/chat';
--   alter database postgres set app.push_secret   = '<임의의 긴 문자열>';

create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  endpoint text := current_setting('app.push_endpoint', true);
  secret   text := current_setting('app.push_secret', true);
begin
  -- 설정이 없으면 아무 일도 하지 않는다 (기존 동작에 영향 없음)
  if endpoint is null or endpoint = '' then
    return new;
  end if;

  perform net.http_post(
    url     := endpoint,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-push-secret', coalesce(secret, '')
               ),
    body    := jsonb_build_object('messageId', new.id)
  );
  return new;
exception when others then
  -- 알림 실패가 메시지 저장을 막으면 안 된다
  return new;
end;
$$;

comment on function public.notify_chat_message() is
  '새 대화 메시지가 들어오면 푸시 API 를 부른다. 실패해도 메시지 저장은 그대로 진행된다.';

drop trigger if exists trg_notify_chat_message on public.trip_messages;
create trigger trg_notify_chat_message
  after insert on public.trip_messages
  for each row
  execute function public.notify_chat_message();
