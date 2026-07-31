-- Public trip-covers bucket for AI-generated trip cover images
insert into storage.buckets (id, name, public)
values ('trip-covers', 'trip-covers', true)
on conflict (id) do update set public = true;

-- Authenticated users can upload to trip-covers/
create policy "Authenticated users can upload trip covers"
on storage.objects for insert
to authenticated
with check (bucket_id = 'trip-covers');

-- Public read for trip cover images
create policy "Public can read trip covers"
on storage.objects for select
to public
using (bucket_id = 'trip-covers');

-- Owners can update/delete their own uploads (path: userId/...)
create policy "Users can update own trip covers"
on storage.objects for update
to authenticated
using (bucket_id = 'trip-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own trip covers"
on storage.objects for delete
to authenticated
using (bucket_id = 'trip-covers' and (storage.foldername(name))[1] = auth.uid()::text);
