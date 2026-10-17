import { describe, expect, it } from "vitest"

import { waConnectionQueueName } from "./wa-gateway"

const channelConnectionId = "01K1EDN9C8VT0N8WRM13RM6M55"

describe("waConnectionQueueName", () => {
  it("derives a per-connection queue name from a ULID", () => {
    expect(waConnectionQueueName(channelConnectionId)).toBe(
      `wa-gateway-${channelConnectionId}`
    )
  })

  it("rejects invalid connection ids", () => {
    expect(() => waConnectionQueueName("not-a-ulid")).toThrow()
  })
})
