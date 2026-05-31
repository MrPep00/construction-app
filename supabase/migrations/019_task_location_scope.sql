-- 019_task_location_scope.sql
BEGIN;

-- 1. Wipe all existing tasks (user-accepted, they were test data per D-027)
DELETE FROM tasks;

-- 2. Add location_id column (nullable = not all tasks are location-scoped)
ALTER TABLE tasks
  ADD COLUMN location_id uuid REFERENCES locations(id) ON DELETE CASCADE;

-- 3. Constraint: floor_id and location_id cannot both be set simultaneously
--    (global = both null, per-floor = floor_id set, per-location = location_id set)
ALTER TABLE tasks
  ADD CONSTRAINT tasks_single_scope_check
  CHECK (NOT (floor_id IS NOT NULL AND location_id IS NOT NULL));

-- 4. Index for efficient location-scoped lookups
CREATE INDEX idx_tasks_location ON tasks(location_id)
  WHERE location_id IS NOT NULL;

-- 5. Replace RLS policy to cover all three scope paths
--    OLD: only projects.id = tasks.project_id
--    NEW: same for direct project_id path (covers global + floor-scoped),
--         PLUS a path through location → floor → project for location-scoped tasks
DROP POLICY IF EXISTS "team full access" ON tasks;

CREATE POLICY "team full access" ON tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
        AND projects.team_id IN (SELECT team_id FROM get_user_team_ids(auth.uid()))
    )
    OR
    EXISTS (
      SELECT 1 FROM locations
      JOIN floors ON floors.id = locations.floor_id
      JOIN projects ON projects.id = floors.project_id
      WHERE locations.id = tasks.location_id
        AND projects.team_id IN (SELECT team_id FROM get_user_team_ids(auth.uid()))
    )
  );

COMMIT;
