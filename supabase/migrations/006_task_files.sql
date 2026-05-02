-- Add task_id to files so files can be attached to tasks
alter table files add column if not exists task_id uuid references tasks(id) on delete cascade;
create index if not exists files_task_id_idx on files(task_id);

-- Replace the old XOR constraint (location_id vs floor_id) with one that also allows task_id
alter table files drop constraint if exists files_location_xor_floor;
alter table files add constraint files_one_target check (
  (location_id is not null)::int +
  (floor_id    is not null)::int +
  (task_id     is not null)::int = 1
);

-- Update RLS to cover task-level files
drop policy if exists "owner full access" on files;
create policy "owner full access" on files
  for all using (
    (
      location_id is not null and
      exists (
        select 1 from locations
        join floors   on floors.id   = locations.floor_id
        join projects on projects.id = floors.project_id
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
    ) or (
      task_id is not null and
      exists (
        select 1 from tasks
        join projects on projects.id = tasks.project_id
        where tasks.id = files.task_id
          and projects.owner_id = auth.uid()
      )
    )
  );
