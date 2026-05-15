-- ============================================================
-- seed-apartments-budynek-A.sql
--
-- Purpose  : Seed 63 apartments (M1–M63) across floors 1–6
--            of the production project "Budynek A".
-- Scope    : SINGLE-USE for one specific Supabase project.
--            UUIDs are hardcoded — do NOT run on a fresh instance
--            or a different project (UUIDs won't match).
-- How to run : Supabase Dashboard → SQL Editor → paste → Run.
-- Why scripts/ not migrations/ : see DECISIONS.md D-022.
--   Migrations are portable schema changes; this seed contains
--   hardcoded UUIDs that exist only in one production database.
-- Idempotency : Each INSERT has a NOT EXISTS guard on
--   (floor_id, parent_id, name). Safe to re-run — rows that
--   already exist are silently skipped.
--
-- Floor → apartment mapping
--   Floor 1 (level=1)  floor_id=d9d9ac70... parent=d3c5df51...  M1–M10  (10)
--   Floor 2 (level=2)  floor_id=c68b2d08... parent=ff05dae5...  M11–M21 (11)
--   Floor 3 (level=3)  floor_id=503bcf66... parent=611587d1...  M22–M32 (11)
--   Floor 4 (level=4)  floor_id=b8718e7c... parent=270a048c...  M33–M43 (11)
--   Floor 5 (level=5)  floor_id=f5125cd3... parent=66d76e95...  M44–M53 (10)
--   Floor 6 (level=6)  floor_id=ecf158d9... parent=9a10de64...  M54–M63 (10)
--   Total: 63 apartments
-- ============================================================

BEGIN;

-- ============================================================
-- Pre-flight: verify all 6 target floors exist
-- ============================================================

DO $$
DECLARE
  floor_count  integer;
  parent_count integer;
BEGIN
  SELECT COUNT(*) INTO floor_count
  FROM floors
  WHERE id IN (
    'd9d9ac70-d034-4a47-8942-9d6d7f9d73c6',
    'c68b2d08-75af-40fb-9e3a-6bedfa03f641',
    '503bcf66-f065-4e64-8e03-549a0a7fa9f0',
    'b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6',
    'f5125cd3-d724-48b3-9736-6855aeee87e0',
    'ecf158d9-d8f8-4024-a38d-f0325ee21f67'
  );

  IF floor_count <> 6 THEN
    RAISE EXCEPTION
      'Pre-flight FAILED: expected 6 target floors, found %. '
      'Wrong database or wrong UUIDs — do not proceed.',
      floor_count;
  END IF;

  SELECT COUNT(*) INTO parent_count
  FROM locations
  WHERE id IN (
    'd3c5df51-bab8-4036-bd85-3b8fce6b6daf',
    'ff05dae5-3806-42bc-bfac-797ce1a259d6',
    '611587d1-3029-4569-a6b1-4a2b28523a1d',
    '270a048c-cbd8-458b-aeb5-1d7fd528cb04',
    '66d76e95-2726-4205-b6da-1124a2f7f64f',
    '9a10de64-165e-403a-9444-316fbb38024b'
  );

  IF parent_count <> 6 THEN
    RAISE EXCEPTION
      'Pre-flight FAILED: expected 6 parent folders (Mieszkania), found %. '
      'Wrong database or wrong UUIDs — do not proceed.',
      parent_count;
  END IF;

  RAISE NOTICE 'Pre-flight OK: 6 floors and 6 parent folders verified.';
END $$;

-- ============================================================
-- Floor 1 (level=1): M1–M10 (10 apartments)
-- ============================================================

INSERT INTO locations (id, floor_id, parent_id, type, name, sort_order)
SELECT
  gen_random_uuid(),
  'd9d9ac70-d034-4a47-8942-9d6d7f9d73c6',
  'd3c5df51-bab8-4036-bd85-3b8fce6b6daf',
  'apartment',
  'M' || s.n,
  s.n
FROM generate_series(1, 10) AS s(n)
WHERE NOT EXISTS (
  SELECT 1 FROM locations
  WHERE floor_id  = 'd9d9ac70-d034-4a47-8942-9d6d7f9d73c6'
    AND parent_id = 'd3c5df51-bab8-4036-bd85-3b8fce6b6daf'
    AND name      = 'M' || s.n
);

-- ============================================================
-- Floor 2 (level=2): M11–M21 (11 apartments)
-- ============================================================

INSERT INTO locations (id, floor_id, parent_id, type, name, sort_order)
SELECT
  gen_random_uuid(),
  'c68b2d08-75af-40fb-9e3a-6bedfa03f641',
  'ff05dae5-3806-42bc-bfac-797ce1a259d6',
  'apartment',
  'M' || s.n,
  s.n
FROM generate_series(11, 21) AS s(n)
WHERE NOT EXISTS (
  SELECT 1 FROM locations
  WHERE floor_id  = 'c68b2d08-75af-40fb-9e3a-6bedfa03f641'
    AND parent_id = 'ff05dae5-3806-42bc-bfac-797ce1a259d6'
    AND name      = 'M' || s.n
);

-- ============================================================
-- Floor 3 (level=3): M22–M32 (11 apartments)
-- ============================================================

INSERT INTO locations (id, floor_id, parent_id, type, name, sort_order)
SELECT
  gen_random_uuid(),
  '503bcf66-f065-4e64-8e03-549a0a7fa9f0',
  '611587d1-3029-4569-a6b1-4a2b28523a1d',
  'apartment',
  'M' || s.n,
  s.n
FROM generate_series(22, 32) AS s(n)
WHERE NOT EXISTS (
  SELECT 1 FROM locations
  WHERE floor_id  = '503bcf66-f065-4e64-8e03-549a0a7fa9f0'
    AND parent_id = '611587d1-3029-4569-a6b1-4a2b28523a1d'
    AND name      = 'M' || s.n
);

-- ============================================================
-- Floor 4 (level=4): M33–M43 (11 apartments)
-- ============================================================

INSERT INTO locations (id, floor_id, parent_id, type, name, sort_order)
SELECT
  gen_random_uuid(),
  'b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6',
  '270a048c-cbd8-458b-aeb5-1d7fd528cb04',
  'apartment',
  'M' || s.n,
  s.n
FROM generate_series(33, 43) AS s(n)
WHERE NOT EXISTS (
  SELECT 1 FROM locations
  WHERE floor_id  = 'b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6'
    AND parent_id = '270a048c-cbd8-458b-aeb5-1d7fd528cb04'
    AND name      = 'M' || s.n
);

-- ============================================================
-- Floor 5 (level=5): M44–M53 (10 apartments)
-- ============================================================

INSERT INTO locations (id, floor_id, parent_id, type, name, sort_order)
SELECT
  gen_random_uuid(),
  'f5125cd3-d724-48b3-9736-6855aeee87e0',
  '66d76e95-2726-4205-b6da-1124a2f7f64f',
  'apartment',
  'M' || s.n,
  s.n
FROM generate_series(44, 53) AS s(n)
WHERE NOT EXISTS (
  SELECT 1 FROM locations
  WHERE floor_id  = 'f5125cd3-d724-48b3-9736-6855aeee87e0'
    AND parent_id = '66d76e95-2726-4205-b6da-1124a2f7f64f'
    AND name      = 'M' || s.n
);

-- ============================================================
-- Floor 6 (level=6): M54–M63 (10 apartments)
-- ============================================================

INSERT INTO locations (id, floor_id, parent_id, type, name, sort_order)
SELECT
  gen_random_uuid(),
  'ecf158d9-d8f8-4024-a38d-f0325ee21f67',
  '9a10de64-165e-403a-9444-316fbb38024b',
  'apartment',
  'M' || s.n,
  s.n
FROM generate_series(54, 63) AS s(n)
WHERE NOT EXISTS (
  SELECT 1 FROM locations
  WHERE floor_id  = 'ecf158d9-d8f8-4024-a38d-f0325ee21f67'
    AND parent_id = '9a10de64-165e-403a-9444-316fbb38024b'
    AND name      = 'M' || s.n
);

-- ============================================================
-- Verification: count apartments per floor, assert expected
-- ============================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      f.level,
      COUNT(*)::integer AS got,
      CASE f.level
        WHEN 1 THEN 10
        WHEN 2 THEN 11
        WHEN 3 THEN 11
        WHEN 4 THEN 11
        WHEN 5 THEN 10
        WHEN 6 THEN 10
      END AS expected
    FROM locations l
    JOIN floors f ON f.id = l.floor_id
    WHERE l.type = 'apartment'
      AND l.floor_id IN (
        'd9d9ac70-d034-4a47-8942-9d6d7f9d73c6',
        'c68b2d08-75af-40fb-9e3a-6bedfa03f641',
        '503bcf66-f065-4e64-8e03-549a0a7fa9f0',
        'b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6',
        'f5125cd3-d724-48b3-9736-6855aeee87e0',
        'ecf158d9-d8f8-4024-a38d-f0325ee21f67'
      )
    GROUP BY f.level
    ORDER BY f.level
  LOOP
    RAISE NOTICE 'Floor %: % apartments (expected %)', r.level, r.got, r.expected;
    IF r.got <> r.expected THEN
      RAISE EXCEPTION
        'Count mismatch on floor % — got %, expected %. Rolling back.',
        r.level, r.got, r.expected;
    END IF;
  END LOOP;
  RAISE NOTICE 'All counts verified OK. Total: 63 apartments across floors 1–6.';
END $$;

-- Visual result set for SQL Editor output panel
SELECT
  f.level                                          AS floor,
  COUNT(*)                                         AS apartments_inserted,
  MIN(l.name)                                      AS first,
  MAX(l.name)                                      AS last
FROM locations l
JOIN floors f ON f.id = l.floor_id
WHERE l.type = 'apartment'
  AND l.floor_id IN (
    'd9d9ac70-d034-4a47-8942-9d6d7f9d73c6',
    'c68b2d08-75af-40fb-9e3a-6bedfa03f641',
    '503bcf66-f065-4e64-8e03-549a0a7fa9f0',
    'b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6',
    'f5125cd3-d724-48b3-9736-6855aeee87e0',
    'ecf158d9-d8f8-4024-a38d-f0325ee21f67'
  )
GROUP BY f.level
ORDER BY f.level;

COMMIT;

-- ============================================================
-- Rollback (if you need to undo):
--
--   DELETE FROM locations
--   WHERE type = 'apartment'
--     AND floor_id IN (
--       'd9d9ac70-d034-4a47-8942-9d6d7f9d73c6',
--       'c68b2d08-75af-40fb-9e3a-6bedfa03f641',
--       '503bcf66-f065-4e64-8e03-549a0a7fa9f0',
--       'b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6',
--       'f5125cd3-d724-48b3-9736-6855aeee87e0',
--       'ecf158d9-d8f8-4024-a38d-f0325ee21f67'
--     )
--     AND name ~ '^M[0-9]+$';
-- ============================================================
