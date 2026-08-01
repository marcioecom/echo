import formbody from "@fastify/formbody"
import Fastify from "fastify"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { processTwilioInboundMessage } = vi.hoisted(() => ({
  processTwilioInboundMessage: vi.fn(),
}))

vi.mock("../../../config/env", () => ({
  env: { PUBLIC_API_URL: "http://localhost:3001" },
}))
vi.mock("../use-cases/process-twilio-inbound-message", () => ({
  processTwilioInboundMessage,
}))

import { registerInboundMessageRoutes } from "./routes"

describe("Twilio WhatsApp webhook route", () => {
  beforeEach(() => processTwilioInboundMessage.mockReset())

  it("preserves every form field and URL query for the use case", async () => {
    processTwilioInboundMessage.mockResolvedValue({
      ok: true,
      value: {
        organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
        contactId: "01K1EDN69NFBWCG42B2H99V2C2",
        channelIdentityId: "01K1EDN69NFBWCG42B2H99V2C3",
        supportConversationId: "01K1EDN69NFBWCG42B2H99V2C4",
        messageId: "01K1EDN69NFBWCG42B2H99V2C5",
        duplicate: false,
        jobId: "job-id",
      },
    })
    const app = Fastify()
    app.register(formbody)
    registerInboundMessageRoutes(app)

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
    expect(processTwilioInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        signature: "signature",
        url: "http://localhost:3001/webhooks/twilio/whatsapp/inbound?source=twilio",
        form: expect.objectContaining({ FutureField: "preserved" }),
      })
    )
    await app.close()
  })

  it("returns one generic rejection for malformed requests", async () => {
    const app = Fastify()
    app.register(formbody)
    registerInboundMessageRoutes(app)

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

  it("returns a generic 503 for queue unavailability", async () => {
    processTwilioInboundMessage.mockResolvedValue({
      ok: false,
      error: {
        type: "queue_unavailable",
        ingested: {
          organizationId: "01K1EDN69NFBWCG42B2H99V2C1",
          contactId: "01K1EDN69NFBWCG42B2H99V2C2",
          channelIdentityId: "01K1EDN69NFBWCG42B2H99V2C3",
          supportConversationId: "01K1EDN69NFBWCG42B2H99V2C4",
          messageId: "01K1EDN69NFBWCG42B2H99V2C5",
          duplicate: false,
        },
      },
    })
    const app = Fastify()
    app.register(formbody)
    registerInboundMessageRoutes(app)

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
    expect(response.json()).toEqual({ error: "webhook_processing_unavailable" })
    await app.close()
  })
})
