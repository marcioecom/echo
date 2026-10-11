const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "cookie",
  "origin",
  "user-agent",
] as const

const HOP_BY_HOP_RESPONSE_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
] as const

export function getServerApiUrl(env: { API_URL?: string }) {
  const apiUrl = env.API_URL?.trim()
  if (!apiUrl) {
    throw new Error(
      "API_URL is not set. Add it to wrangler.jsonc vars, or to .dev.vars for local."
    )
  }

  return apiUrl
}

export function authProxyTarget(
  apiUrl: string,
  splat: string,
  search: string
) {
  const target = new URL(`/api/auth/${splat}`, apiUrl)
  target.search = search
  return target
}

export function buildAuthProxyHeaders(request: Request, incoming: URL) {
  const headers = new Headers()

  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  headers.set("x-forwarded-host", incoming.host)
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""))

  return headers
}

export function toClientResponse(response: Response) {
  const headers = new Headers(response.headers)

  for (const name of HOP_BY_HOP_RESPONSE_HEADERS) {
    headers.delete(name)
  }

  const setCookies = response.headers.getSetCookie()
  if (setCookies.length > 0) {
    headers.delete("set-cookie")
    for (const cookie of setCookies) {
      headers.append("set-cookie", cookie)
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export async function proxyAuthRequest({
  request,
  apiUrl,
  splat,
}: {
  request: Request
  apiUrl: string
  splat: string
}) {
  const incoming = new URL(request.url)
  const target = authProxyTarget(apiUrl, splat, incoming.search)
  const headers = buildAuthProxyHeaders(request, incoming)

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body
    init.duplex = "half"
  }

  return toClientResponse(await fetch(target, init))
}
