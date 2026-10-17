import { describe, expect, it } from "vitest"

import { statusUpdatesFromBaileys } from "./delivery-status"

const scope = {
  organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
  channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
}

describe("statusUpdatesFromBaileys", () => {
  it("maps outbound receipts onto the shared delivery statuses", () => {
    expect(
      statusUpdatesFromBaileys({
        ...scope,
        updates: [
          { key: { id: "a", fromMe: true }, status: 3 },
          { key: { id: "b", fromMe: true }, status: 4 },
          { key: { id: "c", fromMe: true }, status: 5 },
          { key: { id: "d", fromMe: true }, status: 0 },
          { key: { id: "e", fromMe: false }, status: 4 },
          { key: { id: "f", fromMe: true }, status: 1 },
        ],
      }).map((update) => update.status)
    ).toEqual(["delivered", "read", "read", "failed"])
  })
})
