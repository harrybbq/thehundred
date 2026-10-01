-- Evidence photos go to selfies/ev/<random uuid>.jpg: no uid in the path, so nobody can tell
-- from the URL who filed an exhibit (selfies live in <uid>/..., which would give them away).
-- Insert only. There is deliberately no SELECT, UPDATE or DELETE policy for this folder, so:
--   * no listing (the files are still readable through the bucket's public URL, like selfies),
--   * no overwrite (upsert needs UPDATE; a name clash just fails),
--   * no delete.
-- The name must be exactly ev/<uuid>.jpg, nothing nested. The bucket's own limits still apply
-- (1 MB, jpeg/png/webp). "storage" in the filename: the local PGlite mock skips this file.
drop policy if exists "selfies: upload evidence" on storage.objects;
create policy "selfies: upload evidence" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'selfies'
    and name ~ '^ev/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  );
