-- Each login can carry its owner's own mobile number (10 digits). The fill-in helper uses it for the satbara site.
alter table public.profiles add column phone text check (phone is null or phone ~ '^[0-9]{10}$');

-- Only an Admin may change a profile (role, agent letter, phone). Logins cannot edit their own profile.
create policy "profiles: admin update" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
