import { describe, expect, it, vi } from "vitest"

import { BaileysAdapter } from "./baileys-adapter"
import { createChannelAdapterRegistry } from "./channel-adapters"

const context = {
  organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
  channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
  fromAddress: "+5511999999999",
  externalAccountId: null,
  authToken: "ignored",
  outboundMessageId: "01K1EDN69NFBWCG42B2H99V2C5",
}

describe("BaileysAdapter", () => {
  it("forwards text sends to the gateway transport", async () => {
    const send = vi.fn(async () => ({
      ok: true as const,
      externalMessageId: "wamid.1",
    }))
    const adapter = new BaileysAdapter({ send })

    await expect(
      adapter.send(context, "+5511888888888", {
        type: "text",
        body: "Oi",
      })
    ).resolves.toEqual({ ok: true, externalMessageId: "wamid.1" })
    expect(send).toHaveBeenCalledWith({
      organizationId: context.organizationId,
      channelConnectionId: context.channelConnectionId,
      outboundMessageId: context.outboundMessageId,
      to: "+5511888888888",
      body: "Oi",
    })
  })

  it("rejects media without calling the gateway", async () => {
    const send = vi.fn()
    const adapter = new BaileysAdapter({ send })

    await expect(
      adapter.send(context, "+5511888888888", {
        type: "media",
        kind: "image",
        url: "https://example.test/a.png",
      })
    ).resolves.toEqual({
      ok: false,
      retryable: false,
      code: "unsupported_content",
    })
    expect(send).not.toHaveBeenCalled()
  })
})

describe("channel adapter registry", () => {
  it("registers Baileys when a transport is provided", () => {
    const registry = createChannelAdapterRegistry("https://api.example.test", {
      baileys: { send: vi.fn() },
    })

    expect(registry.adapterFor("baileys")).toMatchObject({
      provider: "baileys",
      delivery: "session",
    })
    expect(registry.adapterFor("twilio")?.provider).toBe("twilio")
  })
})
