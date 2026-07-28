-- WITHTRIP: trip_clips (인스타 스타일 여행 클립)
-- Supabase Dashboard → SQL Editor에서 실행하세요.

create table if not exists public.trip_clips (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  media_url text not null,
  caption text not null default '',
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  created_at timestamptz not null default now()
);

create index if not exists trip_clips_user_id_idx on public.trip_clips (user_id);
create index if not exists trip_clips_trip_id_idx on public.trip_clips (trip_id);
create index if not exists trip_clips_created_at_idx on public.trip_clips (created_at desc);

alter table public.trip_clips enable row level security;

drop policy if exists "trip_clips_select_own" on public.trip_clips;
drop policy if exists "trip_clips_insert_own" on public.trip_clips;
drop policy if exists "trip_clips_delete_own" on public.trip_clips;

create policy "trip_clips_select_own"
  on public.trip_clips for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trips t
      where t.id = trip_clips.trip_id
        and (
          t.user_id = auth.uid()
          or exists (
            select 1 from public.trip_members tm
            where tm.trip_id = t.id
              and tm.user_id = auth.uid()
              and coalesce(tm.status, 'accepted') = 'accepted'
          )
        )
    )
  );

create policy "trip_clips_insert_own"
  on public.trip_clips for insert to authenticated
  with check (user_id = auth.uid());

create policy "trip_clips_delete_own"
  on public.trip_clips for delete to authenticated
  using (user_id = auth.uid());

-- Storage bucket for clip media
insert into storage.buckets (id, name, public)
values ('trip-clips', 'trip-clips', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users can upload trip clips" on storage.objects;
drop policy if exists "Public can read trip clips" on storage.objects;
drop policy if exists "Users can update own trip clips" on storage.objects;
drop policy if exists "Users can delete own trip clips" on storage.objects;

create policy "Authenticated users can upload trip clips"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-clips');

create policy "Public can read trip clips"
  on storage.objects for select to public
  using (bucket_id = 'trip-clips');

create policy "Users can update own trip clips"
  on storage.objects for update to authenticated
  using (bucket_id = 'trip-clips' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own trip clips"
  on storage.objects for delete to authenticated
  using (bucket_id = 'trip-clips' and (storage.foldername(name))[1] = auth.uid()::text);
