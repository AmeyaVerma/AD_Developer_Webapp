-- 7/12 files no longer need a digital signature. A plain upload gets status 'uploaded'.
alter table public.verifications drop constraint verifications_status_check;
alter table public.verifications add constraint verifications_status_check
  check (status in ('uploaded', 'authentic', 'untrusted', 'modified', 'invalid', 'unsigned', 'admin_verified'));

drop policy "properties: admin insert verified" on public.properties;
drop policy "properties: agent submits verified pending" on public.properties;
create policy "properties: admin insert with document" on public.properties for insert to authenticated
  with check (public.is_admin() and verification_id is not null and exists (
    select 1 from public.verifications v where v.id = verification_id and v.status in ('uploaded', 'authentic', 'admin_verified')));
create policy "properties: agent submits pending with own document" on public.properties for insert to authenticated
  with check (agent_code = public.my_agent() and approval = 'pending' and created_by = auth.uid() and verification_id is not null and exists (
    select 1 from public.verifications v where v.id = verification_id and v.status in ('uploaded', 'authentic') and v.uploaded_by = auth.uid()));
