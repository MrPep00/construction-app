import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      // R2 signed URLs (S3-compatible endpoint)
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      // R2 public bucket URLs (Cloudflare CDN — pub-*.r2.dev)
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "52mb",
    },
  },
}

export default nextConfig
