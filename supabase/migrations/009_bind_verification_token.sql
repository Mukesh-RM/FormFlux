-- FormFlux · Applied 2026-10-20 (owner-approved security hardening).
-- Verification tokens are bound to the address they were issued for, and any
-- outstanding token is deleted when a form's target_email changes. The worker
-- also deletes a token when /verify uses it (single use). Verification emails
-- are rate-limited per target address, owner and IP via take_verify_slots().
-- Single transaction. Safe to re-run.

begin;

alter table public.form_verification_tokens add column if not exists target_email text;

-- Bind tokens issued before this migration to the form's current address.
update public.form_verification_tokens t
set target_email = lower(f.target_email)
from public.forms f
where f.id = t.form_id and t.target_email is null;

create or replace function public.invalidate_tokens_on_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_email is distinct from old.target_email then
    delete from public.form_verification_tokens where form_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.invalidate_tokens_on_email_change() from public, anon, authenticated;

drop trigger if exists forms_invalidate_tokens on public.forms;
create trigger forms_invalidate_tokens
  after update of target_email on public.forms
  for each row execute function public.invalidate_tokens_on_email_change();

-- Verification-email rate limits (service role only). KV's eventual consistency
-- let bursts through, so the caps are counted atomically in the database.
create table if not exists public.verify_rate_limits (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

alter table public.verify_rate_limits enable row level security;
revoke all on public.verify_rate_limits from public, anon, authenticated;

-- Takes one slot from every key, or none if any key is at its limit (1-hour windows).
create or replace function public.take_verify_slots(p_keys text[], p_limits int[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  i int;
  cur int;
begin
  for i in 1 .. coalesce(array_length(p_keys, 1), 0) loop
    insert into public.verify_rate_limits (key) values (p_keys[i]) on conflict (key) do nothing;
  end loop;
  -- Lock in a stable order so concurrent calls can't deadlock or both pass.
  perform 1 from public.verify_rate_limits where key = any(p_keys) order by key for update;
  update public.verify_rate_limits set count = 0, window_start = now()
  where key = any(p_keys) and window_start < now() - interval '1 hour';
  for i in 1 .. coalesce(array_length(p_keys, 1), 0) loop
    select count into cur from public.verify_rate_limits where key = p_keys[i];
    if cur >= p_limits[i] then
      return false;
    end if;
  end loop;
  update public.verify_rate_limits set count = count + 1 where key = any(p_keys);
  delete from public.verify_rate_limits where window_start < now() - interval '2 hours';
  return true;
end;
$$;

revoke execute on function public.take_verify_slots(text[], int[]) from public, anon, authenticated;
grant execute on function public.take_verify_slots(text[], int[]) to service_role;

commit;
