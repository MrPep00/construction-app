import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

function getR2Env() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET_NAME
  return { accountId, accessKeyId, secretAccessKey, bucket }
}

export function isR2Configured(): boolean {
  const { accountId, accessKeyId, secretAccessKey, bucket } = getR2Env()
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket)
}

function getClient(): S3Client {
  const { accountId, accessKeyId, secretAccessKey } = getR2Env()
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 env vars missing: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY")
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
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
