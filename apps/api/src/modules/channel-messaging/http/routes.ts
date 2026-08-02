import type { FastifyInstance } from "fastify"

import { matchResult, matchTag } from "@/common/match"
import { env } from "@/config/env"
import { twilioWebhookRequestSchema } from "../adapters/twilio-webhook"
import { processTwilioInboundMessage } from "../use-cases/process-twilio-inbound-message"

export function registerInboundMessageRoutes(app: FastifyInstance): void {
  app.post("/webhooks/twilio/whatsapp/inbound", async (request, reply) => {
    const webhook = twilioWebhookRequestSchema.safeParse({
      signature: request.headers["x-twilio-signature"],
      form: request.body,
    })

    if (!webhook.success) {
      return reply.code(403).send({ error: "webhook_rejected" })
    }

    const result = await processTwilioInboundMessage({
      signature: webhook.data.signature,
      url: new URL(request.url, env.PUBLIC_API_URL).toString(),
      form: webhook.data.form,
      receivedAt: new Date(),
    })

    return matchResult(result, {
      err: (error) =>
        matchTag(error, {
          rejected: () => reply.code(403).send({ error: "webhook_rejected" }),
          queue_unavailable: () =>
            reply.code(503).send({ error: "webhook_processing_unavailable" }),
        }),
      ok: () =>
        reply
          .code(200)
          .type("text/xml")
          .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>'),
    })
  })
}
