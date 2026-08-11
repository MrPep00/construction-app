-- ============================================================
-- Migration 023: floor zones
-- 1. floors.sort_order (canonical display position, asc = top of list)
-- 2. floors.kind ('floor' | 'zone')
-- 3. Zone levels allocated from reserved range: -100, -101, ...
--    (real floors are >= -2; unique(project_id, level) preserved)
-- 4. Locations trigger skips zones (flat containers, no seeded folders)
-- 5. Project trigger seeds "Teren zewnętrzny" zone after 10 floors
-- 6. Backfill: every existing project gets the zone appended
-- ============================================================

BEGIN;

-- 1+2. Columns
ALTER TABLE floors ADD COLUMN sort_order int;
ALTER TABLE floors ADD COLUMN kind text NOT NULL DEFAULT 'floor';
ALTER TABLE floors ADD CONSTRAINT floors_kind_check CHECK (kind IN ('floor','zone'));

-- Backfill sort_order: today's visual order (level desc) preserved exactly
UPDATE floors f
SET sort_order = r.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY level DESC) AS rn
  FROM floors
) r
WHERE f.id = r.id;

ALTER TABLE floors ALTER COLUMN sort_order SET NOT NULL;
CREATE INDEX floors_project_sort_idx ON floors(project_id, sort_order);

-- 4. Locations trigger: zones get NO seeded folders
-- (must run BEFORE the zone backfill below, same transaction)
create or replace function create_locations_for_floor()
returns trigger language plpgsql as $$
begin
  if new.kind = 'zone' then
    return new;  -- zones are flat containers
  end if;
  insert into locations (floor_id, parent_id, name, type, sort_order)
  values
    (new.id, null, 'Mieszkania',          'folder',          0),
    (new.id, null, 'Zmiany lokatorskie',  'tenant_changes',  1);
  return new;
end;
$$;

-- 5. Project trigger: 10 floors + seeded zone
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
  -- sort_order asc = top of list, so Dach (last inserted, level 7) gets 1
  FOR i IN 1..10 LOOP
    INSERT INTO floors (project_id, level, label, kind, sort_order)
    VALUES (NEW.id, floor_levels[i], floor_labels[i], 'floor', 11 - i);
  END LOOP;
  INSERT INTO floors (project_id, level, label, kind, sort_order)
  VALUES (NEW.id, -100, 'Teren zewnętrzny', 'zone', 11);
  RETURN NEW;
END;
$$;

-- 6. Backfill existing projects (runs AFTER the trigger guard above,
--    so zones receive no folders). Idempotent.
-- Zone level allocation rule (also used by the add-zone server action):
--   COALESCE(MIN(level) WHERE level <= -100, -99) - 1 per project
INSERT INTO floors (project_id, level, label, kind, sort_order)
SELECT
  p.id,
  COALESCE((SELECT min(f.level) FROM floors f
            WHERE f.project_id = p.id AND f.level <= -100), -99) - 1,
  'Teren zewnętrzny',
  'zone',
  COALESCE((SELECT max(f.sort_order) FROM floors f
            WHERE f.project_id = p.id), 0) + 1
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM floors f
  WHERE f.project_id = p.id AND f.kind = 'zone' AND f.label = 'Teren zewnętrzny'
);

COMMIT;


-- ============================================================
-- ROLLBACK (run only if app breaks; restores 017-era triggers)
-- ============================================================
/*
BEGIN;

-- Remove seeded/manual zones (cascades to any locations/files/tasks on them)
DELETE FROM floors WHERE kind = 'zone';

-- Restore 017 locations trigger (no kind guard)
create or replace function create_locations_for_floor()
returns trigger language plpgsql as $$
begin
  insert into locations (floor_id, parent_id, name, type, sort_order)
  values
    (new.id, null, 'Mieszkania',          'folder',          0),
    (new.id, null, 'Zmiany lokatorskie',  'tenant_changes',  1);
  return new;
end;
$$;

-- Restore 002 project trigger (10 floors, no zone, no sort_order)
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

DROP INDEX IF EXISTS floors_project_sort_idx;
ALTER TABLE floors DROP CONSTRAINT floors_kind_check;
ALTER TABLE floors DROP COLUMN kind;
ALTER TABLE floors DROP COLUMN sort_order;

COMMIT;
*/
