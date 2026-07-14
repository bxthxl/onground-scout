-- Use this when admin login returns a blank Supabase Auth error like "{}".
--
-- This removes the broken/manual Auth records for the admin email so you can
-- recreate the user through Supabase Authentication > Users.
--
-- After running this:
-- 1. Go to Supabase Dashboard > Authentication > Users.
-- 2. Click "Add user".
-- 3. Email: ongroundscout@gmail.com
-- 4. Password: choose the password you want to use.
-- 5. Mark the email as confirmed / auto-confirmed if Supabase asks.
-- 6. Run supabase/link_admin_auth_user.sql.

do $$
declare
  admin_email text := 'ongroundscout@gmail.com';
  target_ids uuid[];
begin
  admin_email := lower(trim(admin_email));

  select coalesce(array_agg(id), array[]::uuid[])
  into target_ids
  from auth.users
  where lower(trim(email)) = admin_email;

  delete from public.admin_users
  where lower(trim(email)) = admin_email
     or user_id = any(target_ids);

  delete from auth.identities
  where user_id = any(target_ids)
     or lower(trim(identity_data ->> 'email')) = admin_email
     or provider_id = admin_email;

  delete from auth.users
  where id = any(target_ids)
     or lower(trim(email)) = admin_email;

  raise notice 'Removed broken admin Auth records for %', admin_email;
end $$;
