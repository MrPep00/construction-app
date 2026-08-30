/**
 * r2-inventory.ts
 *
 * PHASE B of the post-cascade-delete rebuild (2026-08-30).
 *
 * STRICTLY READ-ONLY. The only R2 call it makes is ListObjectsV2.
 * It never writes to R2, never touches Supabase, and never writes
 * anywhere outside backups/ (gitignored).
 *
 * What it does
 *   1. Lists every object in the R2 bucket.
 *   2. Parses each key into { scope, oldId, filename, ext, size, lastModified }.
 *   3. Proposes a recovery target for each object:
 *        floor-scoped    -> new floor, matched by OLD floor UUID -> level
 *                           (the six UUIDs live in the header of
 *                            scripts/seed-apartments-budynek-A.sql)
 *        project-scoped  -> project-level file (all targets NULL, migration 022)
 *        location-scoped -> UNMAPPABLE individually. The old location UUIDs
 *                           died with the DB, so there is nothing to join to.
 *                           Recovered as project-level files, GROUPED by the
 *                           old-location prefix so the gallery stays coherent
 *                           and Gleb can re-file them by eye (Phase D).
 *        task-scoped     -> same treatment as location-scoped (tasks are gone).
 *   4. Prints a dry-run markdown table to stdout AND writes it to
 *      backups/r2-mapping-dryrun.md, plus a machine-readable
 *      backups/r2-mapping-dryrun.json that Phase C consumes.
 *
 * Nothing is executed against the database. Phase C turns the approved
 * JSON into a SQL file that Gleb runs himself (seed convention, D-022).
 *
 * Usage:
 *   pnpm tsx scripts/r2-inventory.ts
 */

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3"
import { mkdirSync, writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { config } from "dotenv"

config({ path: resolve(process.cwd(), ".env.local") })

// ─── Known OLD floor UUIDs -> level ──────────────────────────────────────────
// Source: header + pre-flight block of scripts/seed-apartments-budynek-A.sql.
// These rows no longer exist; the UUIDs survive only inside R2 object keys.

const OLD_FLOOR_TO_LEVEL: Record<string, number> = {
  "d9d9ac70-d034-4a47-8942-9d6d7f9d73c6": 1,
  "c68b2d08-75af-40fb-9e3a-6bedfa03f641": 2,
  "503bcf66-f065-4e64-8e03-549a0a7fa9f0": 3,
  "b8718e7c-a5de-407c-ad2c-2ada3cc0e0c6": 4,
  "f5125cd3-d724-48b3-9736-6855aeee87e0": 5,
  "ecf158d9-d8f8-4024-a38d-f0325ee21f67": 6,
}

// Old floor UUIDs OUTSIDE the six in the seed header (levels -2/-1/0/7 and
// zones) appear in no committed file. Report section 2b lists them with their
// filenames — the drawing names ("parter", "pi_tro_-2") say which level they
// are, but the script never infers a level on its own: a human confirms and
// the pair is recorded here. Confirmed by Gleb 2026-08-30.
const EXTRA_FLOOR_TO_LEVEL: Record<string, number> = {
  "1399c759-02c7-4bcc-b2ae-947f9653096d": 0, // rzut_parteru, parter_went/co/wod-kan
  "1c480e3c-77c3-4139-8657-0bc4135e6b26": -2, // gara_-2, fundamenty, pi_tro_-2
  "28fb4152-3776-446c-a86c-e610155177a9": -1, // gara_-1, pi_tro_-1 went/co/wod-kan
  "c30b485c-24f9-48f2-a62f-92bd3170a633": 7, // rzut_dachu, dach_went/wod-kan
}

function levelForOldFloor(oldId: string): number | undefined {
  return EXTRA_FLOOR_TO_LEVEL[oldId] ?? OLD_FLOOR_TO_LEVEL[oldId]
}

// ─── R2 (read-only client usage) ─────────────────────────────────────────────

function getEndpoint(): string {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT
  if (process.env.R2_ACCOUNT_ID) return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  throw new Error("R2_ENDPOINT or R2_ACCOUNT_ID not set — check .env.local")
}

const BUCKET = process.env.R2_BUCKET_NAME

function makeClient(): S3Client {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY not set — check .env.local")
  }
  return new S3Client({
    region: "auto",
    endpoint: getEndpoint(),
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })
}

type R2Object = { key: string; size: number; lastModified: string }

async function listAll(client: S3Client): Promise<R2Object[]> {
  const out: R2Object[] = []
  let token: string | undefined
  do {
    const resp = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET!, ContinuationToken: token })
    )
    for (const o of resp.Contents ?? []) {
      if (!o.Key || o.Key.endsWith("/")) continue
      out.push({
        key: o.Key,
        size: o.Size ?? 0,
        lastModified: (o.LastModified ?? new Date(0)).toISOString(),
      })
    }
    token = resp.IsTruncated ? resp.NextContinuationToken : undefined
  } while (token)
  return out
}

