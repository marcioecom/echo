import { createFileRoute } from "@tanstack/react-router"
import { env } from "cloudflare:workers"

import { getServerApiUrl, proxyAuthRequest } from "@/lib/auth-proxy"

async function proxyAuth({
  request,
  params,
}: {
  request: Request
  params: { _splat?: string }
}) {
  let apiUrl: string
  try {
    apiUrl = getServerApiUrl(env)
  } catch (error) {
    const message = error instanceof Error ? error.message : "API_URL is not set"
    return new Response(message, { status: 500 })
  }

  return proxyAuthRequest({
    request,
    apiUrl,
    splat: params._splat ?? "",
  })
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: proxyAuth,
      POST: proxyAuth,
      PUT: proxyAuth,
      PATCH: proxyAuth,
      DELETE: proxyAuth,
      OPTIONS: proxyAuth,
      HEAD: proxyAuth,
    },
  },
})
