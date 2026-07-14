create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.applicant_profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null default '',
  whatsapp text not null default '',
  latest_destination_city text not null default '',
  latest_package_type text not null default '',
  request_count integer not null default 0,
  first_request_at timestamptz not null default now(),
  last_request_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applicant_profiles_email_key unique (email)
);

alter table public.scout_requests
  add column if not exists applicant_profile_id uuid references public.applicant_profiles(id) on delete set null;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.mark_admin_password_changed()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_users
  set must_change_password = false
  where user_id = auth.uid();
end;
$$;

grant execute on function public.mark_admin_password_changed() to authenticated;

create or replace function public.upsert_applicant_profile_for_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  normalized_email text;
begin
  normalized_email := lower(trim(new.email));

  insert into public.applicant_profiles (
    full_name,
    email,
    phone,
    whatsapp,
    latest_destination_city,
    latest_package_type,
    request_count,
    first_request_at,
    last_request_at
  )
  values (
    new.full_name,
    normalized_email,
    coalesce(new.phone, ''),
    coalesce(new.phone, ''),
    coalesce(new.destination_city, ''),
    coalesce(new.package_type, ''),
    1,
    new.created_at,
    new.created_at
  )
  on conflict (email)
  do update set
    full_name = excluded.full_name,
    phone = case when excluded.phone <> '' then excluded.phone else applicant_profiles.phone end,
    whatsapp = case when excluded.whatsapp <> '' then excluded.whatsapp else applicant_profiles.whatsapp end,
    latest_destination_city = excluded.latest_destination_city,
    latest_package_type = excluded.latest_package_type,
    request_count = applicant_profiles.request_count + 1,
    last_request_at = excluded.last_request_at,
    updated_at = now()
  returning id into profile_id;

  new.applicant_profile_id := profile_id;
  new.email := normalized_email;
  return new;
end;
$$;

drop trigger if exists scout_requests_profile_before_insert on public.scout_requests;

create trigger scout_requests_profile_before_insert
  before insert on public.scout_requests
  for each row
  execute function public.upsert_applicant_profile_for_request();

-- Backfill profiles for existing requests.
insert into public.applicant_profiles (
  full_name,
  email,
  phone,
  whatsapp,
  latest_destination_city,
  latest_package_type,
  request_count,
  first_request_at,
  last_request_at
)
select distinct on (lower(trim(email)))
  full_name,
  lower(trim(email)) as email,
  coalesce(phone, '') as phone,
  coalesce(phone, '') as whatsapp,
  coalesce(destination_city, '') as latest_destination_city,
  coalesce(package_type, '') as latest_package_type,
  count(*) over (partition by lower(trim(email)))::integer as request_count,
  min(created_at) over (partition by lower(trim(email))) as first_request_at,
  max(created_at) over (partition by lower(trim(email))) as last_request_at
from public.scout_requests
where email is not null and trim(email) <> ''
order by lower(trim(email)), created_at desc
on conflict (email)
do update set
  full_name = excluded.full_name,
  phone = excluded.phone,
  whatsapp = excluded.whatsapp,
  latest_destination_city = excluded.latest_destination_city,
  latest_package_type = excluded.latest_package_type,
  request_count = excluded.request_count,
  first_request_at = excluded.first_request_at,
  last_request_at = excluded.last_request_at,
  updated_at = now();

update public.scout_requests sr
set applicant_profile_id = ap.id,
    email = lower(trim(sr.email))
from public.applicant_profiles ap
where lower(trim(sr.email)) = ap.email
  and sr.applicant_profile_id is null;

alter table public.admin_users enable row level security;
alter table public.applicant_profiles enable row level security;

drop policy if exists "Authenticated owner can read scout requests" on public.scout_requests;
drop policy if exists "Authenticated owner can update scout requests" on public.scout_requests;

create policy "Admins can read scout requests"
  on public.scout_requests
  for select
  to authenticated
  using (public.is_admin());

create policy "Admins can update scout requests"
  on public.scout_requests
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can read applicant profiles" on public.applicant_profiles;

create policy "Admins can read applicant profiles"
  on public.applicant_profiles
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can read admin users" on public.admin_users;

create policy "Admins can read their admin user"
  on public.admin_users
  for select
  to authenticated
  using (user_id = auth.uid());

create index if not exists applicant_profiles_last_request_at_idx
  on public.applicant_profiles (last_request_at desc);

create index if not exists scout_requests_applicant_profile_id_idx
  on public.scout_requests (applicant_profile_id);
