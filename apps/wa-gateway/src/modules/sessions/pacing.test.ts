import { describe, expect, it } from "vitest"

import { humanSendDelayMs, reconnectDelayMs } from "./pacing"

describe("humanSendDelayMs", () => {
  it("stays between one and six seconds", () => {
    expect(humanSendDelayMs("a")).toBe(1_000)
    expect(humanSendDelayMs("a".repeat(100))).toBe(3_000)
    expect(humanSendDelayMs("a".repeat(1_000))).toBe(6_000)
  })
})

describe("reconnectDelayMs", () => {
  it("backs off and caps at five minutes plus jitter", () => {
    expect(reconnectDelayMs(1, () => 0)).toBe(1_000)
    expect(reconnectDelayMs(3, () => 0)).toBe(4_000)
    expect(reconnectDelayMs(20, () => 0)).toBe(5 * 60 * 1_000)
    expect(reconnectDelayMs(1, () => 0.5)).toBe(1_125)
  })
})
