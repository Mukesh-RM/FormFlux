-- FormFlux · RLS performance + extension placement (Supabase advisors 0003, 0014).
-- 1) Recreate the 8 RLS policies with (select auth.uid()) so it is evaluated once per
--    query instead of per row. Commands, roles (public) and logic are unchanged.
-- 2) Move pg_trgm out of `public` into `extensions` and rebuild the trigram index.
-- Runs in a single transaction. Safe to re-run.

begin;

create schema if not exists extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;

create extension if not exists pg_trgm with schema extensions;
do $$
begin
  if exists (
    select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm' and n.nspname <> 'extensions'
  ) then
    alter extension pg_trgm set schema extensions;
  end if;
end $$;

drop index if exists public.submissions_search_idx;
create index submissions_search_idx
  on public.submissions using gin (search_text extensions.gin_trgm_ops);

-- profiles
drop policy if exists "Users see own profile" on public.profiles;
create policy "Users see own profile" on public.profiles
  for select using ((select auth.uid()) = id);
drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles
  for insert with check ((select auth.uid()) = id);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update using ((select auth.uid()) = id);

-- forms
drop policy if exists "Users manage own forms" on public.forms;
create policy "Users manage own forms" on public.forms
  for all using ((select auth.uid()) = owner_id);

-- submissions
drop policy if exists "Users see own submissions" on public.submissions;
create policy "Users see own submissions" on public.submissions for select using (
  form_id in (select id from public.forms where owner_id = (select auth.uid()))
);
drop policy if exists "Users update own submissions" on public.submissions;
create policy "Users update own submissions" on public.submissions for update using (
  form_id in (select id from public.forms where owner_id = (select auth.uid()))
);
drop policy if exists "Users delete own submissions" on public.submissions;
create policy "Users delete own submissions" on public.submissions for delete using (
  form_id in (select id from public.forms where owner_id = (select auth.uid()))
);

-- webhook_logs
drop policy if exists "Users see own webhook logs" on public.webhook_logs;
create policy "Users see own webhook logs" on public.webhook_logs for select using (
  form_id in (select id from public.forms where owner_id = (select auth.uid()))
  or submission_id in (
    select submissions.id
    from public.submissions
    join public.forms on forms.id = submissions.form_id
    where forms.owner_id = (select auth.uid())
  )
);

commit;
