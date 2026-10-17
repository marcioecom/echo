import { describe, expect, it } from "vitest"

import { humanSendDelayMs } from "./pacing"

describe("humanSendDelayMs", () => {
  it("stays between one and six seconds", () => {
    expect(humanSendDelayMs("a")).toBe(1_000)
    expect(humanSendDelayMs("a".repeat(100))).toBe(3_000)
    expect(humanSendDelayMs("a".repeat(1_000))).toBe(6_000)
  })
})
