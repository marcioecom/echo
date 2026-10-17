import { describe, expect, it } from "vitest"

import { transitionLifecycle } from "./lifecycle"

describe("session lifecycle", () => {
  it("tracks pairing, connected, retry backoff, and stop phases", () => {
    const connecting = transitionLifecycle({ phase: "unowned" }, { type: "connect" })
    expect(connecting).toEqual({ phase: "connecting" })
    const pairing = transitionLifecycle(connecting, { type: "qr" })
    expect(pairing).toEqual({ phase: "pairing", qrSeen: true })

    const connected = transitionLifecycle(pairing, { type: "open" })
    expect(connected).toEqual({ phase: "connected" })

    const backoff = transitionLifecycle(connected, {
      type: "close",
      outcome: "retry_after_open",
    })
    expect(backoff).toEqual({
      phase: "backoff",
      attempt: 0,
      delayMs: 0,
      outcome: "retry_after_open",
    })
    expect(
      transitionLifecycle(backoff, { type: "backoff", attempt: 2, delayMs: 500 })
    ).toEqual({ ...backoff, attempt: 2, delayMs: 500 })
    expect(transitionLifecycle(backoff, { type: "stop" })).toEqual({
      phase: "stopping",
    })
    expect(
      transitionLifecycle({ phase: "stopping" }, { type: "stopped" })
    ).toEqual({ phase: "stopped" })
  })
})
