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
    // Disable automatic checksum headers — presigned PUT URLs go to browser
    // which doesn't know how to send x-amz-checksum-* headers
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
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

/** Presigned GET URLs end up as the `src` of <Image>. next/image keys its
 *  optimizer cache on the whole URL string, so a fresh X-Amz-Date on every
 *  render meant a MISS on every page view — the original (avg 2.4 MB) got
 *  re-fetched from R2 and re-encoded each time, and the browser cache was
 *  useless too. Rounding the signing time down to a fixed window makes every
 *  render inside that window emit a byte-identical URL, so both caches hit. */
const SIGNING_WINDOW_MS = 30 * 60 * 1000
const GET_URL_TTL_SECONDS = 7200

/** Signing time rounded down to the window boundary. Worst case — URL minted at
 *  the start of a window and first used at its end — leaves 7200 - 1800 = 5400s
 *  (90 min) of validity. */
function quantizedSigningDate(now: number = Date.now()): Date {
  return new Date(Math.floor(now / SIGNING_WINDOW_MS) * SIGNING_WINDOW_MS)
}

export async function getR2SignedUrl(
  key: string,
  expiresIn = GET_URL_TTL_SECONDS
): Promise<string> {
  const client = getClient()
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn, signingDate: quantizedSigningDate() }
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
