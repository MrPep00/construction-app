/**
 * check-r2-orphans.ts
 *
 * Lists all objects in the R2 bucket and compares against the `files` table
 * to identify orphaned R2 objects (in bucket but not in DB).
 *
 * Usage:
 *   pnpm tsx scripts/check-r2-orphans.ts
 *
 * Optional — pass DB results directly (avoids needing service role key):
 *   1. Run the SQL below in Supabase SQL Editor, save result as JSON
 *   2. pnpm tsx scripts/check-r2-orphans.ts --db-json path/to/result.json
 *
 * SQL to run in Supabase SQL Editor:
 *   SELECT storage_path FROM files WHERE storage_provider = 'r2';
 *   (Export as JSON)
 *
 * Optional env var SUPABASE_SERVICE_ROLE_KEY — if set, the script queries
 * the DB directly (bypasses RLS). Add to .env.local temporarily if needed.
 */

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3"
import { readFileSync, existsSync } from "fs"
import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") })

// ─── R2 setup ────────────────────────────────────────────────────────────────

function getEndpoint(): string {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT
  if (process.env.R2_ACCOUNT_ID) return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  throw new Error("R2_ENDPOINT or R2_ACCOUNT_ID not set")
}

const r2 = new S3Client({
  region: "auto",
  endpoint: getEndpoint(),
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
})

const BUCKET = process.env.R2_BUCKET_NAME!

// ─── List all R2 objects ─────────────────────────────────────────────────────

async function listAllR2Objects(): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined

  do {
    const resp = await r2.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        ContinuationToken: continuationToken,
      })
    )
    for (const obj of resp.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined
  } while (continuationToken)

  return keys
}

// ─── Fetch DB paths ───────────────────────────────────────────────────────────

async function fetchDbPaths(): Promise<string[] | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceKey || !url) return null

  const admin = createClient(url, serviceKey)
  const { data, error } = await admin.from("files").select("storage_path").eq("storage_provider", "r2")
  if (error) {
    console.error("DB query error:", error.message)
    return null
  }
  return data.map((r: { storage_path: string }) => r.storage_path)
}

// ─── Load DB paths from JSON file ────────────────────────────────────────────

function loadDbPathsFromFile(filePath: string): string[] {
  const raw = readFileSync(filePath, "utf-8")
  const parsed = JSON.parse(raw)
  // Accept either [{storage_path: "..."}, ...] or ["...", ...]
  if (Array.isArray(parsed)) {
    if (typeof parsed[0] === "string") return parsed
    if (typeof parsed[0] === "object" && "storage_path" in parsed[0]) {
      return parsed.map((r: { storage_path: string }) => r.storage_path)
    }
  }
  throw new Error("Unexpected JSON format — expected array of strings or [{storage_path}]")
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dbJsonFlag = process.argv.indexOf("--db-json")
  const dbJsonPath = dbJsonFlag !== -1 ? process.argv[dbJsonFlag + 1] : undefined

  if (!BUCKET) {
    console.error("R2_BUCKET_NAME not set")
    process.exit(1)
  }

  console.log(`\nListing objects in bucket: ${BUCKET}`)
  console.log("─".repeat(60))

  const r2Keys = await listAllR2Objects()
  console.log(`R2 objects found: ${r2Keys.length}`)

  // ─── DB paths ───────────────────────────────────────────────────────────

  let dbPaths: string[] | null = null

  if (dbJsonPath) {
    if (!existsSync(dbJsonPath)) {
      console.error(`File not found: ${dbJsonPath}`)
      process.exit(1)
    }
    dbPaths = loadDbPathsFromFile(dbJsonPath)
    console.log(`DB paths loaded from file: ${dbPaths.length}`)
  } else {
    dbPaths = await fetchDbPaths()
    if (dbPaths !== null) {
      console.log(`DB paths fetched via service role: ${dbPaths.length}`)
    }
  }

  // ─── Report ─────────────────────────────────────────────────────────────

  console.log("\n" + "═".repeat(60))
  console.log("REPORT")
  console.log("═".repeat(60))
  console.log(`Total R2 objects:  ${r2Keys.length}`)

  if (r2Keys.length > 0) {
    console.log("\nAll R2 object keys:")
    for (const k of r2Keys) console.log(`  ${k}`)
  }

  if (dbPaths === null) {
    console.log("\n" + "─".repeat(60))
    console.log("DB comparison skipped — no SUPABASE_SERVICE_ROLE_KEY and no --db-json")
    console.log("\nTo compare with DB, run this SQL in Supabase SQL Editor:")
    console.log("─".repeat(60))
    console.log("  SELECT storage_path FROM files WHERE storage_provider = 'r2';")
    console.log("─".repeat(60))
    console.log("\nThen rerun with:")
    console.log("  pnpm tsx scripts/check-r2-orphans.ts --db-json <path-to-exported-json>")
    console.log("\nOR add SUPABASE_SERVICE_ROLE_KEY to .env.local and rerun.")
    return
  }

  const dbSet = new Set(dbPaths)
  const r2Set = new Set(r2Keys)

  const orphans = r2Keys.filter((k) => !dbSet.has(k))
  const missing = dbPaths.filter((p) => !r2Set.has(p))

  console.log(`Total DB rows (r2): ${dbPaths.length}`)
  console.log(`Orphaned R2 objects (in bucket, not in DB): ${orphans.length}`)
  console.log(`Missing R2 objects (in DB, not in bucket):  ${missing.length}`)

  if (orphans.length > 0) {
    console.log("\nOrphaned keys:")
    for (const k of orphans) console.log(`  ${k}`)
  }

  if (missing.length > 0) {
    console.log("\n⚠ Missing from R2 (data integrity issue):")
    for (const k of missing) console.log(`  ${k}`)
  }

  if (orphans.length === 0 && missing.length === 0) {
    console.log("\nR2 bucket and DB are in sync. No action needed.")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
