import type { ConnectionContext } from "./channel-adapter"

import { describe, expect, it, vi } from "vitest"

import { createChannelAdapterRegistry } from "./channel-adapters"
import {
  statusUpdateFromTwilio,
  TwilioAdapter,
  twilioStatusCallbackUrl,
} from "./twilio-adapter"

const statusCallbackUrl =
  "https://api.example.test/webhooks/twilio/whatsapp/status"
const context: ConnectionContext = {
  organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
  channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
  fromAddress: "+5511999999999",
  externalAccountId: "AC11111111111111111111111111111111",
  authToken: "secret",
}

describe("TwilioAdapter", () => {
  it("sends text through the Twilio sender and returns the provider id", async () => {
    const sendWhatsAppTextMessage = vi.fn().mockResolvedValue({
      externalMessageId: "SM11111111111111111111111111111111",
    })
    const createSender = vi.fn(() => ({ sendWhatsAppTextMessage }))
    const adapter = new TwilioAdapter(statusCallbackUrl, createSender)

    await expect(
      adapter.send(context, "+5511888888888", { type: "text", body: "Hello" })
    ).resolves.toEqual({
      ok: true,
      externalMessageId: "SM11111111111111111111111111111111",
    })
    expect(createSender).toHaveBeenCalledWith(
      context.externalAccountId,
      "secret"
    )
    expect(sendWhatsAppTextMessage).toHaveBeenCalledWith({
      from: context.fromAddress,
      to: "+5511888888888",
      body: "Hello",
      statusCallbackUrl,
    })
  })

  it("marks permanent Twilio errors as not retryable and other failures as retryable", async () => {
    const sendWhatsAppTextMessage = vi
      .fn()
      .mockRejectedValueOnce({ code: 21610 })
      .mockRejectedValueOnce({ code: 20429 })
      .mockRejectedValueOnce(new Error("network down"))
    const adapter = new TwilioAdapter(statusCallbackUrl, () => ({
      sendWhatsAppTextMessage,
    }))

    await expect(
      adapter.send(context, "+5511888888888", { type: "text", body: "Hello" })
    ).resolves.toEqual({
      ok: false,
      retryable: false,
      code: "21610",
      providerCode: 21610,
    })
    await expect(
      adapter.send(context, "+5511888888888", { type: "text", body: "Hello" })
    ).resolves.toEqual({
      ok: false,
      retryable: true,
      code: "20429",
      providerCode: 20429,
    })
    await expect(
      adapter.send(context, "+5511888888888", { type: "text", body: "Hello" })
    ).resolves.toEqual({
      ok: false,
      retryable: true,
      code: "provider_request_failed",
    })
  })

  it("rejects media and a missing account without calling Twilio", async () => {
    const sendWhatsAppTextMessage = vi.fn()
    const adapter = new TwilioAdapter(statusCallbackUrl, () => ({
      sendWhatsAppTextMessage,
    }))

    await expect(
      adapter.send(context, "+5511888888888", {
        type: "media",
        kind: "image",
        url: "https://example.test/a.jpg",
      })
    ).resolves.toEqual({
      ok: false,
      retryable: false,
      code: "unsupported_content",
    })
    await expect(
      adapter.send({ ...context, externalAccountId: null }, "+5511888888888", {
        type: "text",
        body: "Hello",
      })
    ).resolves.toEqual({
      ok: false,
      retryable: false,
      code: "missing_account",
    })
    expect(sendWhatsAppTextMessage).not.toHaveBeenCalled()
  })

  it("fetches media through the Twilio provider with the connection credentials", async () => {
    const stream = new ReadableStream()
    const fetchMedia = vi.fn().mockResolvedValue({ stream, mime: "audio/ogg" })
    const createSender = vi.fn(() => ({
      sendWhatsAppTextMessage: vi.fn(),
      fetchMedia,
    }))
    const adapter = new TwilioAdapter(statusCallbackUrl, createSender)

    await expect(
      adapter.fetchMedia(context, {
        externalMessageId: "SM11111111111111111111111111111111",
        url: "https://api.twilio.com/media/ME1",
      })
    ).resolves.toEqual({ stream, mime: "audio/ogg" })
    expect(createSender).toHaveBeenCalledWith(
      context.externalAccountId,
      "secret"
    )
    expect(fetchMedia).toHaveBeenCalledWith("https://api.twilio.com/media/ME1")
  })

  it("throws a terminal request error when media context is incomplete", async () => {
    const adapter = new TwilioAdapter(statusCallbackUrl, () => ({
      sendWhatsAppTextMessage: vi.fn(),
    }))

    await expect(
      adapter.fetchMedia(context, { externalMessageId: "SM1" })
    ).rejects.toMatchObject({ reason: "missing_url", retryable: false })
    await expect(
      adapter.fetchMedia(
        { ...context, externalAccountId: null },
        { externalMessageId: "SM1", url: "https://api.twilio.com/media/ME1" }
      )
    ).rejects.toMatchObject({ reason: "missing_account" })
    await expect(
      adapter.fetchMedia(
        { ...context, authToken: "" },
        { externalMessageId: "SM1", url: "https://api.twilio.com/media/ME1" }
      )
    ).rejects.toMatchObject({ reason: "missing_credentials" })
  })

  it("throws a terminal request error when the provider cannot fetch media", async () => {
    const adapter = new TwilioAdapter(statusCallbackUrl, () => ({
      sendWhatsAppTextMessage: vi.fn(),
    }))

    await expect(
      adapter.fetchMedia(context, {
        externalMessageId: "SM1",
        url: "https://api.twilio.com/media/ME1",
      })
    ).rejects.toMatchObject({ reason: "provider_unavailable" })
  })

  it("reports webhook connections as connected when credentials are present", async () => {
    const adapter = new TwilioAdapter(statusCallbackUrl, () => ({
      sendWhatsAppTextMessage: vi.fn(),
    }))

    await expect(adapter.health(context)).resolves.toEqual({
      state: "connected",
    })
    await expect(
      adapter.health({ ...context, authToken: "" })
    ).resolves.toEqual({
      state: "disconnected",
      reason: "missing_credentials",
    })
  })
})

