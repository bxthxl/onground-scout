-- Create or repair the Supabase Auth login for the admin portal.
--
-- Run this in the Supabase SQL editor.
-- Change admin_email and default_password before running.
--
-- Why this exists:
-- public.admin_users only grants portal access after login.
-- Supabase login itself requires a matching row in auth.users plus an email
-- identity in auth.identities.

create extension if not exists pgcrypto;

do $$
declare
  admin_email text := 'ongroundscout@gmail.com';
  default_password text := 'ChangeMe123!';
  admin_id uuid;
begin
  admin_email := lower(trim(admin_email));

  -- Prefer an existing Auth user with this email.
  select id
  into admin_id
  from auth.users
  where email = admin_email
  limit 1;

  -- If the Auth user does not exist, reuse the id already in admin_users when present.
  if admin_id is null then
    select user_id
    into admin_id
    from public.admin_users
    where email = admin_email
    limit 1;
  end if;

  if admin_id is null then
    admin_id := gen_random_uuid();
  end if;

  -- Create or reset the Auth user.
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    admin_id,
    'authenticated',
    'authenticated',
    admin_email,
    crypt(default_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    '',
    '',
    '',
    ''
  )
  on conflict (id)
  do update set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
    updated_at = now(),
    raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb;

  -- Remove stale/manual email identity rows for this admin. A malformed identity
  -- can make Supabase Auth return a blank 500 response during sign-in.
  delete from auth.identities
  where provider = 'email'
    and (
      user_id = admin_id
      or provider_id = admin_email
      or provider_id = admin_id::text
      or identity_data ->> 'email' = admin_email
      or identity_data ->> 'sub' = admin_id::text
    );

  -- Ensure the email identity exists. Some manual Auth inserts fail because this
  -- identity row is missing or has the wrong provider_id/sub shape.
  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    admin_id,
    admin_id::text,
    jsonb_build_object('sub', admin_id::text, 'email', admin_email, 'email_verified', true, 'phone_verified', false),
    'email',
    now(),
    now(),
    now()
  );

  -- Ensure portal authorization points to the same Auth user.
  insert into public.admin_users (user_id, email, must_change_password)
  values (admin_id, admin_email, false)
  on conflict (user_id)
  do update set
    email = excluded.email,
    must_change_password = false;

  -- If a manually-created admin_users row used a different user_id for this
  -- email, normalize it to the Auth user id.
  update public.admin_users
  set user_id = admin_id,
      must_change_password = false
  where email = admin_email
    and user_id <> admin_id;

  raise notice 'Admin Auth user ready: %, id: %', admin_email, admin_id;
end $$;

-- Verify the result. All booleans below should be true.
with target as (
  select lower('ongroundscout@gmail.com') as email
)
select
  au.email as admin_email,
  au.user_id as admin_user_id,
  au.must_change_password,
  u.id is not null as exists_in_auth_users,
  u.email_confirmed_at is not null as email_confirmed,
  u.encrypted_password is not null as has_password,
  exists (
    select 1
    from auth.identities i
    where i.user_id = au.user_id
      and i.provider = 'email'
  ) as has_email_identity
from public.admin_users au
join target t on au.email = t.email
left join auth.users u on u.id = au.user_id;
