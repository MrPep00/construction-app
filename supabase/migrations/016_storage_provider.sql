-- M9 Phase 1: add storage_provider column to files table.
-- Existing rows default to 'supabase' — no data loss, no behavior change.
-- New uploads after Phase 2 will have storage_provider='r2'.

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase'
    CHECK (storage_provider IN ('supabase', 'r2'));

CREATE INDEX IF NOT EXISTS idx_files_storage_provider
  ON public.files(storage_provider);