describe("Twilio delivery status", () => {
  it("maps queued and undelivered onto the shared status update", () => {
    expect(
      statusUpdateFromTwilio({
        organizationId: context.organizationId,
        channelConnectionId: context.channelConnectionId,
        externalMessageId: "SM11111111111111111111111111111111",
        messageStatus: "queued",
      })
    ).toEqual({
      organizationId: context.organizationId,
      channelConnectionId: context.channelConnectionId,
      externalMessageId: "SM11111111111111111111111111111111",
      status: "pending",
    })
    expect(
      statusUpdateFromTwilio({
        organizationId: context.organizationId,
        channelConnectionId: context.channelConnectionId,
        externalMessageId: "SM11111111111111111111111111111111",
        messageStatus: "undelivered",
      }).status
    ).toBe("failed")
    expect(
      statusUpdateFromTwilio({
        organizationId: context.organizationId,
        channelConnectionId: context.channelConnectionId,
        externalMessageId: "SM11111111111111111111111111111111",
        messageStatus: "read",
      }).status
    ).toBe("read")
  })

  it("keeps the existing status callback path", () => {
    expect(twilioStatusCallbackUrl("https://api.example.test")).toBe(
      statusCallbackUrl
    )
  })
})

describe("channel adapter registry", () => {
  it("resolves Twilio and Baileys and leaves Meta unregistered", () => {
    const registry = createChannelAdapterRegistry("https://api.example.test", {
      send: vi.fn(),
    })

    expect(registry.adapterFor("twilio")).toMatchObject({
      provider: "twilio",
      delivery: "webhook",
    })
    expect(registry.adapterFor("baileys")).toMatchObject({
      provider: "baileys",
      delivery: "session",
    })
    expect(registry.adapterFor("meta_cloud")).toBeUndefined()
  })
})
