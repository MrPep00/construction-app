-- ============================================================
-- Migration 024: "Lokale" (units)
-- 1. locations.matrix_label — short badge shown in the building matrix
--    (CHECK <= 8 chars is a sanity bound only; visual width is enforced
--     in the create/edit form, not in the DB)
-- 2. locations.unit_category — residential | commercial | storage | technical
--    NULL for rooms/folders/tenant_changes; existing apartments -> 'residential'
-- 3. Seeded root folder label "Mieszkania" -> "Lokale" (trigger + backfill)
-- 4. Nothing else: floors.kind / floors.sort_order (023) untouched;
--    the locations type enum ('apartment') is untouched — this is UI
--    vocabulary + seed label only.
-- ============================================================

BEGIN;

-- 1. matrix_label
ALTER TABLE locations ADD COLUMN matrix_label text;
ALTER TABLE locations ADD CONSTRAINT locations_matrix_label_len
  CHECK (matrix_label IS NULL OR char_length(matrix_label) <= 8);

-- 2. unit_category
ALTER TABLE locations ADD COLUMN unit_category text;
ALTER TABLE locations ADD CONSTRAINT locations_unit_category_check
  CHECK (
    unit_category IS NULL
    OR unit_category IN ('residential', 'commercial', 'storage', 'technical')
  );

-- Backfill: every existing unit is residential (the app only created
-- apartments until now)
UPDATE locations SET unit_category = 'residential' WHERE type = 'apartment';

-- 3a. Trigger: seed "Lokale" instead of "Mieszkania".
--     Keeps the 023 zone guard verbatim — zones stay flat containers.
create or replace function create_locations_for_floor()
returns trigger language plpgsql as $$
begin
  if new.kind = 'zone' then
    return new;  -- zones are flat containers
  end if;
  insert into locations (floor_id, parent_id, name, type, sort_order)
  values
    (new.id, null, 'Lokale',             'folder',          0),
    (new.id, null, 'Zmiany lokatorskie', 'tenant_changes',  1);
  return new;
end;
$$;

-- 3b. Backfill existing seeded folders.
--     Predicate matches ONLY the seeded row shape:
--       name = 'Mieszkania' AND parent_id IS NULL AND type = 'folder'
--       AND sort_order = 0
--     A user-created root folder gets sort_order = max(sibling)+1 >= 2
--     (see createLocation in lib/actions/locations.ts), and any folder the
--     user renamed no longer matches the name — neither is touched.
UPDATE locations
SET name = 'Lokale'
WHERE name = 'Mieszkania'
  AND parent_id IS NULL
  AND type = 'folder'
  AND sort_order = 0;

COMMIT;


-- ============================================================
-- ROLLBACK (run only if app breaks; restores the 023 trigger)
-- ============================================================
/*
BEGIN;

UPDATE locations
SET name = 'Mieszkania'
WHERE name = 'Lokale'
  AND parent_id IS NULL
  AND type = 'folder'
  AND sort_order = 0;

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

ALTER TABLE locations DROP CONSTRAINT locations_unit_category_check;
ALTER TABLE locations DROP COLUMN unit_category;
ALTER TABLE locations DROP CONSTRAINT locations_matrix_label_len;
ALTER TABLE locations DROP COLUMN matrix_label;

COMMIT;
*/
