-- WITHTRIP: saved_places.trip_id → nullable (지원: 여행 미지정 "관심 맛집")
-- Supabase Dashboard → SQL Editor에서 실행하세요.

alter table public.saved_places alter column trip_id drop not null;

drop policy if exists "saved_places_select_member" on public.saved_places;
drop policy if exists "saved_places_insert_member" on public.saved_places;
drop policy if exists "saved_places_update_member" on public.saved_places;
drop policy if exists "saved_places_delete_member" on public.saved_places;

create policy "saved_places_select_member"
  on public.saved_places for select to authenticated
  using (
    (trip_id is null and user_id = auth.uid())
    or exists (
      select 1 from public.trips t
      where t.id = saved_places.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "saved_places_insert_member"
  on public.saved_places for insert to authenticated
  with check (
    (trip_id is null and user_id = auth.uid())
    or exists (
      select 1 from public.trips t
      where t.id = saved_places.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "saved_places_update_member"
  on public.saved_places for update to authenticated
  using (
    (trip_id is null and user_id = auth.uid())
    or exists (
      select 1 from public.trips t
      where t.id = saved_places.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  )
  with check (
    (trip_id is null and user_id = auth.uid())
    or exists (
      select 1 from public.trips t
      where t.id = saved_places.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "saved_places_delete_member"
  on public.saved_places for delete to authenticated
  using (
    (trip_id is null and user_id = auth.uid())
    or exists (
      select 1 from public.trips t
      where t.id = saved_places.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );
