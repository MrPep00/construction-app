-- Rollback migration 018: remove location_id from tasks
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to run multiple times (IF EXISTS guards)

BEGIN;

-- 1. Drop index
DROP INDEX IF EXISTS idx_tasks_location;

-- 2. Drop constraint
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_single_scope_check;

-- 3. Drop column
ALTER TABLE tasks
  DROP COLUMN IF EXISTS location_id;

COMMIT;

-- VERIFY:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'tasks' AND column_name = 'location_id';
-- → must return 0 rows
