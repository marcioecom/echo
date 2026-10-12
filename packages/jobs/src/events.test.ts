import { describe, expect, it } from "vitest"

import { parseInboxEvent } from "./events"

const organizationId = "01K1EDN69NFBWCG42B2H99V2C1"
const channel = `inbox-events:${organizationId}`

describe("parseInboxEvent", () => {
  it("keeps support conversation events", () => {
    const parsed = parseInboxEvent(
      channel,
      JSON.stringify({
        type: "support_conversation.updated",
        conversationId: "01K1EDN69NFBWCG42B2H99V2C4",
      })
    )
    expect(parsed).toEqual({
      organizationId,
      event: {
        type: "support_conversation.updated",
        conversationId: "01K1EDN69NFBWCG42B2H99V2C4",
      },
    })
  })

  it("accepts channel status events for the organization in the channel name", () => {
    const parsed = parseInboxEvent(
      channel,
      JSON.stringify({
        type: "channel.status_changed",
        channelConnectionId: "01K1EDN69NFBWCG42B2H99V2C4",
      })
    )
    expect(parsed?.organizationId).toBe(organizationId)
    expect(parsed?.event).toEqual({
      type: "channel.status_changed",
      channelConnectionId: "01K1EDN69NFBWCG42B2H99V2C4",
    })
  })

  it("drops events whose organization id is not a ULID", () => {
    expect(
      parseInboxEvent(
        "inbox-events:other-org",
        JSON.stringify({
          type: "channel.status_changed",
          channelConnectionId: "01K1EDN69NFBWCG42B2H99V2C4",
        })
      )
    ).toBeNull()
  })
})
