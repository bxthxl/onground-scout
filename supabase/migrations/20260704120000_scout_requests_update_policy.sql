-- Allow the signed-in owner (any authenticated user) to update request status
-- from the admin page (#admin). Run this in the Supabase SQL editor or via
-- `supabase db push` before using the approve/decline buttons.

create policy "Authenticated owner can update scout requests"
  on public.scout_requests
  for update
  to authenticated
  using (true)
  with check (true);
