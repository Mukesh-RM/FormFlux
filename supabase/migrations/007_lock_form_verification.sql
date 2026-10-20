-- FormFlux · Applied 2026-10-20.
-- Signed-in users must not be able to mark a form verified for an address they
-- don't own (that skips inbox confirmation and turns noreply@ into a relay).
-- For API callers (anon / authenticated JWTs):
--   * is_verified = true is only kept when target_email equals the caller's own
--     auth email (case-insensitive); otherwise it is forced to false.
--   * On UPDATE, changing target_email always resets is_verified to false
--     (re-verify via the emailed link, or the dashboard's own-address button).
-- Service-role (worker /email/ verify flow), postgres and SQL-editor writes are untouched.
-- Single transaction. Safe to re-run.

begin;

create or replace function public.enforce_form_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := coalesce(auth.role(), '');
  caller_email text;
begin
  if caller_role not in ('anon', 'authenticated') then
    return new; -- service_role / internal
  end if;

  if tg_op = 'UPDATE'
     and new.target_email is distinct from old.target_email then
    -- Address changed: prior verification no longer applies.
    new.is_verified := false;
    return new;
  end if;

  if coalesce(new.is_verified, false)
     and (tg_op = 'INSERT' or not coalesce(old.is_verified, false)) then
    select email into caller_email from auth.users where id = auth.uid();
    if caller_email is null
       or new.target_email is null
       or lower(new.target_email) <> lower(caller_email) then
      new.is_verified := false;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_form_verification() from public, anon, authenticated;

drop trigger if exists forms_enforce_verification on public.forms;
create trigger forms_enforce_verification
  before insert or update on public.forms
  for each row execute function public.enforce_form_verification();

commit;
