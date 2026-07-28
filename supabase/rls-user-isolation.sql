-- WITHTRIP: harden RLS so users only see their own (or member) trip data.
-- Run in Supabase SQL Editor after deploying the app isolation changes.

-- ---------------------------------------------------------------------------
-- trips: remove null-owner select leak
-- ---------------------------------------------------------------------------
drop policy if exists "trips_select_own" on public.trips;
create policy "trips_select_own"
  on public.trips
  for select
  to authenticated
  using (user_id = auth.uid());

-- Optional: delete orphan / demo rows with no owner (uncomment if desired)
-- delete from public.trips where user_id is null;

-- ---------------------------------------------------------------------------
-- Helper predicate: can current user access a trip?
-- ---------------------------------------------------------------------------
-- Used inline in child-table policies below.

-- ---------------------------------------------------------------------------
-- trip_flights
-- ---------------------------------------------------------------------------
drop policy if exists "trip_flights_select_public" on public.trip_flights;
drop policy if exists "trip_flights_insert_public" on public.trip_flights;
drop policy if exists "trip_flights_update_public" on public.trip_flights;
drop policy if exists "trip_flights_delete_public" on public.trip_flights;
drop policy if exists "trip_flights_select_member" on public.trip_flights;
drop policy if exists "trip_flights_insert_member" on public.trip_flights;
drop policy if exists "trip_flights_update_member" on public.trip_flights;
drop policy if exists "trip_flights_delete_member" on public.trip_flights;

create policy "trip_flights_select_member"
  on public.trip_flights for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_flights.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_flights_insert_member"
  on public.trip_flights for insert to authenticated
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_flights.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_flights_update_member"
  on public.trip_flights for update to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_flights.trip_id
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
    exists (
      select 1 from public.trips t
      where t.id = trip_flights.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_flights_delete_member"
  on public.trip_flights for delete to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_flights.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- trip_accommodations
-- ---------------------------------------------------------------------------
drop policy if exists "trip_accommodations_select_public" on public.trip_accommodations;
drop policy if exists "trip_accommodations_insert_public" on public.trip_accommodations;
drop policy if exists "trip_accommodations_update_public" on public.trip_accommodations;
drop policy if exists "trip_accommodations_delete_public" on public.trip_accommodations;
drop policy if exists "trip_accommodations_select_member" on public.trip_accommodations;
drop policy if exists "trip_accommodations_insert_member" on public.trip_accommodations;
drop policy if exists "trip_accommodations_update_member" on public.trip_accommodations;
drop policy if exists "trip_accommodations_delete_member" on public.trip_accommodations;

create policy "trip_accommodations_select_member"
  on public.trip_accommodations for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_accommodations.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_accommodations_insert_member"
  on public.trip_accommodations for insert to authenticated
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_accommodations.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_accommodations_update_member"
  on public.trip_accommodations for update to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_accommodations.trip_id
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
    exists (
      select 1 from public.trips t
      where t.id = trip_accommodations.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_accommodations_delete_member"
  on public.trip_accommodations for delete to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_accommodations.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- trip_schedules
-- ---------------------------------------------------------------------------
drop policy if exists "trip_schedules_select_public" on public.trip_schedules;
drop policy if exists "trip_schedules_insert_public" on public.trip_schedules;
drop policy if exists "trip_schedules_update_public" on public.trip_schedules;
drop policy if exists "trip_schedules_delete_public" on public.trip_schedules;
drop policy if exists "trip_schedules_select_member" on public.trip_schedules;
drop policy if exists "trip_schedules_insert_member" on public.trip_schedules;
drop policy if exists "trip_schedules_update_member" on public.trip_schedules;
drop policy if exists "trip_schedules_delete_member" on public.trip_schedules;

create policy "trip_schedules_select_member"
  on public.trip_schedules for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_schedules.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_schedules_insert_member"
  on public.trip_schedules for insert to authenticated
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_schedules.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_schedules_update_member"
  on public.trip_schedules for update to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_schedules.trip_id
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
    exists (
      select 1 from public.trips t
      where t.id = trip_schedules.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

create policy "trip_schedules_delete_member"
  on public.trip_schedules for delete to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_schedules.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id and tm.user_id = auth.uid()
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- saved_places
-- ---------------------------------------------------------------------------
drop policy if exists "saved_places_select_public" on public.saved_places;
drop policy if exists "saved_places_insert_public" on public.saved_places;
drop policy if exists "saved_places_update_public" on public.saved_places;
drop policy if exists "saved_places_delete_public" on public.saved_places;
drop policy if exists "saved_places_select_member" on public.saved_places;
drop policy if exists "saved_places_insert_member" on public.saved_places;
drop policy if exists "saved_places_update_member" on public.saved_places;
drop policy if exists "saved_places_delete_member" on public.saved_places;

create policy "saved_places_select_member"
  on public.saved_places for select to authenticated
  using (
    exists (
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
    exists (
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
    exists (
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
    exists (
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
    exists (
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

-- ---------------------------------------------------------------------------
-- spots: own rows only (remove public seed visibility)
-- ---------------------------------------------------------------------------
drop policy if exists "spots_select_public" on public.spots;
drop policy if exists "spots_select_own" on public.spots;

create policy "spots_select_own"
  on public.spots for select to authenticated
  using (user_id = auth.uid());

-- Remove ownerless seed rows so new users never see demo spots
delete from public.spots where user_id is null;
