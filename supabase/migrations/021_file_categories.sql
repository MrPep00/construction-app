-- 021: file categories (P6, D-031+)
-- Adds a category column to files for the project-level "Pliki" tab.
-- Categories: drawing | protocol | documentation | issue_photo | task_file.
-- Default 'documentation'. Backfill order is deliberate: issue_photo
-- first, then task_file — task_id wins on overlap. Pliki tab filters
-- category != 'task_file' (single predicate, no task_id checks).
-- Column add only — no RLS or constraint changes to files_one_target.

alter table public.files
  add column if not exists category text not null default 'documentation'
    check (category in ('drawing', 'protocol', 'documentation', 'issue_photo', 'task_file'));

update public.files
   set category = 'issue_photo'
 where issue_id is not null;

update public.files
   set category = 'task_file'
 where task_id is not null;

create index if not exists idx_files_category on public.files(category);