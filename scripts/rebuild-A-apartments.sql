-- ============================================================
-- rebuild-A-apartments.sql
--
-- Purpose  : PHASE A of the post-cascade-delete data rebuild.
--            Re-creates the 63 lokale (M1-M63) on floors 1-6 of the
--            freshly created project, after the original
--            projects/floors/locations rows were lost.
--
-- Relation to scripts/seed-apartments-budynek-A.sql :
--            Same floor -> apartment map, but PORTABLE. The old seed
--            hardcoded floor/parent UUIDs that no longer exist. This
--            rewrite resolves them by (project name, floor level) and
--            (floor, root folder named 'Lokale').
--
-- Safety   : INSERT ONLY. No DELETE, no UPDATE, no DDL.
--            Wrapped in one transaction, aborts on any assertion
--            failure. Every INSERT has a NOT EXISTS guard on
--            (floor_id, parent_id, name) -> safe to re-run.
--
-- How to run : Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Why scripts/ not migrations/ : DECISIONS.md D-022.
--
-- >>> BEFORE RUNNING: set the project name on the SELECT set_config
-- >>> line below to match the project you created in the app.
--
-- Floor -> lokal mapping (unchanged from the original seed)
--   level 1  M1-M10  (10)
--   level 2  M11-M21 (11)
--   level 3  M22-M32 (11)
--   level 4  M33-M43 (11)
--   level 5  M44-M53 (10)
--   level 6  M54-M63 (10)
--   Total: 63
--
-- Every row gets type='apartment' and unit_category='residential'
-- (migration 024). matrix_label is left NULL - the UI falls back to
-- the full name, and Gleb can set labels later from the lokal dialog.
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Target project name.  EDIT THIS LINE.
--    Transaction-local (third arg = true): cleared on COMMIT/ROLLBACK.
-- ============================================================

SELECT set_config('app.project_name', 'Budowa 1091, ul.Czysta', true);

-- ============================================================
-- 1. Pre-flight: 1 project, 6 floors, 6 'Lokale' folders
-- ============================================================

DO $$
DECLARE
  v_name         text := current_setting('app.project_name');
  v_project_id   uuid;
  v_project_cnt  integer;
  v_floor_cnt    integer;
  v_folder_cnt   integer;
  v_existing     integer;
BEGIN
  SELECT count(*) INTO v_project_cnt FROM projects WHERE name = v_name;

  IF v_project_cnt = 0 THEN
    RAISE EXCEPTION
      'Pre-flight FAILED: no project named %. Fix the set_config line at the top.', v_name;
  ELSIF v_project_cnt > 1 THEN
    RAISE EXCEPTION
      'Pre-flight FAILED: % projects named % - ambiguous target, refusing to guess.',
      v_project_cnt, v_name;
  END IF;

  SELECT id INTO v_project_id FROM projects WHERE name = v_name;

  SELECT count(*) INTO v_floor_cnt
  FROM floors
  WHERE project_id = v_project_id
    AND kind = 'floor'
    AND level BETWEEN 1 AND 6;

  IF v_floor_cnt <> 6 THEN
    RAISE EXCEPTION
      'Pre-flight FAILED: expected 6 floors at levels 1-6 in project %, found %.',
      v_name, v_floor_cnt;
  END IF;

  SELECT count(*) INTO v_folder_cnt
  FROM locations l
  JOIN floors f ON f.id = l.floor_id
  WHERE f.project_id = v_project_id
    AND f.kind = 'floor'
    AND f.level BETWEEN 1 AND 6
    AND l.parent_id IS NULL
    AND l.name = 'Lokale';

  IF v_folder_cnt <> 6 THEN
    RAISE EXCEPTION
      'Pre-flight FAILED: expected 6 root "Lokale" folders on levels 1-6, found %. '
      'Was the project seeded by the trigger, or were folders renamed?',
      v_folder_cnt;
  END IF;

  SELECT count(*) INTO v_existing
  FROM locations l
  JOIN floors f ON f.id = l.floor_id
  WHERE f.project_id = v_project_id
    AND l.type = 'apartment';

  RAISE NOTICE 'Pre-flight OK: project % (%), 6 floors, 6 Lokale folders, % existing lokale.',
    v_name, v_project_id, v_existing;
