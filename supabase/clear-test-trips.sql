-- WITHTRIP: wipe demo / test trip data
-- Run in Supabase Dashboard → SQL Editor (service role / project owner).
-- Cascades depend on your FK setup; child tables are cleared first when present.

begin;

-- Related child rows (ignore if table missing)
do $$ begin
  delete from public.trip_members;
exception when undefined_table then null;
end $$;

do $$ begin
  delete from public.trip_flights;
exception when undefined_table then null;
end $$;

do $$ begin
  delete from public.trip_accommodations;
exception when undefined_table then null;
end $$;

do $$ begin
  delete from public.trip_itineraries;
exception when undefined_table then null;
end $$;

do $$ begin
  delete from public.trip_schedules;
exception when undefined_table then null;
end $$;

do $$ begin
  delete from public.expenses;
exception when undefined_table then null;
end $$;

do $$ begin
  delete from public.settlements;
exception when undefined_table then null;
end $$;

do $$ begin
  delete from public.saved_places;
exception when undefined_table then null;
end $$;

-- All travel cards
delete from public.trips;

commit;
