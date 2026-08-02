import { type NextRequest } from "next/server"

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

type RouteContext = {
  params: Promise<{ path: string[] }>
}

async function forwardAuthRequest(
  request: NextRequest,
  { params }: RouteContext
): Promise<Response> {
  const { path } = await params
  const upstreamUrl = new URL(`/api/auth/${path.join("/")}`, apiUrl)
  upstreamUrl.search = request.nextUrl.search

  const headers = new Headers(request.headers)
  headers.delete("host")
  headers.delete("content-length")

  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.arrayBuffer()
  const response = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
  })

  const responseHeaders = new Headers()
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      responseHeaders.set(key, value)
    }
  })
  for (const cookie of response.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", cookie)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export const GET = forwardAuthRequest
export const POST = forwardAuthRequest
export const PUT = forwardAuthRequest
export const PATCH = forwardAuthRequest
export const DELETE = forwardAuthRequest
export const OPTIONS = forwardAuthRequest
