-- Outside-source checks, one record per FIELD (own result, source, note, receipt), rejections, and evidence files.

create table public.field_checks (
  id              uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.verifications (id) on delete cascade,
  field           text not null check (field in ('district','taluka','village','villageCode','gat','area','tenure','holders','pending','lastMut','puid','verifyNo','charges','court')),
  source          text not null check (source in ('map', 'ownership', 'portal', 'charges', 'court')),
  result          text not null check (result in ('match', 'mismatch')),
  note            text not null check (length(trim(note)) >= 5),
  evidence_path   text,
  checked_by      uuid not null default auth.uid() references auth.users (id),
  created_at      timestamptz not null default now(),
  constraint field_checks_one_per_field unique (verification_id, field)
);
alter table public.field_checks enable row level security;
create policy "field_checks: admin all" on public.field_checks for all to authenticated
  using (public.is_admin()) with check (public.is_admin() and checked_by = auth.uid());
create policy "field_checks: uploader reads" on public.field_checks for select to authenticated
  using (exists (select 1 from public.verifications v where v.id = verification_id and v.uploaded_by = auth.uid()));

create table public.rejections (
  verification_id uuid primary key references public.verifications (id) on delete cascade,
  sha256          text not null,
  reason          text not null check (length(trim(reason)) >= 5),
  decided_by      uuid not null default auth.uid() references auth.users (id),
  decided_at      timestamptz not null default now()
);
create index rejections_sha_idx on public.rejections (sha256);
alter table public.rejections enable row level security;
create policy "rejections: admin read" on public.rejections for select to authenticated using (public.is_admin());
create policy "rejections: uploader reads" on public.rejections for select to authenticated
  using (exists (select 1 from public.verifications v where v.id = verification_id and v.uploaded_by = auth.uid()));
create policy "rejections: admin insert" on public.rejections for insert to authenticated
  with check (public.is_admin() and decided_by = auth.uid());

insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false) on conflict (id) do nothing;
create policy "evidence: admin all" on storage.objects for all to authenticated
  using (bucket_id = 'evidence' and public.is_admin()) with check (bucket_id = 'evidence' and public.is_admin());
create policy "evidence: uploader reads" on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and exists (
    select 1 from public.verifications v where v.id::text = split_part(storage.objects.name, '/', 1) and v.uploaded_by = auth.uid()));