// ─── Key parsing ─────────────────────────────────────────────────────────────
//
// Upload paths minted by lib/actions/files.ts:
//   {teamId}/{locationId}/{uuid}-{filename}
//   {teamId}/floors/{floorId}/{uuid}-{filename}
//   {teamId}/projects/{projectId}/{uuid}-{filename}
//   {teamId}/tasks/{taskId}/{uuid}-{filename}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UUID_PREFIX_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i

type Scope = "floor" | "project" | "task" | "location" | "unknown"

type Parsed = {
  key: string
  size: number
  lastModified: string
  scope: Scope
  teamId: string | null
  oldId: string | null
  filename: string
  ext: string
}

function parseKey(o: R2Object): Parsed {
  const parts = o.key.split("/")
  const last = parts[parts.length - 1] ?? o.key
  const m = UUID_PREFIX_RE.exec(last)
  const filename = m ? m[1] : last
  const dot = filename.lastIndexOf(".")
  const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase() : ""

  const base = { key: o.key, size: o.size, lastModified: o.lastModified, filename, ext }

  // {teamId}/{floors|projects|tasks}/{id}/{uuid}-{filename} -> 4 segments
  if (parts.length === 4 && ["floors", "projects", "tasks"].includes(parts[1])) {
    const scope: Scope =
      parts[1] === "floors" ? "floor" : parts[1] === "projects" ? "project" : "task"
    return { ...base, scope, teamId: parts[0], oldId: parts[2] }
  }
  // {teamId}/{locationId}/{uuid}-{filename} -> 3 segments
  if (parts.length === 3 && UUID_RE.test(parts[1])) {
    return { ...base, scope: "location", teamId: parts[0], oldId: parts[1] }
  }
  return { ...base, scope: "unknown", teamId: parts[0] ?? null, oldId: null }
}

// ─── MIME from extension ─────────────────────────────────────────────────────
// Kept in sync with isAllowedFile() in lib/actions/files.ts.

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

function mimeFor(ext: string): string {
  return MIME[ext] ?? "application/octet-stream"
}

// ─── Mapping proposal ────────────────────────────────────────────────────────

type Target = { kind: "floor"; level: number } | { kind: "project" }

type Mapping = Parsed & {
  mime: string
  target: Target
  category: "drawing" | "documentation"
  group: string | null // old-location (G##) / old-task (T##) grouping label
  /** What goes into files.name. Grouped recoveries carry their group prefix so
   *  the flat project-level gallery still reads per dead lokal. */
  recoveredName: string
  note: string
}

function categoryFor(mime: string, targetIsFloor: boolean): "drawing" | "documentation" {
  if (mime.startsWith("image/")) return "documentation"
  if (mime === "application/pdf") return targetIsFloor ? "drawing" : "documentation"
  return "documentation"
}

function buildMappings(parsed: Parsed[]): Mapping[] {
  // Stable group labels: one per distinct old location/task id, numbered by
  // the earliest upload in that group so the gallery reads chronologically.
  // Locations get G##, tasks get T## — separate sequences, zero-padded.
  const groupIds = new Map<string, string>()

  function numberGroups(scope: "location" | "task", prefix: "G" | "T") {
    const firstSeen = new Map<string, string>()
    for (const p of parsed) {
      if (p.scope === scope && p.oldId) {
        const prev = firstSeen.get(p.oldId)
        if (!prev || p.lastModified < prev) firstSeen.set(p.oldId, p.lastModified)
      }
    }
    ;[...firstSeen.entries()]
      .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] < b[0] ? -1 : 1))
      .forEach(([id], i) => {
        groupIds.set(id, `${prefix}${String(i + 1).padStart(2, "0")}`)
      })
  }

  numberGroups("location", "G")
  numberGroups("task", "T")

  return parsed.map((p): Mapping => {
    const mime = mimeFor(p.ext)

    const mappedLevel = p.scope === "floor" && p.oldId ? levelForOldFloor(p.oldId) : undefined

    if (p.scope === "floor" && p.oldId && mappedLevel !== undefined) {
      const level = mappedLevel
      return {
        ...p,
        mime,
        target: { kind: "floor", level },
        category: categoryFor(mime, true),
        group: null,
        recoveredName: p.filename,
        note: `old floor ${p.oldId.slice(0, 8)} -> level ${level}`,
      }
    }

    if (p.scope === "floor") {
      return {
        ...p,
        mime,
        target: { kind: "project" },
        category: categoryFor(mime, false),
        group: null,
        recoveredName: p.filename,
        note: "floor-scoped, but the old floor UUID is not a known one (level -2/-1/0/7 or a zone) — recovered as a project file unless a level is supplied in EXTRA_FLOOR_TO_LEVEL",
      }
    }

    if (p.scope === "project") {
      return {
        ...p,
        mime,
        target: { kind: "project" },
        category: categoryFor(mime, false),
        group: null,
        recoveredName: p.filename,
        note: "already project-scoped",
      }
    }

    if ((p.scope === "location" || p.scope === "task") && p.oldId) {
      const g = groupIds.get(p.oldId) ?? null
      return {
        ...p,
        mime,
        target: { kind: "project" },
        category: categoryFor(mime, false),
        group: g,
        recoveredName: g ? `[${g}] ${p.filename}` : p.filename,
        note: `old ${p.scope} ${p.oldId.slice(0, 8)} is gone — recovered as a project file, group ${g}`,
      }
    }

    return {
      ...p,
      mime,
      target: { kind: "project" },
      category: categoryFor(mime, false),
      group: null,
      recoveredName: p.filename,
      note: "UNRECOGNISED key shape — review before approving",
    }
  })
}

