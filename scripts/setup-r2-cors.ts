/**
 * One-time script: set CORS policy on R2 bucket.
 * Run once locally: pnpm tsx scripts/setup-r2-cors.ts
 * Requires R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME in .env.local
 */
import "dotenv/config"
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3"

function getR2Endpoint(): string {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT
  if (process.env.R2_ACCOUNT_ID) return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  throw new Error("R2_ENDPOINT or R2_ACCOUNT_ID required")
}

const client = new S3Client({
  region: "auto",
  endpoint: getR2Endpoint(),
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const bucket = process.env.R2_BUCKET_NAME
if (!bucket) throw new Error("R2_BUCKET_NAME required")

const corsConfig = {
  CORSRules: [
    {
      AllowedOrigins: ["*"],
      AllowedMethods: ["GET", "PUT", "DELETE", "HEAD"] as ("GET" | "PUT" | "DELETE" | "HEAD" | "POST")[],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600,
    },
  ],
}

async function main() {
  console.log(`Setting CORS on bucket: ${bucket}`)
  await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: corsConfig }))
  console.log("CORS set. Verifying...")

  const { CORSRules } = await client.send(new GetBucketCorsCommand({ Bucket: bucket }))
  console.log("Current CORS rules:", JSON.stringify(CORSRules, null, 2))
  console.log("Done.")
}

main().catch((e) => { console.error(e); process.exit(1) })
