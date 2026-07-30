import formbody from "@fastify/formbody"
import Fastify from "fastify"
import { describe, expect, it, vi } from "vitest"

import { registerTwilioWhatsAppWebhook } from "./register-twilio-whatsapp-webhook"

describe("Twilio WhatsApp webhook route", () => {
  it("passes every form field and the canonical public URL to authentication", async () => {
    const app = Fastify()
    const authenticate = vi.fn().mockResolvedValue({
      organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
      channelConnectionId: "01K1EDN9C8VT0N8WRM13RM6M55",
      channelType: "whatsapp",
      address: "+5511999999999",
      form: {},
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
        "AccountSid=AC11111111111111111111111111111111&To=whatsapp%3A%2B5511999999999&FutureField=preserved",
    })

    expect(response.statusCode).toBe(204)
    expect(authenticate).toHaveBeenCalledWith({
      signature: "signature",
      url: "https://api.example.com/webhooks/twilio/whatsapp/inbound?source=twilio",
      form: {
        AccountSid: "AC11111111111111111111111111111111",
        To: "whatsapp:+5511999999999",
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
})
