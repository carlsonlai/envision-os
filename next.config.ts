import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // 'standalone' is required for Docker/Railway builds.
  // Vercel manages its own output — do NOT set standalone when deploying to Vercel.
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' as const } : {}),
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
