-- ============================================================
-- Migration 013: Backfill teams for existing projects (Phase 2)
-- For every distinct owner_id in projects:
--   1. Create a team (name='Mój zespół', created_by=owner_id)
--   2. Add the owner as the sole member
--   3. Point all their projects at the new team
--
-- Wrapped in a transaction. Rolls back entirely if any assertion fails.
-- owner_id is NOT dropped here — that happens in migration 015 (Phase 5).
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_owner_id  uuid;
  v_team_id   uuid;
  v_count     int;
BEGIN
  -- ----------------------------------------------------------------
  -- Step 1: For each distinct owner, create team + member + update projects
  -- ----------------------------------------------------------------
  FOR v_owner_id IN
    SELECT DISTINCT owner_id FROM projects
  LOOP
    -- Create a team for this owner
    INSERT INTO teams (name, created_by)
    VALUES ('Mój zespół', v_owner_id)
    RETURNING id INTO v_team_id;

    -- Add the owner as a member
    INSERT INTO team_members (team_id, user_id)
    VALUES (v_team_id, v_owner_id);

    -- Assign all of this owner's projects to the new team
    UPDATE projects
    SET team_id = v_team_id
    WHERE owner_id = v_owner_id;
  END LOOP;

  -- ----------------------------------------------------------------
  -- Step 2: Assertions — roll back if any invariant is violated
  -- ----------------------------------------------------------------

  -- No project should have team_id NULL after backfill
  SELECT COUNT(*) INTO v_count
  FROM projects
  WHERE team_id IS NULL;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Backfill assertion failed: % project(s) still have team_id IS NULL', v_count;
  END IF;

  -- Every team must have at least one member
  SELECT COUNT(*) INTO v_count
  FROM teams t
  WHERE NOT EXISTS (
    SELECT 1 FROM team_members tm WHERE tm.team_id = t.id
  );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Backfill assertion failed: % team(s) have zero members', v_count;
  END IF;

  -- Every project's team must contain the project's original owner_id
  SELECT COUNT(*) INTO v_count
  FROM projects p
  WHERE NOT EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = p.team_id
      AND tm.user_id = p.owner_id
  );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Backfill assertion failed: % project(s) have a team that does not contain the original owner', v_count;
  END IF;

  RAISE NOTICE 'Migration 013 backfill complete. All assertions passed.';
END;
$$;

COMMIT;
