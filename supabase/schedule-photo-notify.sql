-- 일정에 사진을 남기면 같이 가는 사람들에게 알린다 — **묶어서 한 통만.**
--
-- ## ⚠️ 트리거로 하면 안 된다
--
-- 다른 등록(일정·숙소·지출)은 행마다 트리거가 돌지만, 사진은 **한 번에 여러
-- 장** 올린다. 행 트리거로 하면 10장을 올릴 때 알림이 **10번** 간다.
-- 여행 중에 그러면 다들 알림을 꺼 버린다 — 그럼 이 기능은 죽는다.
--
-- 그래서 앱이 **한 번 올리기를 마친 뒤** 이 함수를 한 번 부른다.
--
-- ## ⚠️ 연달아 올리는 것도 묶는다
--
-- 사진을 고르고, 보고, 몇 장 더 넣는 일이 흔하다. 그때마다 한 통씩 가면
-- 결국 트리거와 똑같아진다. 그래서 **같은 사람이 같은 일정에 30분 안에**
-- 다시 올리면, 새로 만들지 않고 **앞의 알림에 장수를 더한다.**
--
--   "오수환님이 「제주국제공항 도착」에 사진 3장을 남겼어요"
--    → 두 장 더 올리면 → "…사진 5장을 남겼어요" (알림은 그대로 한 통)
--
-- ⚠️ 이미 읽은 알림은 건드리지 않는다. 읽고 나서 숫자가 바뀌면 뭘 읽었는지
--    알 수 없게 된다 — 그때는 새로 하나 만든다.

create or replace function public.notify_schedule_photos(
  p_schedule_id uuid,
  p_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_place text;
  v_title text;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_since timestamptz := now() - interval '30 minutes';
  v_total integer;
  v_msg text;
begin
  if p_count is null or p_count < 1 or v_actor is null then return; end if;

  select s.trip_id, coalesce(nullif(btrim(s.place_name), ''), '일정')
    into v_trip_id, v_place
    from public.trip_schedules s
   where s.id = p_schedule_id;
  if v_trip_id is null then return; end if;

  /*
    ⚠️ **정말 그 여행 사람인지 여기서 확인한다.** security definer 라 RLS 를
       지나가므로, 남의 여행 일정 번호를 넣어 알림을 뿌릴 수 있으면 안 된다.
  */
  if not exists (select 1 from public.trip_member_ids(v_trip_id) m where m = v_actor) then
    return;
  end if;

  select t.title into v_title from public.trips t where t.id = v_trip_id;
  select p.nickname into v_actor_name from public.profiles p where p.id = v_actor;

  -- 30분 안에 같은 사람이 같은 일정에 올린 **안 읽은** 알림이 있으면 거기에 더한다
  select coalesce(max((n.payload ->> 'count')::int), 0) into v_total
    from public.notifications n
   where n.type = 'schedule_photo'
     and n.reference_id = p_schedule_id
     and n.actor_id = v_actor
     and n.is_read = false
     and n.created_at > v_since;
  v_total := v_total + p_count;

  v_msg :=
    coalesce(nullif(btrim(v_actor_name), '') || '님이 ', '')
    || '「' || v_place || '」에 사진 ' || v_total || '장을 남겼어요';

  update public.notifications n
     set message = v_msg,
         payload = jsonb_set(
           coalesce(n.payload, '{}'::jsonb), '{count}', to_jsonb(v_total), true
         ),
         created_at = now()   -- 목록 맨 위로 다시 올린다
   where n.type = 'schedule_photo'
     and n.reference_id = p_schedule_id
     and n.actor_id = v_actor
     and n.is_read = false
     and n.created_at > v_since;

  if found then return; end if;

  insert into public.notifications (user_id, actor_id, type, message, reference_id, payload)
  select m, v_actor, 'schedule_photo', v_msg, p_schedule_id,
         jsonb_build_object(
           'tripId', v_trip_id,
           'tripTitle', coalesce(v_title, ''),
           'scheduleId', p_schedule_id,
           'count', v_total
         )
    from public.trip_member_ids(v_trip_id) m
   where m <> v_actor;   -- 내가 올린 걸 나에게 보내지 않는다
exception when others then
  -- ⚠️ 알림이 실패해도 사진은 이미 올라가 있다. 여기서 막으면 안 된다.
  raise warning 'notify_schedule_photos 실패: %', sqlerrm;
end $$;

revoke all on function public.notify_schedule_photos(uuid, integer) from public, anon;
grant execute on function public.notify_schedule_photos(uuid, integer) to authenticated;
