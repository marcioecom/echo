import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/auth", "@workspace/domain"],
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) return []

    return [
      {
        source: "/api/auth/:path*",
        destination: `${apiUrl}/api/auth/:path*`,
      },
    ]
  },
}

export default nextConfig
