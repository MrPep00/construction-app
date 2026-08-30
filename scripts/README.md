# scripts/

One-off data operations for specific production instances. Not schema migrations.

**Convention (see DECISIONS.md D-022):**
- `supabase/migrations/` — schema changes (CREATE TABLE, ALTER, RLS, triggers). Portable. Auto-applied.
- `scripts/` — data operations tied to a specific database instance. Hardcoded UUIDs. Run manually.

Naming: `seed-<scope>.sql`, `cleanup-<scope>.sql`, `migrate-<scope>.ts`.

---

## Available scripts

### `seed-apartments-budynek-A.sql`

**Purpose:** Seeds 63 apartments (M1–M63) across floors 1–6 of the production "Budynek A" project.

**When to run:** Once, on the production database. UUIDs are hardcoded for this specific project — do not run on any other instance.

**How to run:**
1. Open Supabase Dashboard → SQL Editor.
2. Paste the full contents of `scripts/seed-apartments-budynek-A.sql`.
3. Click **Run**.
4. Verify the output table shows 6 rows with the expected counts.

**What it does:**
- Pre-flight check: verifies all 6 target floors and 6 parent "Mieszkania" folders exist (raises exception if not).
- Inserts apartments per floor with idempotency guard (NOT EXISTS on floor_id + parent_id + name).
- Floor 1: M1–M10 (10 apartments)
- Floor 2: M11–M21 (11 apartments)
- Floor 3: M22–M32 (11 apartments)
- Floor 4: M33–M43 (11 apartments)
- Floor 5: M44–M53 (10 apartments)
- Floor 6: M54–M63 (10 apartments)
- Verifies counts inside the transaction; rolls back on mismatch.
- Returns a result set showing floor, count, first, and last apartment name.

**Expected output:**

| floor | apartments_inserted | first | last |
|-------|--------------------:|-------|------|
| 1     | 10                  | M1    | M10  |
| 2     | 11                  | M11   | M21  |
| 3     | 11                  | M22   | M32  |
| 4     | 11                  | M33   | M43  |
| 5     | 10                  | M44   | M53  |
| 6     | 10                  | M54   | M63  |

**Rollback (if needed):**
```sql
DELETE FROM locations
WHERE type = 'apartment'
  AND floor_id IN (
    'd9d9ac70-d034-4a47-8942-9d6d7f9d73c6',
    'c68b2d08-75af-40fb-9e3a-6bedfa03f641',
    '503bcf66-f065-4e64-8e03-549a0a7fa9f0',
    'b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6',
    'f5125cd3-d724-48b3-9736-6855aeee87e0',
    'ecf158d9-d8f8-4024-a38d-f0325ee21f67'
  )
  AND name ~ '^M[0-9]+$';
```

---

### `rebuild-A-apartments.sql`

**Purpose:** PHASE A of the post-cascade-delete rebuild (2026-08-30). Re-creates the 63 lokale (M1–M63) on floors 1–6 after `projects`/`floors`/`locations`/`issues`/`tasks`/`notes` rows were lost. Portable rewrite of `seed-apartments-budynek-A.sql` — the old hardcoded floor/parent UUIDs died with the data.

**Before running:** edit the `SELECT set_config('app.project_name', 'Budynek A', true);` line near the top to the exact name of the project Gleb created in the app. It appears twice (once transaction-local, once for the post-COMMIT summary) — change both.

**How to run:**
1. Supabase Dashboard → SQL Editor.
2. Paste the full file.
3. Run. Check the result table shows 10/11/11/11/10/10 per level.

**What it does:**
- Resolves floors by `(project name, level 1..6, kind='floor')` and parents by `(floor_id, name='Lokale', parent_id IS NULL)`.
- Pre-flight: exactly 1 matching project, 6 floors, 6 `Lokale` root folders — `RAISE EXCEPTION` otherwise.
- Inserts 63 rows with `type='apartment'`, `unit_category='residential'`, `matrix_label` left NULL.
- `NOT EXISTS` guard on `(floor_id, parent_id, name)` — safe to re-run.
- Post-insert assertion inside the transaction; any per-level mismatch rolls the whole thing back.

**Safety:** INSERT only. No DELETE, no UPDATE, no DDL.

**Rollback (if needed):**
```sql
DELETE FROM locations l
USING floors f, projects p
WHERE l.floor_id = f.id
  AND f.project_id = p.id
  AND p.name = 'Budynek A'
  AND l.type = 'apartment'
  AND l.name ~ '^M[0-9]+$';
```

---

### `r2-inventory.ts`

**Purpose:** PHASE B of the post-cascade-delete rebuild. Lists the R2 bucket and proposes a recovery target for every object, so Phase C can generate `files` rows from an approved mapping.

**Safety:** STRICTLY READ-ONLY — the only R2 command imported is `ListObjectsV2Command`. No Supabase access at all. Writes only to `backups/` (gitignored).

**How to run:** `pnpm tsx scripts/r2-inventory.ts`

**Outputs:** `backups/r2-mapping-dryrun.md` (review table, also printed to stdout) and `backups/r2-mapping-dryrun.json` (consumed by Phase C).

**Mapping rules:**
- `{team}/floors/{floorId}/...` → new floor, matched via the six OLD floor UUIDs in the header of `seed-apartments-budynek-A.sql`. Unmatched old floor UUIDs are listed in report section 2b; add them to `EXTRA_FLOOR_TO_LEVEL` at the top of the script once the level is confirmed, then re-run.
- `{team}/projects/{projectId}/...` → project-level file.
- `{team}/{locationId}/...` and `{team}/tasks/{taskId}/...` → the old rows are gone, so these are recovered as project-level files, grouped by the old id (`G01`, `G02`, …) to keep each gallery coherent.
- Category: images → `documentation`; PDFs → `drawing` when floor-mapped, else `documentation`.

---

### `check-r2-orphans.ts`

Checks for files in the `files` table that no longer have a corresponding object in Cloudflare R2. Run with `npx tsx scripts/check-r2-orphans.ts`. Added during Module 9 (R2 migration).

### `setup-r2-cors.ts`

Configures CORS rules on the Cloudflare R2 bucket. Run once after creating the bucket or after changing allowed origins. Added during Module 9 (R2 migration).

---

### `rollback-018-task-location-scope.sql`

**Purpose:** Rolls back migration 018 (`018_task_location_scope.sql`) which added `location_id` to `tasks` and the `tasks_single_scope_check` constraint. The per-apartment task scoping was deferred (see DECISIONS.md D-023).

**When to run:** Already applied to production after migration 018 was rolled back. Do not re-run unless migration 018 is reapplied first.

**What it does:**
- Drops constraint `tasks_single_scope_check` (if exists).
- Drops column `tasks.location_id` (if exists).

**How to run:**
1. Open Supabase Dashboard → SQL Editor.
2. Paste the full contents of `scripts/rollback-018-task-location-scope.sql`.
3. Click **Run**.

**Rollback of rollback:** Re-apply `supabase/migrations/018_task_location_scope.sql` (if the file exists) or recreate manually: `ALTER TABLE tasks ADD COLUMN location_id uuid REFERENCES locations(id) ON DELETE CASCADE; ALTER TABLE tasks ADD CONSTRAINT tasks_single_scope_check CHECK (NOT (floor_id IS NOT NULL AND location_id IS NOT NULL));`
