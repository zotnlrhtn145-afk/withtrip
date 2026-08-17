-- 중복이면 **오류 대신 조용히 건너뛴다.**
--
-- ⚠️ 유니크만 걸어 놨더니, 아직 옛 코드가 깔린 폰에서
--    `duplicate key value violates unique constraint "saved_places_no_dup"` 가
--    사용자에게 그대로 떴다. 앱을 고쳐도 **빌드가 나가기 전까지는 계속 뜬다** —
--    DB 를 조인 쪽에서 막는 게 맞다.
--
-- ⚠️ dedupe_key 는 생성 컬럼이라 BEFORE 트리거 시점엔 아직 채워지지 않는다.
--    그래서 같은 식을 여기서 다시 계산한다. (한 곳이 바뀌면 다른 곳도 바꿔야 한다)
--
-- ⚠️ RETURN NULL 이면 그 행만 조용히 안 들어간다. 여러 곳을 한 번에 넣을 때
--    나머지는 정상으로 들어간다 — 인스타 공유가 딱 그 경우다.
create or replace function public.saved_places_skip_dup()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  if exists (
    select 1
      from public.saved_places s
     where s.user_id = new.user_id
       and s.dedupe_key =
             lower(btrim(coalesce(new.place_name, ''))) || '|' ||
             lower(btrim(coalesce(new.address, ''))) || '|' ||
             coalesce(new.trip_id::text, '')
  ) then
    return null;  -- 이미 있다 — 오류가 아니라 "그냥 안 넣음"이다
  end if;

  return new;
end
$$;

drop trigger if exists saved_places_skip_dup_trg on public.saved_places;
create trigger saved_places_skip_dup_trg
  before insert on public.saved_places
  for each row
  execute function public.saved_places_skip_dup();

-- 유니크는 그대로 둔다 — 두 요청이 같은 순간에 들어오면 트리거만으론 못 막는다.
