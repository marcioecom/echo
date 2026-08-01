import type { FastifyInstance } from "fastify"

import {
  normalizeTwilioInboundMessage,
  TwilioInboundMessageNormalizationError,
} from "../adapters/normalize-twilio-inbound-message"
import { twilioWebhookFormSchema } from "../schemas"
import { TwilioWebhookRejectedError } from "../services/authenticate-twilio-webhook"
import {
  ingestInboundMessage,
  InboundMessageEnqueueError,
} from "../../messages/services/ingest-inbound-message"

export interface AuthenticatedTwilioWebhook {
  organizationId: string
  channelConnectionId: string
  channelType: "whatsapp"
  address: string
  form: Record<string, string>
}

export function registerTwilioWhatsAppWebhook(
  app: FastifyInstance,
  options: {
    publicApiUrl: string
    authenticate: (input: {
      signature: string
      url: string
      form: Record<string, string>
    }) => Promise<AuthenticatedTwilioWebhook>
  }
): void {
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
      const receivedAt = new Date()
      const signature = request.headers["x-twilio-signature"]
      const form = twilioWebhookFormSchema.safeParse(request.body)
      if (typeof signature !== "string" || !form.success) {
        request.log.warn(
          { eventType: "twilio.webhook.rejected", reason: "malformed_request" },
          "Twilio webhook rejected"
        )
        return reply.code(403).send({ error: "webhook_rejected" })
      }

      const webhookUrl = new URL(request.url, options.publicApiUrl).toString()

      let authenticated: AuthenticatedTwilioWebhook
      try {
        authenticated = await options.authenticate({
          signature,
          url: webhookUrl,
          form: form.data,
        })
      } catch (error) {
        const reason =
          error instanceof TwilioWebhookRejectedError
            ? error.reason
            : "authentication_failed"
        request.log.warn(
          { eventType: "twilio.webhook.rejected", reason },
          "Twilio webhook rejected"
        )
        return reply.code(403).send({ error: "webhook_rejected" })
      }

      try {
        const processed = await ingestInboundMessage(
          normalizeTwilioInboundMessage(authenticated, receivedAt)
        )
        request.log.info(
          {
            eventType: "inbound_message.ingested",
            organizationId: processed.organizationId,
            channelConnectionId: authenticated.channelConnectionId,
            channelIdentityId: processed.channelIdentityId,
            conversationId: processed.supportConversationId,
            messageId: processed.messageId,
            jobId: processed.jobId,
          },
          "Inbound Message ingested"
        )
        return reply
          .code(200)
          .type("text/xml")
          .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
      } catch (error) {
        if (
          error instanceof TwilioWebhookRejectedError ||
          error instanceof TwilioInboundMessageNormalizationError
        ) {
          const reason =
            error instanceof TwilioWebhookRejectedError
              ? error.reason
              : "malformed_event"
          request.log.warn(
            { eventType: "twilio.webhook.rejected", reason },
            "Twilio webhook rejected"
          )
          return reply.code(403).send({ error: "webhook_rejected" })
        }

        const ingested =
          error instanceof InboundMessageEnqueueError
            ? error.ingested
            : undefined
        request.log.error(
          {
            eventType: "inbound_message.processing_failed",
            organizationId: ingested?.organizationId,
            channelConnectionId: authenticated.channelConnectionId,
            channelIdentityId: ingested?.channelIdentityId,
            conversationId: ingested?.supportConversationId,
            messageId: ingested?.messageId,
            error,
          },
          "Inbound Message processing failed"
        )
        return reply.code(503).send({ error: "webhook_processing_unavailable" })
      }
    }
  )
}
