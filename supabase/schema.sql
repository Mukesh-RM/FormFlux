-- FormFlux · full schema (fresh install)
-- Existing installs: run supabase/migrations/002_dashboard.sql instead.

create table profiles (
  id uuid references auth.users primary key,
  email text not null,
  plan text default 'free',
  created_at timestamptz default now()
);

create table forms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id),
  name text,
  target_email text,
  is_verified boolean default false,
  verification_token text,
  redirect_url text,
  default_subject text,
  default_cc text,
  webhook_urls text[],
  slack_webhook_url text,
  discord_webhook_url text,
  captcha_enabled boolean default false,
  blacklist_phrases text[] default '{}',
  autoreply_enabled boolean default false,
  autoreply_template text,
  validation_rules jsonb,
  retention_days int default 90,
  rate_limit_per_hour int default 100,
  created_at timestamptz default now()
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id) on delete cascade,
  data jsonb not null,
  files text[],
  ip_address text,
  is_spam boolean default false,
  delivered boolean default false,
  meta jsonb default '{}'::jsonb,
  -- Flattened payload so the dashboard can run one ILIKE across every field.
  search_text text generated always as (data::text) stored,
  created_at timestamptz default now()
);

create table webhook_logs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade,
  form_id uuid references forms(id) on delete cascade,
  destination text,
  status_code int,
  attempt int,
  response_snippet text,
  source text default 'form',
  created_at timestamptz default now()
);

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create index submissions_form_created_idx on submissions (form_id, created_at desc);
create index submissions_search_idx on submissions using gin (search_text extensions.gin_trgm_ops);
create index submissions_spam_idx on submissions (form_id, is_spam);
create index webhook_logs_submission_idx on webhook_logs (submission_id);
create index webhook_logs_form_idx on webhook_logs (form_id, created_at desc);
create index forms_owner_idx on forms (owner_id);

alter table profiles enable row level security;
alter table forms enable row level security;
alter table submissions enable row level security;
alter table webhook_logs enable row level security;

create policy "Users see own profile" on profiles for select using ((select auth.uid()) = id);
create policy "Users insert own profile" on profiles
  for insert with check ((select auth.uid()) = id and coalesce(plan, 'free') = 'free');
create policy "Users update own profile" on profiles for update using ((select auth.uid()) = id);

create policy "Users manage own forms" on forms for all using ((select auth.uid()) = owner_id);

create policy "Users see own submissions" on submissions for select using (
  form_id in (select id from forms where owner_id = (select auth.uid()))
);
create policy "Users update own submissions" on submissions for update using (
  form_id in (select id from forms where owner_id = (select auth.uid()))
);
create policy "Users delete own submissions" on submissions for delete using (
  form_id in (select id from forms where owner_id = (select auth.uid()))
);

create policy "Users see own webhook logs" on webhook_logs for select using (
  form_id in (select id from forms where owner_id = (select auth.uid()))
  or submission_id in (
    select submissions.id
    from submissions
    join forms on forms.id = submissions.form_id
    where forms.owner_id = (select auth.uid())
  )
);

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Not callable via the API; it only runs from the trigger above.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Users cannot change their own plan (only email is self-editable), and the
-- per-plan form limit is enforced in the database (free = 1, pro = unlimited).
-- (1a) Column-level: signed-in and anonymous roles cannot write profiles.plan.
--      Table-level UPDATE is replaced by UPDATE on the remaining editable column.
revoke update on public.profiles from anon, authenticated;
grant update (email) on public.profiles to authenticated;

-- (1b) Self-insert is only allowed as a free profile (the signup trigger and the
--      dashboard's insert-if-missing guard both create free rows).

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

create trigger forms_enforce_limit
  before insert on public.forms
  for each row execute function public.enforce_form_limit();
