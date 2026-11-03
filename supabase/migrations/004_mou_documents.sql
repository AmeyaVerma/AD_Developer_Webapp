-- One current MOU document per property. Admin uploads; the property's own agent can read it.

create table public.mou_documents (
  property_id text primary key,
  file_path   text not null,
  file_name   text not null,
  mou_date    date,
  note        text,
  uploaded_by uuid not null default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now()
);
alter table public.mou_documents enable row level security;
create policy "mou: admin all" on public.mou_documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin() and uploaded_by = auth.uid());
create policy "mou: agent reads own" on public.mou_documents for select to authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.agent_code = public.my_agent()));

insert into storage.buckets (id, name, public, file_size_limit) values ('mou', 'mou', false, 8388608) on conflict (id) do nothing;
create policy "mou files: admin all" on storage.objects for all to authenticated
  using (bucket_id = 'mou' and public.is_admin()) with check (bucket_id = 'mou' and public.is_admin());
create policy "mou files: agent reads own" on storage.objects for select to authenticated
  using (bucket_id = 'mou' and exists (
    select 1 from public.properties p where p.id = split_part(storage.objects.name, '/', 1) and p.agent_code = public.my_agent()));
