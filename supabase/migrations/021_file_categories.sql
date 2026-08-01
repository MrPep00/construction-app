-- 021: file categories (P6, D-031+)
-- Adds a category column to files for the project-level "Pliki" tab.
-- Categories: drawing | protocol | documentation | issue_photo.
-- Default 'documentation'; existing issue-tagged photos backfilled to
-- 'issue_photo'. Task-attached files keep 'documentation' (they are
-- excluded from the Pliki tab listing at query level, not in the DB).
-- Column add only — no RLS or constraint changes to files_one_target.

alter table public.files
  add column if not exists category text not null default 'documentation'
    check (category in ('drawing', 'protocol', 'documentation', 'issue_photo'));

-- Backfill: any file tagged to an issue is an issue photo.
update public.files
   set category = 'issue_photo'
 where issue_id is not null;

-- The Pliki tab filters by category per floor/project; index supports it.
create index if not exists idx_files_category on public.files(category);
