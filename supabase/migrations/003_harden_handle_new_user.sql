-- FormFlux · harden signup trigger function (Supabase advisors 0028/0029).
-- handle_new_user() only needs to run from the auth.users trigger, so it should not
-- be callable through /rest/v1/rpc. The trigger keeps working. Safe to re-run.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
