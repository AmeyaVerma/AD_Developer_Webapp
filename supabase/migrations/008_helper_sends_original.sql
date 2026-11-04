-- The person who uploaded a 7/12 can send the government's record for THAT document only (files named helper-*),
-- which is how the browser helper returns the Mahabhulekh record. Everything else stays Admin-only.
create policy "govt originals files: uploader sends helper record" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'govt-originals'
    and split_part(storage.objects.name, '/', 2) like 'helper-%'
    and exists (select 1 from public.verifications v where v.id::text = split_part(storage.objects.name, '/', 1) and v.uploaded_by = auth.uid())
  );
