/**
 * generate-rebuild-B-files.ts
 *
 * PHASE C generator of the post-cascade-delete rebuild (2026-08-30).
 *
 * Reads the APPROVED mapping from backups/r2-mapping-dryrun.json (produced by
 * scripts/r2-inventory.ts) and emits scripts/rebuild-B-files.sql — the INSERT-only
 * seed that Gleb runs himself in the Supabase SQL Editor (D-022).
 *
 * This generator touches nothing but the local filesystem: no R2 call, no
 * database connection. Re-running it after editing the JSON (to drop rejected
 * keys) regenerates the SQL deterministically.
 *
 * Usage:
 *   pnpm tsx scripts/generate-rebuild-B-files.ts
 *   pnpm tsx scripts/generate-rebuild-B-files.ts --project "Budynek A"
 */

import { readFileSync, writeFileSync } from "fs"
import { resolve } from "path"

type Target = { kind: "floor"; level: number } | { kind: "project" }

type Mapping = {
  key: string
  size: number
  lastModified: string
  scope: string
  oldId: string | null
  filename: string
  ext: string
  mime: string
  target: Target
  category: "drawing" | "documentation"
  group: string | null
  recoveredName: string
}

const INCIDENT_DATE = "2026-08-30"

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

/** Postgres string literal — double every embedded quote, nothing else. */
function lit(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

function main() {
  const projectName = arg("project", "Budynek A")
  const jsonPath = resolve(process.cwd(), "backups/r2-mapping-dryrun.json")
  const outPath = resolve(process.cwd(), "scripts/rebuild-B-files.sql")

  const parsed = JSON.parse(readFileSync(jsonPath, "utf-8")) as {
    generatedAt: string
    bucket: string
    mappings: Mapping[]
  }
  const rows = parsed.mappings

  if (rows.length === 0) {
    console.error("No mappings in the JSON — nothing to generate.")
    process.exit(1)
  }

  // ── Sanity checks on the approved set ────────────────────────────────────
  const keys = new Set(rows.map((r) => r.key))
  if (keys.size !== rows.length) {
    console.error(`Duplicate storage_path in the mapping: ${rows.length - keys.size}. Aborting.`)
    process.exit(1)
  }
  const badName = rows.find((r) => !r.recoveredName || r.recoveredName.trim() === "")
  if (badName) {
    console.error(`Empty recoveredName for key ${badName.key}. Aborting.`)
    process.exit(1)
  }

  // ── Expected counts, baked into the SQL as assertions ────────────────────
  const floorRows = rows.filter((r) => r.target.kind === "floor")
  const projectRows = rows.filter((r) => r.target.kind === "project")
  const levels = [...new Set(floorRows.map((r) => (r.target as { level: number }).level))].sort(
    (a, b) => a - b
  )
  const perLevel = new Map<number, number>()
  for (const r of floorRows) {
    const l = (r.target as { level: number }).level
    perLevel.set(l, (perLevel.get(l) ?? 0) + 1)
  }
  const groupCount = new Set(rows.filter((r) => r.group).map((r) => r.group)).size

  // ── VALUES rows, ordered so the file reads floor-by-floor then groups ────
  const sorted = [...rows].sort((a, b) => {
    const al = a.target.kind === "floor" ? a.target.level : 999
    const bl = b.target.kind === "floor" ? b.target.level : 999
    if (al !== bl) return al - bl
    const ag = a.group ?? ""
    const bg = b.group ?? ""
    if (ag !== bg) return ag < bg ? -1 : 1
    return a.lastModified < b.lastModified ? -1 : 1
  })

  // The first VALUES row fixes the column types for the whole list, so it
  // carries explicit casts (a bare NULL there would type the column as text).
  const valueLines = sorted.map((r, i) => {
    const first = i === 0
    const level = r.target.kind === "floor" ? `${r.target.level}` : "NULL"
    return (
      `    (${lit(r.key)}, ${lit(r.recoveredName)}, ${lit(r.mime)}, ${lit(r.category)}, ` +
      `${level}${first ? "::int" : ""}, ${r.size}${first ? "::bigint" : ""}, ` +
      `${lit(r.lastModified)}${first ? "::timestamptz" : ""})`
    )
  })

  const perLevelAsserts = levels.map((l) => `      (${l}, ${perLevel.get(l)})`).join(",\n")

  const gGroups = [...new Set(rows.filter((r) => r.group?.startsWith("G")).map((r) => r.group!))].sort()
  const tGroups = [...new Set(rows.filter((r) => r.group?.startsWith("T")).map((r) => r.group!))].sort()
  const groupRange = [
    gGroups.length ? `[${gGroups[0]}]..[${gGroups[gGroups.length - 1]}]` : null,
    tGroups.length ? `[${tGroups[0]}]..[${tGroups[tGroups.length - 1]}]` : null,
  ]
    .filter(Boolean)
    .join(", ")

  const sql = `-- ============================================================
-- rebuild-B-files.sql
-- Generated ${new Date().toISOString().slice(0, 10)} by scripts/generate-rebuild-B-files.ts
-- DO NOT EDIT BY HAND — regenerate from backups/r2-mapping-dryrun.json.
--
-- Recovered after the ${INCIDENT_DATE} cascade incident. The group prefixes in
-- files.name (${groupRange}) are DEAD LOCATION IDS: the locations and tasks
-- those photos hung off were deleted, so the rows come back as project-level
-- files and the prefix is the only surviving link between a photo and the lokal
-- it came from. Which prefix means which old UUID is recorded in the mapping at
-- backups/r2-mapping-dryrun.md.
--
-- PHASE C of the rebuild. Phase A (scripts/rebuild-A-apartments.sql) restored
-- the 63 lokale. Phase D — re-entering issues by hand, using the recovered
-- gallery as a memory aid — is manual and is NOT covered here.
--
-- Safety   : INSERT ONLY. No DELETE, no UPDATE, no DDL, no R2 access.
--            Single transaction. Every row is guarded by NOT EXISTS on
--            storage_path, so re-running inserts nothing twice.
--            Aborts (and rolls back everything) on any assertion failure.
--
-- How to run : Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Why scripts/ not migrations/ : DECISIONS.md D-022.
--
-- >>> BEFORE RUNNING: set the project name on the SELECT set_config line
-- >>> below (two places) to the project you created in the app.
--
-- Source bucket : ${parsed.bucket}
-- Inventory run : ${parsed.generatedAt}
-- Objects       : ${rows.length}
--   -> floor-level files : ${floorRows.length} (levels ${levels.join(", ")})
--   -> project-level     : ${projectRows.length} (${groupCount} recovery groups + already-project-scoped)
--
-- Column choices
--   storage_provider : 'r2' for every row (migration 016)
--   storage_path     : the R2 key, verbatim — this is what resolveFileUrls() signs
--   project_id       : always set (migration 022); floor_id set only where the
--                      old floor UUID resolved to a level
--   location_id / task_id / issue_id : always NULL — those parents are gone
--   name             : original filename, group-prefixed for recovered files
--   created_at       : the R2 object's LastModified, so the gallery keeps its
--                      real chronology instead of collapsing to today
--   uploaded_by      : the team creator (teams.created_by) — the true uploader
--                      is not recorded anywhere in R2
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Target project name.  EDIT THIS LINE.
-- ============================================================

SELECT set_config('app.project_name', ${lit(projectName)}, true);

-- ============================================================
-- 1. Pre-flight
-- ============================================================

DO $$
DECLARE
  v_name        text := current_setting('app.project_name');
  v_project_cnt integer;
  v_project_id  uuid;
  v_uploader    uuid;
  v_missing     text;
  v_existing    integer;
BEGIN
  SELECT count(*) INTO v_project_cnt FROM projects WHERE name = v_name;

  IF v_project_cnt = 0 THEN
    RAISE EXCEPTION
      'Pre-flight FAILED: no project named %. Fix the set_config line at the top.', v_name;
  ELSIF v_project_cnt > 1 THEN
    RAISE EXCEPTION
      'Pre-flight FAILED: % projects named % - ambiguous target, refusing to guess.',
      v_project_cnt, v_name;
  END IF;

  SELECT id INTO v_project_id FROM projects WHERE name = v_name;

  SELECT t.created_by INTO v_uploader
  FROM projects p JOIN teams t ON t.id = p.team_id
  WHERE p.id = v_project_id;

  IF v_uploader IS NULL THEN
    RAISE EXCEPTION
      'Pre-flight FAILED: cannot resolve an uploader (teams.created_by) for project %.', v_name;
  END IF;

  -- Every level referenced by a floor-scoped file must exist as a real floor,
  -- otherwise that file would silently fall through to project level.
  SELECT string_agg(x.level::text, ', ' ORDER BY x.level) INTO v_missing
  FROM (VALUES
${levels.map((l) => `    (${l})`).join(",\n")}
  ) AS x(level)
  WHERE NOT EXISTS (
    SELECT 1 FROM floors f
    WHERE f.project_id = v_project_id AND f.kind = 'floor' AND f.level = x.level
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'Pre-flight FAILED: project % has no floor at level(s) %. Expected the seeding trigger to create -2..7.',
      v_name, v_missing;
  END IF;

  SELECT count(*) INTO v_existing FROM files WHERE project_id = v_project_id;

  RAISE NOTICE 'Pre-flight OK: project % (%), uploader %, % files already present.',
    v_name, v_project_id, v_uploader, v_existing;
END $$;

-- ============================================================
-- 2. Insert ${rows.length} file rows
--    level = NULL  -> project-level file (all targets NULL, migration 022)
--    level = <int> -> floor-level file on that floor
-- ============================================================

WITH src (storage_path, name, mime_type, category, level, size_bytes, created_at) AS (
  VALUES
${valueLines.join(",\n")}
),
ctx AS (
  SELECT p.id AS project_id, t.created_by AS uploader
  FROM projects p
  JOIN teams t ON t.id = p.team_id
  WHERE p.name = current_setting('app.project_name')
)
INSERT INTO files (
  project_id, location_id, floor_id, task_id, issue_id,
  name, storage_path, mime_type, size_bytes,
  uploaded_by, created_at, storage_provider, category
)
SELECT
  ctx.project_id,
  NULL::uuid,   -- location_id: the old location is gone
  f.id,         -- floor_id: NULL for project-level rows (src.level was NULL)
  NULL::uuid,   -- task_id: the old task is gone
  NULL::uuid,   -- issue_id
  src.name,
  src.storage_path,
  src.mime_type,
  src.size_bytes,
  ctx.uploader,
  src.created_at,
  'r2',
  src.category
FROM src
CROSS JOIN ctx
LEFT JOIN floors f
  ON src.level IS NOT NULL
 AND f.project_id = ctx.project_id
 AND f.kind = 'floor'
 AND f.level = src.level
WHERE NOT EXISTS (
  SELECT 1 FROM files x WHERE x.storage_path = src.storage_path
);

-- ============================================================
-- 3. Post-insert assertions (inside the transaction - rolls back on mismatch)
-- ============================================================

DO $$
DECLARE
  v_name    text := current_setting('app.project_name');
  v_project uuid;
  v_total   integer;
  v_floor   integer;
  v_proj    integer;
  v_nonr2   integer;
  r         record;
BEGIN
  SELECT id INTO v_project FROM projects WHERE name = v_name;

  SELECT count(*) INTO v_total FROM files WHERE project_id = v_project;
  IF v_total <> ${rows.length} THEN
    RAISE EXCEPTION
      'Verification FAILED: expected ${rows.length} files for project %, found %. Rolling back.',
      v_name, v_total;
  END IF;

  SELECT count(*) INTO v_floor FROM files WHERE project_id = v_project AND floor_id IS NOT NULL;
  IF v_floor <> ${floorRows.length} THEN
    RAISE EXCEPTION
      'Verification FAILED: expected ${floorRows.length} floor-level files, found %. Rolling back.', v_floor;
  END IF;

  SELECT count(*) INTO v_proj
  FROM files
  WHERE project_id = v_project
    AND floor_id IS NULL AND location_id IS NULL AND task_id IS NULL;
  IF v_proj <> ${projectRows.length} THEN
    RAISE EXCEPTION
      'Verification FAILED: expected ${projectRows.length} project-level files, found %. Rolling back.', v_proj;
  END IF;

  SELECT count(*) INTO v_nonr2
  FROM files WHERE project_id = v_project AND storage_provider <> 'r2';
  IF v_nonr2 <> 0 THEN
    RAISE EXCEPTION
      'Verification FAILED: % rows are not storage_provider=r2. Rolling back.', v_nonr2;
  END IF;

  -- Per-level distribution must match the approved mapping exactly.
  FOR r IN
    SELECT x.level, x.expected, count(fi.id) AS actual
    FROM (VALUES
${perLevelAsserts}
    ) AS x(level, expected)
    JOIN floors f
      ON f.project_id = v_project AND f.kind = 'floor' AND f.level = x.level
    LEFT JOIN files fi ON fi.floor_id = f.id
    GROUP BY x.level, x.expected
  LOOP
    IF r.actual <> r.expected THEN
      RAISE EXCEPTION
        'Verification FAILED on level %: expected % files, found %. Rolling back.',
        r.level, r.expected, r.actual;
    END IF;
  END LOOP;

  RAISE NOTICE 'Verification OK: ${rows.length} files (${floorRows.length} floor-level, ${projectRows.length} project-level).';
END $$;

COMMIT;

-- ============================================================
-- 4. Result summary (runs after COMMIT)
--    Re-set the name here too - set_config above was transaction-local.
-- ============================================================

SELECT set_config('app.project_name', ${lit(projectName)}, false);

SELECT
  COALESCE('level ' || f.level::text, 'project level') AS target,
  count(*)                                             AS files,
  count(*) FILTER (WHERE fi.category = 'drawing')      AS drawings,
  count(*) FILTER (WHERE fi.category = 'documentation') AS documentation,
  pg_size_pretty(sum(fi.size_bytes))                   AS size
FROM files fi
JOIN projects p ON p.id = fi.project_id AND p.name = current_setting('app.project_name')
LEFT JOIN floors f ON f.id = fi.floor_id
GROUP BY f.level
ORDER BY f.level NULLS LAST;

-- Recovery groups, so the [G##] prefixes are greppable straight from the DB.
SELECT
  substring(fi.name from '^\\[([GT][0-9]+)\\]') AS recovery_group,
  count(*)                                     AS files,
  min(fi.created_at)::date                     AS first_upload,
  max(fi.created_at)::date                     AS last_upload
FROM files fi
JOIN projects p ON p.id = fi.project_id AND p.name = current_setting('app.project_name')
WHERE fi.name ~ '^\\[[GT][0-9]+\\]'
GROUP BY 1
ORDER BY 1;
`

  writeFileSync(outPath, sql, "utf-8")

  console.log(`Generated ${outPath}`)
  console.log(`  rows            : ${rows.length}`)
  console.log(`  floor-level     : ${floorRows.length} across levels ${levels.join(", ")}`)
  console.log(`  project-level   : ${projectRows.length}`)
  console.log(`  recovery groups : ${groupCount}`)
  console.log(`  project name    : ${projectName}`)
  console.log("\nNothing was executed. Review the SQL, then run it in the Supabase SQL Editor.")
}

main()
