import formbody from "@fastify/formbody"
import Fastify from "fastify"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { ingestInboundMessage } = vi.hoisted(() => ({
  ingestInboundMessage: vi.fn(),
}))

vi.mock("../../messages/services/ingest-inbound-message", () => ({
  ingestInboundMessage,
  InboundMessageEnqueueError: class extends Error {},
}))

import { registerTwilioWhatsAppWebhook } from "./register-twilio-whatsapp-webhook"

describe("Twilio WhatsApp webhook route", () => {
  beforeEach(() => {
    ingestInboundMessage.mockReset()
  })

  it("passes every form field and the canonical public URL to authentication", async () => {
    const app = Fastify()
    const authenticate = vi.fn().mockImplementation(async ({ form }) => ({
      organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
      channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
      channelType: "whatsapp",
      address: "+5511999999999",
      form,
    }))
    ingestInboundMessage.mockResolvedValue({
      organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
      channelIdentityId: "01K1EDN69NFBWCG42B2H99V2C2",
      supportConversationId: "01K1EDN69NFBWCG42B2H99V2C3",
      messageId: "01K1EDN69NFBWCG42B2H99V2C4",
      jobId: "process-inbound-message--01K1EDN69NFBWCG42B2H99V2C4",
    })
    app.register(formbody)
    registerTwilioWhatsAppWebhook(app, {
      publicApiUrl: "https://api.example.com",
      authenticate,
    })

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/twilio/whatsapp/inbound?source=twilio",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "signature",
      },
      payload:
        "MessageSid=SM11111111111111111111111111111111&AccountSid=AC11111111111111111111111111111111&From=whatsapp%3A%2B5511888888888&To=whatsapp%3A%2B5511999999999&Body=Help&NumMedia=0&FutureField=preserved",
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["content-type"]).toContain("text/xml")
    expect(response.body).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    )
    expect(authenticate).toHaveBeenCalledWith({
      signature: "signature",
      url: "https://api.example.com/webhooks/twilio/whatsapp/inbound?source=twilio",
      form: {
        MessageSid: "SM11111111111111111111111111111111",
        AccountSid: "AC11111111111111111111111111111111",
        From: "whatsapp:+5511888888888",
        To: "whatsapp:+5511999999999",
        Body: "Help",
        NumMedia: "0",
        FutureField: "preserved",
      },
    })
    await app.close()
  })

  it("returns one generic rejection for malformed requests", async () => {
    const app = Fastify()
    app.register(formbody)
    registerTwilioWhatsAppWebhook(app, {
      publicApiUrl: "https://api.example.com",
      authenticate: vi.fn(),
    })

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/twilio/whatsapp/inbound",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "AccountSid=invalid",
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: "webhook_rejected" })
    await app.close()
  })

  it("returns 503 when authenticated processing fails", async () => {
    const app = Fastify()
    app.register(formbody)
    registerTwilioWhatsAppWebhook(app, {
      publicApiUrl: "https://api.example.com",
      authenticate: vi.fn().mockResolvedValue({
        organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
        channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
        channelType: "whatsapp",
        address: "+5511999999999",
        form: {
          MessageSid: "SM11111111111111111111111111111111",
          AccountSid: "AC11111111111111111111111111111111",
          From: "whatsapp:+5511888888888",
          To: "whatsapp:+5511999999999",
          Body: "Help",
          NumMedia: "0",
        },
      }),
    })
    ingestInboundMessage.mockRejectedValue(new Error("Redis unavailable"))

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/twilio/whatsapp/inbound",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "signature",
      },
      payload: "AccountSid=AC11111111111111111111111111111111",
    })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({
      error: "webhook_processing_unavailable",
    })
    await app.close()
  })
})
