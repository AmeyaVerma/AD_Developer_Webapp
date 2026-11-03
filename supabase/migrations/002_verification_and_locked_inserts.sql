-- Verification records (written only by the verify-712 function), approved signing authorities,
-- and rules that stop a property from being saved without a verified 7/12.

create table public.trusted_roots (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  pem         text not null,
  fingerprint text not null unique,
  created_by  uuid references auth.users (id) default auth.uid(),
  created_at  timestamptz not null default now()
);
alter table public.trusted_roots enable row level security;
create policy "trusted_roots: admin all" on public.trusted_roots for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table public.verifications (
  id              uuid primary key default gen_random_uuid(),
  sha256          text not null,
  status          text not null check (status in ('authentic', 'untrusted', 'modified', 'invalid', 'unsigned', 'admin_verified')),
  reason          text,
  signer          jsonb,
  issuer          jsonb,
  signed_at       timestamptz,
  file_path       text,
  uploaded_by     uuid not null references auth.users (id),
  verification_no text,
  override_by     uuid references auth.users (id),
  override_note   text,
  created_at      timestamptz not null default now()
);
create index verifications_sha_idx on public.verifications (sha256);
alter table public.verifications enable row level security;
create policy "verifications: admin read" on public.verifications for select to authenticated using (public.is_admin());
create policy "verifications: agent reads own" on public.verifications for select to authenticated using (uploaded_by = auth.uid());
create policy "verifications: admin override" on public.verifications for update to authenticated
  using (public.is_admin() and status = 'unsigned')
  with check (public.is_admin() and status = 'admin_verified' and override_by = auth.uid() and verification_no ~ '^[0-9]{16}$' and length(coalesce(override_note, '')) >= 5);

alter table public.properties add column verification_id uuid references public.verifications (id);
create unique index properties_one_per_verification on public.properties (verification_id) where verification_id is not null;

create policy "properties: admin read" on public.properties for select to authenticated using (public.is_admin());
create policy "properties: admin update" on public.properties for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "properties: admin delete" on public.properties for delete to authenticated using (public.is_admin());
create policy "properties: admin insert verified" on public.properties for insert to authenticated
  with check (public.is_admin() and verification_id is not null and exists (
    select 1 from public.verifications v where v.id = verification_id and v.status in ('authentic', 'admin_verified')));
create policy "properties: agent submits verified pending" on public.properties for insert to authenticated
  with check (agent_code = public.my_agent() and approval = 'pending' and created_by = auth.uid() and verification_id is not null and exists (
    select 1 from public.verifications v where v.id = verification_id and v.status = 'authentic' and v.uploaded_by = auth.uid()));

-- Original 7/12 files: only the verify function writes them.
create policy "originals: admin read" on storage.objects for select to authenticated
  using (bucket_id = 'originals' and public.is_admin());
create policy "originals: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'originals' and public.is_admin());
create policy "originals: agent reads own" on storage.objects for select to authenticated
  using (bucket_id = 'originals' and exists (
    select 1 from public.verifications v where v.id::text = split_part(storage.objects.name, '.', 1) and v.uploaded_by = auth.uid()));
