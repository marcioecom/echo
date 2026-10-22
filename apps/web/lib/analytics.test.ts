import { describe, expect, it } from "vitest"

import { isAnalyticsEnabled, track } from "./analytics"

describe("web analytics wrapper", () => {
  it("stays disabled outside a browser or without a key", () => {
    expect(isAnalyticsEnabled()).toBe(false)
  })

  it("refuses events owned by another app", async () => {
    await expect(
      track("signup_completed", { method: "email" })
    ).rejects.toThrow(/owned by "api"/)

    await expect(
      track("operator_reply_sent", {
        organizationId: "01J8Z",
        role: "operator",
      })
    ).rejects.toThrow(/owned by "api"/)
  })

  it("no-ops for web-owned events when the key is missing", async () => {
    await expect(
      track("signup_started", { method: "email" })
    ).resolves.toBeUndefined()
  })
})
