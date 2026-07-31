-- 020b_fk_policy_and_enum_rename.sql
-- Follow-up to 020 (D-030):
-- 1. Audit FK must not block user deletion: resolved_by references
--    auth.users without an ON DELETE action, so deleting a team member
--    who ever resolved an issue would fail. Recreate as ON DELETE SET NULL
--    (audit value degrades gracefully; issue row survives).
-- 2. The _v2 enum name must not leak into generated types: rename
--    issue_status_v2 back to issue_status now that the old enum is gone.
--
-- NOTE: if the ADD CONSTRAINT step reports a duplicate constraint under
-- a DIFFERENT name, check the actual FK name in Supabase:
--   select conname from pg_constraint
--   where conrelid = 'issues'::regclass and contype = 'f';
-- and substitute it in the DROP above.

begin;

alter table issues drop constraint if exists issues_resolved_by_fkey;
alter table issues add constraint issues_resolved_by_fkey
  foreign key (resolved_by) references auth.users(id)
  on delete set null;

alter type issue_status_v2 rename to issue_status;

commit;
