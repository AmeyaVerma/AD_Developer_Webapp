-- The government's own copy of a satbara (from Mahabhulekh), attached by staff next to the uploaded document.
create table public.govt_originals (
  verification_id uuid primary key references public.verifications (id) on delete cascade,
  file_path       text not null,
  file_name       text not null,
  note            text,
  uploaded_by     uuid not null default auth.uid() references auth.users (id),
  created_at      timestamptz not null default now()
);
alter table public.govt_originals enable row level security;
create policy "govt_originals: admin all" on public.govt_originals for all to authenticated
  using (public.is_admin()) with check (public.is_admin() and uploaded_by = auth.uid());
create policy "govt_originals: uploader reads" on public.govt_originals for select to authenticated
  using (exists (select 1 from public.verifications v where v.id = verification_id and v.uploaded_by = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit) values ('govt-originals', 'govt-originals', false, 8388608) on conflict (id) do nothing;
create policy "govt originals files: admin all" on storage.objects for all to authenticated
  using (bucket_id = 'govt-originals' and public.is_admin()) with check (bucket_id = 'govt-originals' and public.is_admin());
create policy "govt originals files: uploader reads" on storage.objects for select to authenticated
  using (bucket_id = 'govt-originals' and exists (
    select 1 from public.verifications v where v.id::text = split_part(storage.objects.name, '/', 1) and v.uploaded_by = auth.uid()));
