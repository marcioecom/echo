import { afterEach, describe, expect, it, vi } from "vitest"

import {
  authProxyTarget,
  buildAuthProxyHeaders,
  getServerApiUrl,
  proxyAuthRequest,
  toClientResponse,
} from "./auth-proxy"

describe("getServerApiUrl", () => {
  it("returns the runtime Worker var", () => {
    expect(getServerApiUrl({ API_URL: " https://echo-api.marcio.run " })).toBe(
      "https://echo-api.marcio.run"
    )
  })

  it("throws instead of falling back to localhost", () => {
    expect(() => getServerApiUrl({})).toThrow(/API_URL is not set/)
    expect(() => getServerApiUrl({ API_URL: "   " })).toThrow(/API_URL is not set/)
  })
})

describe("authProxyTarget", () => {
  it("joins the API origin with the auth splat and search", () => {
    expect(
      authProxyTarget(
        "https://echo-api.marcio.run",
        "sign-in/email",
        "?foo=1"
      ).href
    ).toBe("https://echo-api.marcio.run/api/auth/sign-in/email?foo=1")
  })
})

describe("buildAuthProxyHeaders", () => {
  it("keeps cookies and origin, and strips Cloudflare hop headers", () => {
    const incoming = new URL("https://app.marcio.run/api/auth/get-session")
    const request = new Request(incoming, {
      headers: {
        cookie: "better-auth.session=abc",
        "content-type": "application/json",
        origin: "https://app.marcio.run",
        "user-agent": "EchoTest",
        "cf-connecting-ip": "1.2.3.4",
        "cf-ray": "abc123",
        "cf-ipcountry": "BR",
        "x-forwarded-for": "1.2.3.4",
        "x-real-ip": "1.2.3.4",
        host: "app.marcio.run",
      },
    })

    const headers = buildAuthProxyHeaders(request, incoming)

    expect(headers.get("cookie")).toBe("better-auth.session=abc")
    expect(headers.get("content-type")).toBe("application/json")
    expect(headers.get("origin")).toBe("https://app.marcio.run")
    expect(headers.get("user-agent")).toBe("EchoTest")
    expect(headers.get("x-forwarded-host")).toBe("app.marcio.run")
    expect(headers.get("x-forwarded-proto")).toBe("https")
    expect(headers.get("cf-connecting-ip")).toBeNull()
    expect(headers.get("cf-ray")).toBeNull()
    expect(headers.get("x-forwarded-for")).toBeNull()
    expect(headers.get("x-real-ip")).toBeNull()
    expect(headers.get("host")).toBeNull()
  })
})

describe("toClientResponse", () => {
  it("forwards every Set-Cookie from the API", () => {
    const upstream = new Response("ok", {
      headers: [
        ["set-cookie", "session=one; Path=/; HttpOnly"],
        ["set-cookie", "csrf=two; Path=/; HttpOnly"],
      ],
    })

    expect(toClientResponse(upstream).headers.getSetCookie()).toEqual([
      "session=one; Path=/; HttpOnly",
      "csrf=two; Path=/; HttpOnly",
    ])
  })
})

describe("proxyAuthRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("fetches the runtime API URL without forwarding cf-* headers", async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const request = new Request(
      "https://app.marcio.run/api/auth/sign-in/email",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "better-auth.session=abc",
          "cf-connecting-ip": "203.0.113.10",
        },
        body: JSON.stringify({ email: "a@b.c", password: "x" }),
      }
    )

    const response = await proxyAuthRequest({
      request,
      apiUrl: "https://echo-api.marcio.run",
      splat: "sign-in/email",
    })

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledOnce()

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toBe("https://echo-api.marcio.run/api/auth/sign-in/email")
    expect((init?.headers as Headers).get("cookie")).toBe(
      "better-auth.session=abc"
    )
    expect((init?.headers as Headers).get("cf-connecting-ip")).toBeNull()
  })
})
