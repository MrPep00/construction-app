-- ============================================================
-- Construction Inspection App — Initial Schema
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable pgcrypto for gen_random_uuid() (usually already enabled in Supabase)
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type issue_status   as enum ('open', 'in_progress', 'resolved', 'rejected');
create type issue_severity as enum ('low', 'normal', 'high', 'critical');
create type location_type  as enum ('branch', 'tenant_changes', 'apartment', 'room', 'folder');
create type task_status    as enum ('todo', 'doing', 'done');
create type movement_reason as enum ('delivery', 'consumption', 'correction');

-- ============================================================
-- TABLES
-- ============================================================

-- projects
create table projects (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- floors  (9 per project: -2 through 6)
create table floors (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  level      int  not null,                           -- -2, -1, 0, 1, 2, 3, 4, 5, 6
  label      text not null,                           -- e.g. "Parter", "Piętro 1", "Piwnica -2"
  created_at timestamptz not null default now(),
  unique (project_id, level)
);

-- locations  (self-referencing tree)
create table locations (
  id         uuid primary key default gen_random_uuid(),
  floor_id   uuid not null references floors(id) on delete cascade,
  parent_id  uuid references locations(id) on delete cascade,
  name       text not null,
  type       location_type not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- files
create table files (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references locations(id) on delete cascade,
  name         text not null,
  storage_path text not null,
  mime_type    text not null,
  size_bytes   bigint not null default 0,
  uploaded_by  uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- issues (defects / snag list)
create table issues (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  title       text not null,
  description text,
  status      issue_status   not null default 'open',
  severity    issue_severity not null default 'normal',
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- inventory_items  (material types per project)
create table inventory_items (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name       text not null,
  unit       text not null default 'szt',
  created_at timestamptz not null default now()
);

-- inventory_levels  (per-floor stock and demand)
create table inventory_levels (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references inventory_items(id) on delete cascade,
  floor_id   uuid not null references floors(id) on delete cascade,
  on_hand    int  not null default 0,
  required   int  not null default 0,
  updated_at timestamptz not null default now(),
  unique (item_id, floor_id)
);

-- inventory_movements  (audit log)
create table inventory_movements (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references inventory_items(id) on delete cascade,
  floor_id   uuid not null references floors(id) on delete cascade,
  delta      int  not null,
  reason     movement_reason not null,
  note       text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- notes  (free text, per-floor or global)
create table notes (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  floor_id   uuid references floors(id) on delete cascade,  -- NULL = global
  body       text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- tasks  (per-floor or global)
create table tasks (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  floor_id   uuid references floors(id) on delete cascade,  -- NULL = global
  title      text not null,
  status     task_status not null default 'todo',
  priority   int  not null default 3 check (priority between 1 and 5),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index on floors (project_id);
create index on locations (floor_id);
create index on locations (parent_id);
create index on files (location_id);
create index on issues (location_id);
create index on issues (status);
create index on inventory_items (project_id);
create index on inventory_levels (item_id);
create index on inventory_levels (floor_id);
create index on inventory_movements (item_id, floor_id);
create index on notes (project_id, floor_id);
create index on tasks (project_id, floor_id);
create index on tasks (status);

-- ============================================================
-- UPDATED_AT TRIGGER HELPER
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

create trigger trg_locations_updated_at
  before update on locations
  for each row execute function set_updated_at();

create trigger trg_issues_updated_at
  before update on issues
  for each row execute function set_updated_at();

create trigger trg_inventory_levels_updated_at
  before update on inventory_levels
  for each row execute function set_updated_at();

create trigger trg_notes_updated_at
  before update on notes
  for each row execute function set_updated_at();

create trigger trg_tasks_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- ============================================================
-- TRIGGER: Auto-create 9 floors when a project is inserted
-- Levels: -2, -1, 0, 1, 2, 3, 4, 5, 6
-- ============================================================

create or replace function create_floors_for_project()
returns trigger language plpgsql as $$
declare
  floor_labels text[] := array[
    'Piwnica -2', 'Piwnica -1', 'Parter',
    'Piętro 1', 'Piętro 2', 'Piętro 3',
    'Piętro 4', 'Piętro 5', 'Dach / Piętro 6'
  ];
  floor_levels int[]  := array[-2, -1, 0, 1, 2, 3, 4, 5, 6];
  i int;
begin
  for i in 1..9 loop
    insert into floors (project_id, level, label)
    values (new.id, floor_levels[i], floor_labels[i]);
  end loop;
  return new;
end;
$$;

create trigger trg_create_floors
  after insert on projects
  for each row execute function create_floors_for_project();

-- ============================================================
-- TRIGGER: Auto-create 6 branches + tenant_changes folder
--          when a floor is inserted
-- Branch names follow civil-engineering convention (PL)
-- ============================================================

create or replace function create_locations_for_floor()
returns trigger language plpgsql as $$
declare
  branch_names text[] := array[
    'Konstrukcja', 'Architektura', 'Instalacje elektryczne',
    'Instalacje sanitarne', 'Instalacje HVAC', 'Teletechnika'
  ];
  i int;
begin
  -- 6 engineering branches
  for i in 1..6 loop
    insert into locations (floor_id, parent_id, name, type, sort_order)
    values (new.id, null, branch_names[i], 'branch', i);
  end loop;

  -- tenant changes folder
  insert into locations (floor_id, parent_id, name, type, sort_order)
  values (new.id, null, 'Zmiany lokatorskie', 'tenant_changes', 7);

  return new;
end;
$$;

create trigger trg_create_locations
  after insert on floors
  for each row execute function create_locations_for_floor();

-- ============================================================
-- ROW LEVEL SECURITY
-- All policies chain through projects.owner_id = auth.uid()
-- ============================================================

alter table projects          enable row level security;
alter table floors            enable row level security;
alter table locations         enable row level security;
alter table files             enable row level security;
alter table issues            enable row level security;
alter table inventory_items   enable row level security;
alter table inventory_levels  enable row level security;
alter table inventory_movements enable row level security;
alter table notes             enable row level security;
alter table tasks             enable row level security;

-- projects
create policy "owner full access" on projects
  for all using (owner_id = auth.uid());

-- floors
create policy "owner full access" on floors
  for all using (
    exists (
      select 1 from projects
      where projects.id = floors.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- locations
create policy "owner full access" on locations
  for all using (
    exists (
      select 1 from floors
      join projects on projects.id = floors.project_id
      where floors.id = locations.floor_id
        and projects.owner_id = auth.uid()
    )
  );

-- files
create policy "owner full access" on files
  for all using (
    exists (
      select 1 from locations
      join floors on floors.id = locations.floor_id
      join projects on projects.id = floors.project_id
      where locations.id = files.location_id
        and projects.owner_id = auth.uid()
    )
  );

-- issues
create policy "owner full access" on issues
  for all using (
    exists (
      select 1 from locations
      join floors on floors.id = locations.floor_id
      join projects on projects.id = floors.project_id
      where locations.id = issues.location_id
        and projects.owner_id = auth.uid()
    )
  );

-- inventory_items
create policy "owner full access" on inventory_items
  for all using (
    exists (
      select 1 from projects
      where projects.id = inventory_items.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- inventory_levels
create policy "owner full access" on inventory_levels
  for all using (
    exists (
      select 1 from inventory_items
      join projects on projects.id = inventory_items.project_id
      where inventory_items.id = inventory_levels.item_id
        and projects.owner_id = auth.uid()
    )
  );

-- inventory_movements
create policy "owner full access" on inventory_movements
  for all using (
    exists (
      select 1 from inventory_items
      join projects on projects.id = inventory_items.project_id
      where inventory_items.id = inventory_movements.item_id
        and projects.owner_id = auth.uid()
    )
  );

-- notes
create policy "owner full access" on notes
  for all using (
    exists (
      select 1 from projects
      where projects.id = notes.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- tasks
create policy "owner full access" on tasks
  for all using (
    exists (
      select 1 from projects
      where projects.id = tasks.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- ============================================================
-- STORAGE BUCKET: 'files' (Private)
-- Create the bucket manually in Supabase Dashboard:
--   Storage → New bucket → name: "files" → Private
-- Then run the policy below.
-- ============================================================

-- Allow authenticated owner to read/write their own files.
-- Path convention: files/{user_id}/{uuid}-{filename}
-- (Supabase storage policies use the storage schema)

create policy "owner upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
