-- FormFlux · Phase 4/5 migration
-- Adds dashboard-editable defaults, submission metadata, and richer webhook logs.
-- Safe to re-run.

alter table forms add column if not exists default_subject text;
alter table forms add column if not exists default_cc text;
alter table forms add column if not exists blacklist_phrases text[] default '{}';

-- Per-submission audit trail: which special fields were used, captcha outcome,
-- spam reasons, and the effective redirect target.
alter table submissions add column if not exists meta jsonb default '{}'::jsonb;

-- Flattened payload so the dashboard can run one ILIKE across every field.
alter table submissions add column if not exists search_text text
  generated always as (data::text) stored;

create extension if not exists pg_trgm;
create index if not exists submissions_search_idx
  on submissions using gin (search_text gin_trgm_ops);

alter table webhook_logs add column if not exists response_snippet text;
alter table webhook_logs add column if not exists source text default 'form';
-- form_id lets test deliveries (which have no submission) show in the log and be
-- covered by RLS.
alter table webhook_logs add column if not exists form_id uuid references forms(id) on delete cascade;

create index if not exists webhook_logs_form_idx on webhook_logs (form_id, created_at desc);

drop policy if exists "Users see own webhook logs" on webhook_logs;
create policy "Users see own webhook logs" on webhook_logs for select using (
  form_id in (select id from forms where owner_id = auth.uid())
  or submission_id in (
    select submissions.id
    from submissions
    join forms on forms.id = submissions.form_id
    where forms.owner_id = auth.uid()
  )
);

create index if not exists submissions_form_created_idx
  on submissions (form_id, created_at desc);
create index if not exists submissions_spam_idx on submissions (form_id, is_spam);
create index if not exists webhook_logs_submission_idx on webhook_logs (submission_id);
create index if not exists forms_owner_idx on forms (owner_id);

-- Owners may correct false positives and clear their own data from the dashboard.
drop policy if exists "Users update own submissions" on submissions;
create policy "Users update own submissions" on submissions for update using (
  form_id in (select id from forms where owner_id = auth.uid())
);

drop policy if exists "Users delete own submissions" on submissions;
create policy "Users delete own submissions" on submissions for delete using (
  form_id in (select id from forms where owner_id = auth.uid())
);

drop policy if exists "Users insert own profile" on profiles;
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);

drop policy if exists "Users update own profile" on profiles;
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- Every new auth user gets a free profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, plan)
  values (new.id, new.email, 'free')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
