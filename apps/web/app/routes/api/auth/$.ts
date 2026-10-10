import { createFileRoute } from "@tanstack/react-router"

import { getApiUrl } from "@/lib/env"

async function proxyAuth({
  request,
  params,
}: {
  request: Request
  params: { _splat?: string }
}) {
  const incoming = new URL(request.url)
  const target = new URL(`/api/auth/${params._splat ?? ""}`, getApiUrl())
  target.search = incoming.search

  const headers = new Headers(request.headers)
  headers.delete("host")
  headers.set("x-forwarded-host", incoming.host)
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""))

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body
    init.duplex = "half"
  }

  const response = await fetch(target, init)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
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
