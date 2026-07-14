-- Run this after creating the admin in Supabase Authentication > Users.
-- It links that real Supabase Auth user to the admin portal.

do $$
declare
  admin_email text := 'ongroundscout@gmail.com';
  admin_id uuid;
begin
  admin_email := lower(trim(admin_email));

  select id
  into admin_id
  from auth.users
  where lower(trim(email)) = admin_email
  order by created_at desc
  limit 1;

  if admin_id is null then
    raise exception 'No Supabase Auth user exists for %. Create it in Authentication > Users first.', admin_email;
  end if;

  insert into public.admin_users (user_id, email, must_change_password)
  values (admin_id, admin_email, false)
  on conflict (user_id)
  do update set
    email = excluded.email,
    must_change_password = false;

  delete from public.admin_users
  where lower(trim(email)) = admin_email
    and user_id <> admin_id;

  raise notice 'Admin linked: %, user_id: %', admin_email, admin_id;
end $$;

select
  au.email,
  au.user_id,
  au.must_change_password,
  u.email_confirmed_at is not null as email_confirmed
from public.admin_users au
join auth.users u on u.id = au.user_id
where lower(trim(au.email)) = lower('ongroundscout@gmail.com');