// ─── Report ──────────────────────────────────────────────────────────────────

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function targetLabel(m: Mapping): string {
  if (m.target.kind === "floor") return `floor level ${m.target.level}`
  return m.group ? `project file (group ${m.group})` : "project file"
}

function md(mappings: Mapping[]): string {
  const L: string[] = []
  const total = mappings.length
  const bytes = mappings.reduce((s, m) => s + m.size, 0)

  L.push("# R2 mapping — DRY RUN (Phase B)")
  L.push("")
  L.push(`Generated: ${new Date().toISOString()}`)
  L.push(`Bucket: \`${BUCKET}\``)
  L.push(`Objects: **${total}** · Total size: **${human(bytes)}**`)
  L.push("")
  L.push("Nothing has been written. Review the proposals below; Phase C generates")
  L.push("a SQL file from the approved set for you to run in the SQL Editor.")
  L.push("")

  L.push("## 1. Objects by parsed scope")
  L.push("")
  L.push("| scope | objects | size |")
  L.push("|---|---:|---:|")
  for (const scope of ["floor", "location", "project", "task", "unknown"] as Scope[]) {
    const rows = mappings.filter((m) => m.scope === scope)
    if (rows.length === 0) continue
    L.push(`| ${scope} | ${rows.length} | ${human(rows.reduce((s, m) => s + m.size, 0))} |`)
  }
  L.push("")

  const floorRows = mappings.filter((m) => m.target.kind === "floor")
  L.push("## 2. Floor-scoped keys mapped to a new floor")
  L.push("")
  if (floorRows.length === 0) {
    L.push("_None._")
  } else {
    L.push("| old floor UUID | new level | objects | size |")
    L.push("|---|---:|---:|---:|")
    const byOld = new Map<string, Mapping[]>()
    for (const m of floorRows) {
      const k = m.oldId ?? "?"
      byOld.set(k, [...(byOld.get(k) ?? []), m])
    }
    for (const [oldId, rows] of [...byOld.entries()].sort(
      (a, b) => (levelForOldFloor(a[0]) ?? 0) - (levelForOldFloor(b[0]) ?? 0)
    )) {
      L.push(
        `| \`${oldId}\` | ${levelForOldFloor(oldId)} | ${rows.length} | ${human(
          rows.reduce((s, m) => s + m.size, 0)
        )} |`
      )
    }
  }
  L.push("")

  // Floor-scoped but unmatched — the actionable one.
  const unmatchedFloor = mappings.filter(
    (m) => m.scope === "floor" && m.target.kind !== "floor"
  )
  L.push("## 2b. Floor-scoped keys whose old floor UUID is UNKNOWN — decision needed")
  L.push("")
  if (unmatchedFloor.length === 0) {
    L.push("_None — every floor-scoped key matched a known old floor._")
  } else {
    L.push("Only six old floor UUIDs survive (levels 1-6, from the seed header).")
    L.push("These keys belong to floors outside that set — levels -2/-1/0/7 or a zone.")
    L.push("The filenames usually say which. **Tell Claude the level per UUID** and it goes")
    L.push("into `EXTRA_FLOOR_TO_LEVEL` at the top of this script; re-running then maps them")
    L.push("to a real floor. Left as-is they land at project level, which loses the floor.")
    L.push("")
    L.push("| old floor UUID | objects | size | filenames |")
    L.push("|---|---:|---:|---|")
    const byOld = new Map<string, Mapping[]>()
    for (const m of unmatchedFloor) {
      const k = m.oldId ?? "?"
      byOld.set(k, [...(byOld.get(k) ?? []), m])
    }
    for (const [oldId, rows] of byOld.entries()) {
      const names = rows
        .map((r) => r.filename)
        .sort()
        .join("<br>")
      L.push(
        `| \`${oldId}\` | ${rows.length} | ${human(
          rows.reduce((s, m) => s + m.size, 0)
        )} | ${names} |`
      )
    }
  }
  L.push("")

  const grouped = mappings.filter((m) => m.group)
  L.push("## 3. Unmappable groups (old location/task deleted)")
  L.push("")
  L.push("These become project-level files (all targets NULL, migration 022).")
  L.push("The group label preserves which old location/task the photos belonged to,")
  L.push("so the gallery stays coherent as a memory aid for Phase D.")
  L.push("")
  if (grouped.length === 0) {
    L.push("_None._")
  } else {
    L.push("| group | old id | scope | objects | size | first upload | last upload |")
    L.push("|---|---|---|---:|---:|---|---|")
    const byGroup = new Map<string, Mapping[]>()
    for (const m of grouped) byGroup.set(m.group!, [...(byGroup.get(m.group!) ?? []), m])
    for (const [g, rows] of [...byGroup.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const dates = rows.map((r) => r.lastModified).sort()
      L.push(
        `| ${g} | \`${rows[0].oldId}\` | ${rows[0].scope} | ${rows.length} | ${human(
          rows.reduce((s, m) => s + m.size, 0)
        )} | ${dates[0].slice(0, 10)} | ${dates[dates.length - 1].slice(0, 10)} |`
      )
    }
  }
  L.push("")

  L.push("## 4. Proposed categories")
  L.push("")
  L.push("| category | objects |")
  L.push("|---|---:|")
  for (const c of ["drawing", "documentation"] as const) {
    const n = mappings.filter((m) => m.category === c).length
    if (n) L.push(`| ${c} | ${n} |`)
  }
  L.push("")

  L.push("## 5. Every object")
  L.push("")
  L.push("| # | key | proposed target | category | mime | size | uploaded |")
  L.push("|---:|---|---|---|---|---:|---|")
  const sorted = [...mappings].sort((a, b) => {
    const ta = targetLabel(a)
    const tb = targetLabel(b)
    if (ta !== tb) return ta < tb ? -1 : 1
    return a.lastModified < b.lastModified ? -1 : 1
  })
  sorted.forEach((m, i) => {
    L.push(
      `| ${i + 1} | \`${m.key}\` | ${targetLabel(m)} | ${m.category} | ${m.mime} | ${human(
        m.size
      )} | ${m.lastModified.slice(0, 10)} |`
    )
  })
  L.push("")

  const weird = mappings.filter(
    (m) => m.scope === "unknown" || m.mime === "application/octet-stream"
  )
  L.push("## 6. Needs your eyes")
  L.push("")
  if (weird.length === 0) {
    L.push("_Nothing unusual._")
  } else {
    L.push("| key | why |")
    L.push("|---|---|")
    for (const m of weird) {
      const why =
        m.scope === "unknown"
          ? "unrecognised key shape"
          : `unknown extension \`${m.ext || "(none)"}\` — mime falls back to octet-stream`
      L.push(`| \`${m.key}\` | ${why} |`)
    }
  }
  L.push("")
  L.push("---")
  L.push("")
  L.push("**To reject an object**, delete its entry from")
  L.push("`backups/r2-mapping-dryrun.json` (or tell Claude which keys to drop)")
  L.push("before Phase C generates the SQL.")
  L.push("")

  return L.join("\n")
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!BUCKET) {
    console.error("R2_BUCKET_NAME not set — check .env.local")
    process.exit(1)
  }

  console.log("\nPHASE B — read-only R2 inventory (ListObjectsV2 only)")
  console.log(`Bucket: ${BUCKET}\n`)

  const client = makeClient()
  const objects = await listAll(client)
  console.log(`Listed ${objects.length} objects.\n`)

  const mappings = buildMappings(objects.map(parseKey))
  const report = md(mappings)

  console.log(report)

  const mdPath = resolve(process.cwd(), "backups/r2-mapping-dryrun.md")
  const jsonPath = resolve(process.cwd(), "backups/r2-mapping-dryrun.json")
  mkdirSync(dirname(mdPath), { recursive: true })
  writeFileSync(mdPath, report, "utf-8")
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        bucket: BUCKET,
        objectCount: mappings.length,
        oldFloorToLevel: OLD_FLOOR_TO_LEVEL,
        mappings,
      },
      null,
      2
    ),
    "utf-8"
  )

  console.log("\nWritten (gitignored):")
  console.log(`  ${mdPath}`)
  console.log(`  ${jsonPath}`)
  console.log("\nNo writes to R2. No writes to the database. Review, then approve Phase C.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
