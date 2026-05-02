-- ============================================================
-- Migration 003: Simplify floor hierarchy
-- Remove branch folders; files can now attach directly to floors
-- ============================================================

-- 1. Update seeding trigger: only create tenant_changes folder per floor
create or replace function create_locations_for_floor()
returns trigger language plpgsql as $$
begin
  insert into locations (floor_id, parent_id, name, type, sort_order)
  values (new.id, null, 'Zmiany lokatorskie', 'tenant_changes', 1);
  return new;
end;
$$;

-- 2. Delete all existing branch locations (cascades to their files/issues)
delete from locations where type = 'branch';

-- 3. Make location_id nullable and add floor_id to files
alter table files
  alter column location_id drop not null,
  add column floor_id uuid references floors(id) on delete cascade;

-- 4. Exactly one of location_id or floor_id must be set
alter table files
  add constraint files_location_xor_floor check (
    (location_id is not null and floor_id is null) or
    (location_id is null    and floor_id is not null)
  );

-- 5. Index for floor-level file queries
create index on files (floor_id);

-- 6. Update RLS to cover both location-level and floor-level files
drop policy "owner full access" on files;

create policy "owner full access" on files
  for all using (
    (
      location_id is not null and
      exists (
        select 1 from locations
        join floors    on floors.id    = locations.floor_id
        join projects  on projects.id  = floors.project_id
        where locations.id = files.location_id
          and projects.owner_id = auth.uid()
      )
    ) or (
      floor_id is not null and
      exists (
        select 1 from floors
        join projects on projects.id = floors.project_id
        where floors.id = files.floor_id
          and projects.owner_id = auth.uid()
      )
    )
  );
