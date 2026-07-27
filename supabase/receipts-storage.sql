-- Public receipts bucket for expense images
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do update set public = true;

-- Authenticated users can upload to receipts/
create policy "Authenticated users can upload receipts"
on storage.objects for insert
to authenticated
with check (bucket_id = 'receipts');

-- Public read for receipt images
create policy "Public can read receipts"
on storage.objects for select
to public
using (bucket_id = 'receipts');

-- Owners can update/delete their own uploads (path: tripId/userId/...)
create policy "Users can update own receipts"
on storage.objects for update
to authenticated
using (bucket_id = 'receipts' and (storage.foldername(name))[2] = auth.uid()::text);

create policy "Users can delete own receipts"
on storage.objects for delete
to authenticated
using (bucket_id = 'receipts' and (storage.foldername(name))[2] = auth.uid()::text);
