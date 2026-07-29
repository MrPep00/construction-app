-- 020_issue_status_two_state.sql
-- D-030: two-state issue status (open|resolved) + audit columns.
-- Recon 2026-07-28: issues table had 0 rows in production; mapping UPDATEs
-- below are defensive no-ops kept for safety if rows appear before apply.

begin;

-- 1. Audit columns
alter table issues
  add column if not exists resolved_at timestamptz null,
  add column if not exists resolved_by uuid null references auth.users(id);

-- 2. Defensive data mapping (no-op on empty table)
update issues set status = 'open' where status = 'in_progress';
update issues
  set status = 'resolved', resolved_at = coalesce(resolved_at, updated_at)
  where status = 'rejected';

-- 3. Backfill audit timestamp for already-resolved rows (resolved_by unknown -> stays NULL)
update issues
  set resolved_at = coalesce(resolved_at, updated_at)
  where status = 'resolved';

-- 4. Fail loudly if any unmapped status remains
do $$
declare bad_count integer;
begin
  select count(*) into bad_count from issues where status not in ('open', 'resolved');
  if bad_count > 0 then
    raise exception 'migration 020: % issue rows still carry unmapped status — aborting', bad_count;
  end if;
end $$;

-- 5. Swap enum: issue_status -> issue_status_v2 ('open','resolved')
create type issue_status_v2 as enum ('open', 'resolved');

alter table issues alter column status drop default;
alter table issues
  alter column status type issue_status_v2
  using (status::text::issue_status_v2);
alter table issues alter column status set default 'open';
alter table issues alter column status set not null;

drop type issue_status;

commit;
