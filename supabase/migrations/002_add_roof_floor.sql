-- ============================================================
-- Migration 002: Split 'Dach / Piętro 6' into two separate floors
-- 'Piętro 6' (level 6) and 'Dach' (level 7)
-- Result: 10 floors per project (-2 through 7)
-- ============================================================

-- Rename existing level 6 floors
UPDATE floors SET label = 'Piętro 6' WHERE level = 6;

-- Add 'Dach' floor (level 7) to all existing projects.
-- The trg_create_locations trigger fires on each inserted row,
-- so it automatically seeds 7 default locations per floor.
INSERT INTO floors (project_id, level, label)
SELECT id, 7, 'Dach'
FROM projects
ON CONFLICT (project_id, level) DO NOTHING;

-- Update the trigger function so new projects get 10 floors
CREATE OR REPLACE FUNCTION create_floors_for_project()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  floor_labels text[] := ARRAY[
    'Piwnica -2', 'Piwnica -1', 'Parter',
    'Piętro 1', 'Piętro 2', 'Piętro 3',
    'Piętro 4', 'Piętro 5', 'Piętro 6', 'Dach'
  ];
  floor_levels int[] := ARRAY[-2, -1, 0, 1, 2, 3, 4, 5, 6, 7];
  i int;
BEGIN
  FOR i IN 1..10 LOOP
    INSERT INTO floors (project_id, level, label)
    VALUES (NEW.id, floor_levels[i], floor_labels[i]);
  END LOOP;
  RETURN NEW;
END;
$$;
