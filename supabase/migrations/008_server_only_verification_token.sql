-- FormFlux · Applied 2026-10-20 (owner-approved security hardening).
-- Verification tokens become server-only.
--   * Tokens live in public.form_verification_tokens: RLS on, no policies, no
--     grants to anon/authenticated, so only the service role (worker) can read
--     or write them. Owners can no longer read a token via `select *` on forms
--     and click /verify themselves.
--   * forms.verification_token is kept for compatibility but is always null for
--     API callers: the trigger ignores any value they send on INSERT/UPDATE.
--   * Existing tokens are moved into the private table so pending links still work.
-- Single transaction. Safe to re-run.

begin;

create table if not exists public.form_verification_tokens (
  form_id uuid primary key references public.forms(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

alter table public.form_verification_tokens enable row level security;
revoke all on public.form_verification_tokens from public, anon, authenticated;

insert into public.form_verification_tokens (form_id, token)
select id, verification_token from public.forms
where verification_token is not null
on conflict do nothing;

update public.forms set verification_token = null where verification_token is not null;

create or replace function public.enforce_server_only_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new; -- service_role / internal
  end if;
  if tg_op = 'INSERT' then
    new.verification_token := null;
  else
    new.verification_token := old.verification_token;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_server_only_token() from public, anon, authenticated;

drop trigger if exists forms_server_only_token on public.forms;
create trigger forms_server_only_token
  before insert or update on public.forms
  for each row execute function public.enforce_server_only_token();

commit;
