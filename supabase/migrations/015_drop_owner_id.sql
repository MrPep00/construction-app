-- ============================================================
-- Migration 015: Drop owner_id from projects (Phase 5 cleanup)
-- RLS already switched to team_id in migration 014.
-- owner_id is no longer referenced by any policy or app code.
-- ============================================================

BEGIN;

ALTER TABLE projects DROP COLUMN owner_id;

ALTER TABLE projects ALTER COLUMN team_id SET NOT NULL;

COMMIT;
