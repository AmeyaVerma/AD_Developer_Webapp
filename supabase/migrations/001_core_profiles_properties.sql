-- Core: logins (profiles), properties, helper functions and row-level security.
-- Run the files in this folder in order (001, 002, ...) in the Supabase SQL editor on a new project.
-- Also: Authentication -> Sign In / Providers: turn OFF "Allow new users to sign up" (Admin creates accounts).

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  role        text not null check (role in ('admin', 'agent')),
  agent_code  text check (agent_code in ('A', 'B', 'J', 'P')),
  created_at  timestamptz not null default now(),
  constraint agent_has_code check ((role = 'agent') = (agent_code is not null)),
  constraint one_login_per_agent unique (agent_code)
);

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.my_agent() returns text
  language sql stable security definer set search_path = public as
  $$ select agent_code from public.profiles where id = auth.uid() $$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.my_agent() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_agent() to authenticated;

alter table public.profiles enable row level security;
create policy "profiles: read own or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create table if not exists public.properties (
  id          text primary key,
  agent_code  text check (agent_code in ('A', 'B', 'J', 'P')),
  approval    text not null default 'approved' check (approval in ('pending', 'approved')),
  data        jsonb not null,
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now()
);
create index if not exists properties_agent_idx on public.properties (agent_code);
alter table public.properties enable row level security;
create policy "properties: agent reads own" on public.properties for select to authenticated
  using (agent_code = public.my_agent());

insert into storage.buckets (id, name, public) values ('originals', 'originals', false) on conflict (id) do nothing;

-- Create the first Admin: add the user in Authentication -> Users (tick "Auto confirm"), then run:
-- insert into public.profiles (id, email, role, agent_code)
-- select id, email, 'admin', null from auth.users where email = 'you@yourcompany.com';
