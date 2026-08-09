-- ============================================================
-- Migration 022: project-level files
-- 1. files.project_id (uuid NOT NULL, FK projects ON DELETE CASCADE),
--    backfilled from existing targets via their joins.
-- 2. files_one_target relaxed: exactly-one -> at-most-one
--    (all targets NULL = project-level file).
-- 3. RLS rebased on project_id (single membership check, no target joins).
-- Wrapped in one transaction.
-- ============================================================

BEGIN;

-- 1. Column (nullable first, backfill, then NOT NULL)
ALTER TABLE files
  ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;

-- Backfill from location target
UPDATE files f
SET project_id = fl.project_id
FROM locations l
JOIN floors fl ON fl.id = l.floor_id
WHERE f.location_id = l.id
  AND f.project_id IS NULL;

-- Backfill from floor target
UPDATE files f
SET project_id = fl.project_id
FROM floors fl
WHERE f.floor_id = fl.id
  AND f.project_id IS NULL;

-- Backfill from task target
UPDATE files f
SET project_id = t.project_id
FROM tasks t
WHERE f.task_id = t.id
  AND f.project_id IS NULL;

-- Safety check: every existing row must have resolved a project
DO $$
DECLARE orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count FROM files WHERE project_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Migration 022 aborted: % files rows could not resolve project_id', orphan_count;
  END IF;
END $$;

ALTER TABLE files
  ALTER COLUMN project_id SET NOT NULL;

CREATE INDEX files_project_id_idx ON files(project_id);

-- 2. Constraint: at most one target (all NULL = project-level file)
ALTER TABLE files DROP CONSTRAINT files_one_target;
ALTER TABLE files ADD CONSTRAINT files_one_target CHECK (
  (location_id IS NOT NULL)::int +
  (floor_id    IS NOT NULL)::int +
  (task_id     IS NOT NULL)::int <= 1
);

-- 3. RLS rebased on project_id
DROP POLICY IF EXISTS "team full access" ON files;

CREATE POLICY "team full access" ON files
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = files.project_id
        AND p.team_id IN (SELECT team_id FROM get_user_team_ids(auth.uid()))
    )
  );

COMMIT;


-- ============================================================
-- ROLLBACK (run only if app breaks; restores 014-era policy + 007 constraint)
-- ============================================================
/*
BEGIN;

DROP POLICY IF EXISTS "team full access" ON files;
CREATE POLICY "team full access" ON files
  FOR ALL
  USING (
    (
      location_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM locations
        JOIN floors   ON floors.id   = locations.floor_id
        JOIN projects ON projects.id = floors.project_id
        WHERE locations.id = files.location_id
          AND projects.team_id IN (SELECT team_id FROM get_user_team_ids(auth.uid()))
      )
    ) OR (
      floor_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM floors
        JOIN projects ON projects.id = floors.project_id
        WHERE floors.id = files.floor_id
          AND projects.team_id IN (SELECT team_id FROM get_user_team_ids(auth.uid()))
      )
    ) OR (
      task_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM tasks
        JOIN projects ON projects.id = tasks.project_id
        WHERE tasks.id = files.task_id
          AND projects.team_id IN (SELECT team_id FROM get_user_team_ids(auth.uid()))
      )
    )
  );

-- NOTE: reverting constraint to '= 1' fails if any project-level (all-NULL) files exist.
-- Delete them first: DELETE FROM files WHERE location_id IS NULL AND floor_id IS NULL AND task_id IS NULL;
ALTER TABLE files DROP CONSTRAINT files_one_target;
ALTER TABLE files ADD CONSTRAINT files_one_target CHECK (
  (location_id IS NOT NULL)::int +
  (floor_id    IS NOT NULL)::int +
  (task_id     IS NOT NULL)::int = 1
);

ALTER TABLE files DROP COLUMN project_id;

COMMIT;
*/
