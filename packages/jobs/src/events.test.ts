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

  it("accepts ephemeral pairing events", () => {
    const qr = parseInboxEvent(
      channel,
      JSON.stringify({
        type: "channel.qr",
        channelConnectionId: "01K1EDN69NFBWCG42B2H99V2C4",
        qr: "2@abc",
      })
    )
    expect(qr?.event).toEqual({
      type: "channel.qr",
      channelConnectionId: "01K1EDN69NFBWCG42B2H99V2C4",
      qr: "2@abc",
    })

    const code = parseInboxEvent(
      channel,
      JSON.stringify({
        type: "channel.pairing_code",
        channelConnectionId: "01K1EDN69NFBWCG42B2H99V2C4",
        pairingCode: "ABCD1234",
      })
    )
    expect(code?.event.type).toBe("channel.pairing_code")
  })

  it("drops a QR event that has no code", () => {
    expect(
      parseInboxEvent(
        channel,
        JSON.stringify({
          type: "channel.qr",
          channelConnectionId: "01K1EDN69NFBWCG42B2H99V2C4",
          qr: "",
        })
      )
    ).toBeNull()
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
