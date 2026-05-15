-- ============================================================
-- Migration 016: Add "Mieszkania" root folder per floor
-- Seeded before "Zmiany lokatorskie" (sort_order = 0)
-- ============================================================

-- 1. Update trigger to seed both root folders per floor
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

-- 2. Backfill existing floors that don't yet have a "Mieszkania" root folder
insert into locations (floor_id, parent_id, name, type, sort_order)
select f.id, null, 'Mieszkania', 'folder', 0
from floors f
where not exists (
  select 1 from locations l
  where l.floor_id = f.id
    and l.parent_id is null
    and l.name = 'Mieszkania'
);
