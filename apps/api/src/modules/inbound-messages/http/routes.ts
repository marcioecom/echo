import type { FastifyInstance } from "fastify"

import { env } from "../../../config/env"
import { twilioWebhookFormSchema } from "../schemas"
import { processTwilioInboundMessage } from "../use-cases/process-twilio-inbound-message"

export function registerInboundMessageRoutes(app: FastifyInstance): void {
  app.post(
    "/webhooks/twilio/whatsapp/inbound",
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const signature = request.headers["x-twilio-signature"]

      const form = twilioWebhookFormSchema.safeParse(request.body)

      if (typeof signature !== "string" || !form.success) {
        request.log.warn(
          { eventType: "twilio.webhook.rejected", reason: "malformed_request" },
          "Twilio webhook rejected"
        )
        return reply.code(403).send({ error: "webhook_rejected" })
      }

      const result = await processTwilioInboundMessage({
        signature,
        url: new URL(request.url, env.PUBLIC_API_URL).toString(),
        form: form.data,
        receivedAt: new Date(),
      })
      if (!result.ok) {
        if (result.error.type === "rejected") {
          request.log.warn(
            {
              eventType: "twilio.webhook.rejected",
              reason: result.error.reason,
            },
            "Twilio webhook rejected"
          )
          return reply.code(403).send({ error: "webhook_rejected" })
        }

        request.log.error(
          {
            eventType: "inbound_message.processing_failed",
            organizationId: result.error.ingested.organizationId,
            channelIdentityId: result.error.ingested.channelIdentityId,
            conversationId: result.error.ingested.supportConversationId,
            messageId: result.error.ingested.messageId,
          },
          "Inbound Message processing failed"
        )
        return reply.code(503).send({ error: "webhook_processing_unavailable" })
      }

      request.log.info(
        {
          eventType: "inbound_message.ingested",
          organizationId: result.value.organizationId,
          channelIdentityId: result.value.channelIdentityId,
          conversationId: result.value.supportConversationId,
          messageId: result.value.messageId,
          jobId: result.value.jobId,
        },
        "Inbound Message ingested"
      )
      return reply
        .code(200)
        .type("text/xml")
        .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
    }
  )
}
