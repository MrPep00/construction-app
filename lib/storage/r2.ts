import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

/**
 * Resolve R2 endpoint URL from env vars.
 * Accepts either:
 *   R2_ENDPOINT = https://abc123.r2.cloudflarestorage.com   (full URL — preferred)
 *   R2_ACCOUNT_ID = abc123                                   (legacy, constructs URL)
 */
function getR2Endpoint(): string | undefined {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT
  if (process.env.R2_ACCOUNT_ID) return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  return undefined
}

export function isR2Configured(): boolean {
  return Boolean(
    getR2Endpoint() &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  )
}

function getClient(): S3Client {
  const endpoint = getR2Endpoint()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 env vars missing: R2_ENDPOINT (or R2_ACCOUNT_ID), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY")
  }
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  })
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME
  if (!bucket) throw new Error("R2_BUCKET_NAME env var missing")
  return bucket
}

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<{ key: string }> {
  const client = getClient()
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )
  return { key }
}

export async function deleteFromR2(key: string): Promise<void> {
  const client = getClient()
  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  )
}

export async function getR2SignedUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const client = getClient()
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn }
  )
}

/** Only callable when R2_PUBLIC_URL is set (public bucket with custom domain). */
export function getR2PublicUrl(key: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL
  if (!publicUrl) throw new Error("R2_PUBLIC_URL not configured — use getR2SignedUrl instead")
  return `${publicUrl.replace(/\/$/, "")}/${key}`
}

/**
 * Generate a presigned PUT URL so the browser can upload directly to R2.
 * The caller (Server Action) returns this URL to the client.
 * Client does: fetch(signedPutUrl, { method: 'PUT', body: file, headers: { 'Content-Type': mimeType } })
 */
export async function getR2PresignedPutUrl(
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<string> {
  const client = getClient()
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn }
  )
}
