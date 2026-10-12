import { describe, expect, it } from "vitest"

import { nextReconnect } from "./reconnect"

describe("nextReconnect", () => {
  it("retries immediately after pairing and after a drop that followed open", () => {
    expect(
      nextReconnect({ outcome: "restart", attempt: 4, stopped: false })
    ).toEqual({ type: "immediately", attempt: 0 })
    expect(
      nextReconnect({
        outcome: "retry_after_open",
        attempt: 3,
        stopped: false,
      })
    ).toEqual({ type: "immediately", attempt: 0 })
  })

  it("backs off and stops after the attempt cap", () => {
    expect(
      nextReconnect({
        outcome: "retry",
        attempt: 0,
        stopped: false,
        random: () => 0,
      })
    ).toEqual({ type: "backoff", attempt: 1, delayMs: 1_000 })
    expect(
      nextReconnect({
        outcome: "retry",
        attempt: 7,
        stopped: false,
        random: () => 0,
      })
    ).toEqual({ type: "exhausted", attempt: 8 })
  })

  it("does not reconnect after logout, replacement, ban, or stop", () => {
    const terminal = [
      "logged_out",
      "replaced",
      "banned",
      "pairing_timeout",
      "stopped",
    ] as const
    for (const outcome of terminal) {
      expect(nextReconnect({ outcome, attempt: 1, stopped: false })).toEqual({
        type: "stop",
      })
    }
    expect(
      nextReconnect({ outcome: "retry", attempt: 0, stopped: true })
    ).toEqual({ type: "stop" })
  })
})
