create extension if not exists pgcrypto;

create table if not exists public.scout_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  current_country text,
  destination_city text not null,
  property_link text not null,
  package_type text not null,
  move_timeline text,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.scout_requests enable row level security;

create policy "Anyone can create scout requests"
  on public.scout_requests
  for insert
  to anon
  with check (true);

create policy "Authenticated owner can read scout requests"
  on public.scout_requests
  for select
  to authenticated
  using (true);

create index if not exists scout_requests_created_at_idx
  on public.scout_requests (created_at desc);

-- Allow the signed-in owner (any authenticated user) to update request status
-- from the admin page (#admin). Run this in the Supabase SQL editor or via
-- `supabase db push` before using the approve/decline buttons.

create policy "Authenticated owner can update scout requests"
  on public.scout_requests
  for update
  to authenticated
  using (true)
  with check (true);
