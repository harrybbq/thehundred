-- Selfies: public-read bucket (they're shown on the TV anyway), random file names,
-- authenticated users may only upload into their own folder (<user id>/...).
-- No SELECT policy → nobody can list the bucket through the API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('selfies', 'selfies', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "selfies: upload own folder" on storage.objects;
create policy "selfies: upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'selfies' and (storage.foldername(name))[1] = (select auth.uid())::text);
