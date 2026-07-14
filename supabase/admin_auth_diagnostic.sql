-- Run this in Supabase SQL editor to check whether an admin can actually log in.
-- Change the email before running.
with target as (
  select lower('ongroundscout@gmail.com') as email
)
select
  au.email as admin_email,
  au.user_id as admin_user_id,
  au.must_change_password,
  u.id is not null as exists_in_auth_users,
  u.email as auth_email,
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
