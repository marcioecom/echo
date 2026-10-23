import { describe, expect, it } from "vitest"

import { buildSocialCallbackUrl } from "./social-callback-url"

const base = "https://app.example.com"

function build(redirectTo: string, fallback = "/inbox") {
  return buildSocialCallbackUrl({ base, fallback, redirectTo })
}

describe("buildSocialCallbackUrl", () => {
  it("keeps an internal path", () => {
    expect(build("/accept-invitation/123")).toBe(
      "https://app.example.com/accept-invitation/123"
    )
  })

  it("uses the fallback for an empty redirect", () => {
    expect(build("")).toBe("https://app.example.com/inbox")
  })

  it("falls back for protocol-relative and backslash URLs", () => {
    expect(build("//evil.example")).toBe("https://app.example.com/inbox")
    expect(build("/\\evil.example")).toBe("https://app.example.com/inbox")
  })

  it("falls back when URL parsing normalizes an external host", () => {
    expect(build("/\t/evil.example")).toBe("https://app.example.com/inbox")
    expect(build("/\n/evil.example")).toBe("https://app.example.com/inbox")
  })

  it("falls back for an absolute external URL", () => {
    expect(build("https://evil.example/path")).toBe(
      "https://app.example.com/inbox"
    )
  })

  it("honors the provided fallback", () => {
    expect(build("//evil.example", "/setup")).toBe(
      "https://app.example.com/setup"
    )
  })
})
