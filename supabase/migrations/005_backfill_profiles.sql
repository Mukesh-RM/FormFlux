-- FormFlux · backfill profiles for users created before the signup trigger.
-- Without a profiles row, creating a form fails with forms_owner_id_fkey.
-- Insert-only and idempotent: existing rows (and their plan) are never changed.
insert into public.profiles (id, email, plan)
select u.id, coalesce(u.email, ''), 'free'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
