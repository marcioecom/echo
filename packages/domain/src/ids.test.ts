import { describe, expect, it } from "vitest"

import { createId, ulidSchema } from "./ids"

describe("createId", () => {
  it("creates sortable ULIDs accepted by the shared schema", () => {
    const first = createId()
    const second = createId()

    expect(ulidSchema.parse(first)).toBe(first)
    expect(ulidSchema.parse(second)).toBe(second)
    expect(first <= second).toBe(true)
  })
})
