-- 여행에 무언가 등록되면 **멤버 전원에게** 알림.
--
-- 일정 · 숙소 · 이동수단 · 지출이 등록될 때 같은 여행에 있는 사람들에게 알린다.
--
-- ⚠️ **앱 코드가 아니라 DB 트리거로 둔다.** 등록하는 자리가 앱·웹 양쪽에 있고
--    앞으로 더 늘어난다. 화면마다 알림 코드를 넣으면 **한 곳만 빠져도 조용히
--    안 간다** — 실제로 이 프로젝트에서 그런 식으로 어긋난 적이 여러 번 있다.
--    여기 한 곳에 두면 어디서 넣든 반드시 나간다.
--
-- ⚠️ **등록한 본인에게는 안 보낸다.** 내가 한 일을 나에게 알리면 성가시기만 하다.
--
-- ⚠️ `notifications` 에 INSERT 하면 기존 트리거(wt_push_notify)가 푸시까지 보낸다.
--    그래서 여기서는 행만 넣으면 된다.
--
-- ⚠️ 알림 하나가 실패해도 **등록 자체는 막지 않는다.** 일정이 안 들어가는 것보다
--    알림이 빠지는 게 낫다. 그래서 예외를 삼킨다.

-- ⚠️ **`type` 에 CHECK 제약이 있다.** 새 종류를 먼저 허용하지 않으면 트리거가
--    조용히 실패한다(예외를 삼키므로 등록은 되고 알림만 안 온다 — 찾기 어렵다).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'trip_invite','clip_invite','friend_request','clip_like','clip_comment',
    'friend_accepted','clip_post','place_recommendation','location_share',
    'schedule_added','accommodation_added','transport_added','expense_added'
  ]));

-- 여행 참여자 = 소유자 + 수락한 멤버
create or replace function public.trip_member_ids(p_trip_id uuid)
returns setof uuid
language sql
stable
as $$
  select t.user_id from public.trips t where t.id = p_trip_id and t.user_id is not null
  union
  select m.user_id from public.trip_members m
   where m.trip_id = p_trip_id and m.status = 'accepted' and m.user_id is not null
$$;

create or replace function public.notify_trip_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_actor uuid;
  v_type text;
  v_what text;
  v_title text;
  v_msg text;
  v_actor_name text;
begin
  begin
    -- 테이블마다 다른 칸에서 "무엇이" 등록됐는지 뽑는다
    if TG_TABLE_NAME = 'trip_schedules' then
      v_trip_id := new.trip_id; v_actor := new.created_by; v_type := 'schedule_added';
      v_what := coalesce(nullif(btrim(new.place_name), ''), '일정');
    elsif TG_TABLE_NAME = 'trip_accommodations' then
      v_trip_id := new.trip_id; v_actor := new.created_by; v_type := 'accommodation_added';
      v_what := coalesce(nullif(btrim(new.name), ''), '숙소');
    elsif TG_TABLE_NAME = 'trip_transports' then
      v_trip_id := new.trip_id; v_actor := new.created_by; v_type := 'transport_added';
      v_what := coalesce(
        nullif(btrim(coalesce(new.from_label,'') || ' → ' || coalesce(new.to_label,'')), ' → '),
        nullif(btrim(coalesce(new.carrier_name, new.airline_name, '')), ''),
        '이동수단');
    elsif TG_TABLE_NAME = 'expenses' then
      v_trip_id := new.trip_id; v_actor := new.payer_id; v_type := 'expense_added';
      v_what := coalesce(nullif(btrim(new.title), ''), '지출')
                || case when new.amount is not null
                        then ' ' || to_char(new.amount, 'FM999,999,999') || '원' else '' end;
    else
      return new;
    end if;

    if v_trip_id is null then return new; end if;

    select t.title into v_title from public.trips t where t.id = v_trip_id;
    select p.nickname into v_actor_name from public.profiles p where p.id = v_actor;

    -- "오수환님이 '제주도 여행'에 일정을 등록했어요 — 성산일출봉"
    v_msg :=
      coalesce(nullif(btrim(v_actor_name), '') || '님이 ', '')
      || coalesce('''' || nullif(btrim(v_title), '') || '''에 ', '여행에 ')
      || case v_type
           when 'schedule_added' then '일정을'
           when 'accommodation_added' then '숙소를'
           when 'transport_added' then '이동수단을'
           else '지출을'
         end
      || ' 등록했어요 — ' || v_what;

    insert into public.notifications (user_id, actor_id, type, message, reference_id, payload)
    select m, v_actor, v_type, v_msg, new.id,
           jsonb_build_object('tripId', v_trip_id, 'tripTitle', coalesce(v_title, ''))
      from public.trip_member_ids(v_trip_id) m
     where v_actor is null or m <> v_actor;   -- 내가 한 일은 나에게 안 보낸다
  exception when others then
    -- ⚠️ 알림이 실패해도 등록은 그대로 진행된다
    raise warning 'notify_trip_activity 실패: %', sqlerrm;
  end;
  return new;
end
$$;

drop trigger if exists wt_notify_schedule on public.trip_schedules;
create trigger wt_notify_schedule after insert on public.trip_schedules
  for each row execute function public.notify_trip_activity();

drop trigger if exists wt_notify_accommodation on public.trip_accommodations;
create trigger wt_notify_accommodation after insert on public.trip_accommodations
  for each row execute function public.notify_trip_activity();

drop trigger if exists wt_notify_transport on public.trip_transports;
create trigger wt_notify_transport after insert on public.trip_transports
  for each row execute function public.notify_trip_activity();

drop trigger if exists wt_notify_expense on public.expenses;
create trigger wt_notify_expense after insert on public.expenses
  for each row execute function public.notify_trip_activity();
