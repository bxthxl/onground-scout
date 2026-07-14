-- Run this in Supabase SQL editor.
-- Change both values to exactly what you are typing into the admin login form.

create extension if not exists pgcrypto;

with input as (
  select
    lower(trim('ongroundscout@gmail.com')) as email,
    'ChangeMe123!'::text as attempted_password
),
auth_match as (
  select
    u.id,
    u.email,
    u.encrypted_password,
    u.email_confirmed_at,
    u.aud,
    u.role,
    u.banned_until
  from auth.users u
  join input i on lower(trim(u.email)) = i.email
)
select
  i.email as attempted_email,
  a.id as auth_user_id,
  a.email is not null as exists_in_auth_users,
  a.email_confirmed_at is not null as email_confirmed,
  a.encrypted_password is not null as has_password_hash,
  case
    when a.encrypted_password is null then false
    else a.encrypted_password = crypt(i.attempted_password, a.encrypted_password)
  end as password_matches,
  a.aud,
  a.role,
  a.banned_until is null as not_banned,
  exists (
    select 1
    from auth.identities ident
    where ident.user_id = a.id
      and ident.provider = 'email'
  ) as has_email_identity,
  au.user_id is not null as exists_in_admin_users,
  au.must_change_password
from input i
left join auth_match a on true
left join public.admin_users au on au.user_id = a.id;
