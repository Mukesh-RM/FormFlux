-- FormFlux · Applied 2026-10-20 (owner-approved).
-- 1) Users must not be able to change their own plan through the API.
-- 2) The per-plan form limit is enforced in the database, not only in the app.
--    Limits mirror worker/src/lib/plan.ts and dashboard/src/lib/types.ts:
--    free = 1 form (FREE_FORM_LIMIT), pro = unlimited (formLimit: null).
-- Single transaction. Safe to re-run. Service-role writes (billing, admin) are
-- unaffected by the grants/RLS below.

begin;

-- (1a) Column-level: signed-in and anonymous roles cannot write profiles.plan.
--      Table-level UPDATE is replaced by UPDATE on the remaining editable column.
revoke update on public.profiles from anon, authenticated;
grant update (email) on public.profiles to authenticated;

-- (1b) Self-insert is only allowed as a free profile (the signup trigger and the
--      dashboard's insert-if-missing guard both create free rows).
drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles
  for insert with check ((select auth.uid()) = id and coalesce(plan, 'free') = 'free');

-- (2) Form limit per plan, checked before every insert with an owner.
--     Zero-config forms (owner_id is null) are created by the worker and skipped.
create or replace function public.enforce_form_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_plan text;
  form_count int;
begin
  if new.owner_id is null then
    return new;
  end if;

  select coalesce(plan, 'free') into owner_plan from public.profiles where id = new.owner_id;
  if coalesce(owner_plan, 'free') = 'pro' then
    return new; -- Pro: unlimited
  end if;

  -- Serialise concurrent inserts for the same owner so two requests can't both pass.
  perform pg_advisory_xact_lock(hashtext('formflux_form_limit:' || new.owner_id::text));
  select count(*) into form_count from public.forms where owner_id = new.owner_id;
  if form_count >= 1 then
    raise exception 'The free plan includes 1 form. Upgrade to Pro for unlimited forms.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_form_limit() from public, anon, authenticated;

drop trigger if exists forms_enforce_limit on public.forms;
create trigger forms_enforce_limit
  before insert on public.forms
  for each row execute function public.enforce_form_limit();

commit;
