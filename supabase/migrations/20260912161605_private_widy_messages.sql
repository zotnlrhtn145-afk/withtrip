-- 위디는 여행 참여 조건에 더해 본인 소유 대화만 읽습니다.
create policy trip_messages_widy_private
on public.trip_messages as restrictive for select to authenticated, anon
using (coalesce(kind, '') not like 'widy%' or user_id = (select auth.uid()));

create index if not exists trip_messages_widy_owner_created_idx
on public.trip_messages (trip_id, user_id, created_at desc)
where kind in ('widy', 'widy_q');

-- 기존 웹훅 인수/알림 함수를 보존하고 위디 INSERT만 호출 대상에서 제외합니다.
do $migration$
declare item record; definition text;
begin
  for item in select oid, tgname, tgqual from pg_trigger
    where tgrelid = 'public.trip_messages'::regclass
      and tgname in ('wt_push_trip_chat', 'tg_unread_trip_message')
  loop
    if item.tgqual is not null then
      raise exception 'Unexpected existing condition on %', item.tgname;
    end if;
    definition := pg_get_triggerdef(item.oid);
    definition := replace(definition, 'CREATE TRIGGER ', 'CREATE OR REPLACE TRIGGER ');
    definition := replace(definition, ' EXECUTE FUNCTION ',
      ' WHEN (coalesce(NEW.kind, '''') not like ''widy%'') EXECUTE FUNCTION ');
    execute definition;
  end loop;
end
$migration$;
