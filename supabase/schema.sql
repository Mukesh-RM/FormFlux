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

create extension if not exists pg_trgm;

create index submissions_form_created_idx on submissions (form_id, created_at desc);
create index submissions_search_idx on submissions using gin (search_text gin_trgm_ops);
create index submissions_spam_idx on submissions (form_id, is_spam);
create index webhook_logs_submission_idx on webhook_logs (submission_id);
create index webhook_logs_form_idx on webhook_logs (form_id, created_at desc);
create index forms_owner_idx on forms (owner_id);

alter table profiles enable row level security;
alter table forms enable row level security;
alter table submissions enable row level security;
alter table webhook_logs enable row level security;

create policy "Users see own profile" on profiles for select using (auth.uid() = id);
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

create policy "Users manage own forms" on forms for all using (auth.uid() = owner_id);

create policy "Users see own submissions" on submissions for select using (
  form_id in (select id from forms where owner_id = auth.uid())
);
create policy "Users update own submissions" on submissions for update using (
  form_id in (select id from forms where owner_id = auth.uid())
);
create policy "Users delete own submissions" on submissions for delete using (
  form_id in (select id from forms where owner_id = auth.uid())
);

create policy "Users see own webhook logs" on webhook_logs for select using (
  form_id in (select id from forms where owner_id = auth.uid())
  or submission_id in (
    select submissions.id
    from submissions
    join forms on forms.id = submissions.form_id
    where forms.owner_id = auth.uid()
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
