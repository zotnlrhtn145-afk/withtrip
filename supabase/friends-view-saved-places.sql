-- WITHTRIP: 친구가 서로의 저장 장소(맛집)를 볼 수 있게 하는 RLS 정책.
-- 친구 프로필 → "맛집 저장 보기" 기능용. 수락된(accepted) 친구끼리만.
-- Supabase Dashboard → SQL Editor 또는 supabase-deploy 로 실행.

drop policy if exists "saved_places_select_friend" on public.saved_places;
create policy "saved_places_select_friend" on public.saved_places
  for select to authenticated
  using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ( (f.user_id = auth.uid()   and f.friend_id = saved_places.user_id)
           or (f.friend_id = auth.uid() and f.user_id   = saved_places.user_id) )
    )
  );
