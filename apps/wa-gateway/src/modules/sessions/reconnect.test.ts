import { describe, expect, it } from "vitest"

import { nextReconnect } from "./reconnect"

describe("nextReconnect", () => {
  it("retries immediately after pairing and backs off after an open connection drops", () => {
    expect(
      nextReconnect({ outcome: "restart", attempt: 4, stopped: false })
    ).toEqual({ type: "immediately", attempt: 0 })
    expect(
      nextReconnect({
        outcome: "retry_after_open",
        attempt: 3,
        stopped: false,
        random: () => 0,
      })
    ).toEqual({ type: "backoff", attempt: 1, delayMs: 1_000 })
  })

  it("backs off with jitter and stops after the attempt cap", () => {
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
        attempt: 1,
        stopped: false,
        random: () => 0,
      })
    ).toEqual({ type: "backoff", attempt: 2, delayMs: 2_000 })
    const jittered = nextReconnect({
      outcome: "retry",
      attempt: 0,
      stopped: false,
      random: () => 0.5,
    })
    expect(jittered).toEqual({ type: "backoff", attempt: 1, delayMs: 1_125 })
    expect(
      nextReconnect({
        outcome: "retry",
        attempt: 9,
        stopped: false,
        random: () => 0,
      })
    ).toEqual({ type: "exhausted", attempt: 10 })
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