END $$;

-- ============================================================
-- 2. Insert the 63 lokale
-- ============================================================

WITH floor_map(level, lo, hi) AS (
  VALUES (1, 1, 10),
         (2, 11, 21),
         (3, 22, 32),
         (4, 33, 43),
         (5, 44, 53),
         (6, 54, 63)
)
INSERT INTO locations (floor_id, parent_id, type, name, sort_order, unit_category)
SELECT
  f.id,
  p.id,
  'apartment',
  'M' || s.n,
  s.n,
  'residential'
FROM floor_map m
JOIN projects pr
  ON pr.name = current_setting('app.project_name')
JOIN floors f
  ON f.project_id = pr.id
 AND f.kind = 'floor'
 AND f.level = m.level
JOIN locations p
  ON p.floor_id = f.id
 AND p.parent_id IS NULL
 AND p.name = 'Lokale'
CROSS JOIN LATERAL generate_series(m.lo, m.hi) AS s(n)
WHERE NOT EXISTS (
  SELECT 1 FROM locations x
  WHERE x.floor_id  = f.id
    AND x.parent_id = p.id
    AND x.name      = 'M' || s.n
);

-- ============================================================
-- 3. Post-insert assertion (inside the transaction - rolls back on mismatch)
-- ============================================================

DO $$
DECLARE
  v_name  text := current_setting('app.project_name');
  r       record;
  v_total integer := 0;
BEGIN
  FOR r IN
    SELECT f.level,
           (CASE f.level WHEN 1 THEN 10 WHEN 2 THEN 11 WHEN 3 THEN 11
                         WHEN 4 THEN 11 WHEN 5 THEN 10 WHEN 6 THEN 10 END) AS expected,
           count(l.id) AS actual
    FROM floors f
    JOIN projects pr ON pr.id = f.project_id AND pr.name = v_name
    LEFT JOIN locations l
      ON l.floor_id = f.id
     AND l.type = 'apartment'
     AND l.name ~ '^M[0-9]+$'
    WHERE f.kind = 'floor' AND f.level BETWEEN 1 AND 6
    GROUP BY f.level
    ORDER BY f.level
  LOOP
    IF r.actual <> r.expected THEN
      RAISE EXCEPTION
        'Verification FAILED on level %: expected % lokale, found %. Rolling back.',
        r.level, r.expected, r.actual;
    END IF;
    v_total := v_total + r.actual;
  END LOOP;

  IF v_total <> 63 THEN
    RAISE EXCEPTION 'Verification FAILED: expected 63 lokale total, found %. Rolling back.', v_total;
  END IF;

  RAISE NOTICE 'Verification OK: 63 lokale present across levels 1-6.';
END $$;

COMMIT;

-- ============================================================
-- 4. Result summary (runs after COMMIT)
--    Re-set the name here too - set_config above was transaction-local.
-- ============================================================

SELECT set_config('app.project_name', 'Budowa 1091, ul.Czysta', false);

SELECT
  f.level                                   AS floor,
  count(l.id)                               AS lokale,
  (array_agg(l.name ORDER BY l.sort_order))[1]      AS sample_first,
  (array_agg(l.name ORDER BY l.sort_order DESC))[1] AS sample_last,
  count(*) FILTER (WHERE l.unit_category = 'residential') AS residential
FROM floors f
JOIN projects pr ON pr.id = f.project_id AND pr.name = current_setting('app.project_name')
LEFT JOIN locations l
  ON l.floor_id = f.id AND l.type = 'apartment'
WHERE f.kind = 'floor' AND f.level BETWEEN 1 AND 6
GROUP BY f.level
ORDER BY f.level;
