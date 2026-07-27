-- Paris trip demo seed (run in Supabase SQL editor after profiles exist)
-- Trip ID: 77777777-7777-7777-7777-777777777777
--
-- Before running:
-- 1) Replace the four member UUIDs below with real auth.users / profiles.id values
--    for 김철수, 이미영, 임석희, 정석현 (or create those profiles first).
-- 2) Ensure expenses.payer_id references those same user ids.

-- Optional: allow members (not only owners) to read trips they joined
drop policy if exists "trips_select_member" on public.trips;
create policy "trips_select_member"
  on public.trips
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.trip_members tm
      where tm.trip_id = trips.id
        and tm.user_id = auth.uid()
    )
  );

insert into public.trips (
  id,
  title,
  location,
  start_date,
  end_date,
  cover_image,
  members,
  user_id
)
values (
  '77777777-7777-7777-7777-777777777777',
  '파리 여행',
  '파리 · 프랑스',
  current_date + 14,
  current_date + 20,
  'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=85',
  '[]'::jsonb,
  auth.uid() -- owner = currently logged-in user when run in SQL editor as that user
)
on conflict (id) do update
set
  title = excluded.title,
  location = excluded.location,
  cover_image = coalesce(excluded.cover_image, public.trips.cover_image);

-- >>> REPLACE THESE UUIDS with real profile ids <<<
-- 김철수
-- 이미영
-- 임석희
-- 정석현
-- Example placeholders (must exist in auth.users + profiles):
-- 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
-- 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
-- 'cccccccc-cccc-cccc-cccc-cccccccccccc'
-- 'dddddddd-dddd-dddd-dddd-dddddddddddd'

-- insert into public.trip_members (trip_id, user_id, name)
-- values
--   ('77777777-7777-7777-7777-777777777777', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '김철수'),
--   ('77777777-7777-7777-7777-777777777777', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '이미영'),
--   ('77777777-7777-7777-7777-777777777777', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '임석희'),
--   ('77777777-7777-7777-7777-777777777777', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '정석현')
-- on conflict (trip_id, user_id) do update set name = excluded.name;

-- Sample expenses totaling 1,000,000원 (4건) — uncomment after member UUIDs are set
-- insert into public.expenses (trip_id, title, amount, category, payer_id, expense_date)
-- values
--   ('77777777-7777-7777-7777-777777777777', '호텔 숙박', 400000, '숙소', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_date),
--   ('77777777-7777-7777-7777-777777777777', '디너', 250000, '식사', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', current_date),
--   ('77777777-7777-7777-7777-777777777777', '공항 이동', 150000, '교통', 'cccccccc-cccc-cccc-cccc-cccccccccccc', current_date),
--   ('77777777-7777-7777-7777-777777777777', '기념품', 200000, '기타', 'dddddddd-dddd-dddd-dddd-dddddddddddd', current_date);
