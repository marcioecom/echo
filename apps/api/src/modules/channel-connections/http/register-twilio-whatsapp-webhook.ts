import type { FastifyInstance } from "fastify"

import { twilioWebhookFormSchema } from "../schemas"
import { TwilioWebhookRejectedError } from "../services/authenticate-twilio-webhook"

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
    onAuthenticated?: (webhook: AuthenticatedTwilioWebhook) => Promise<void>
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

      try {
        const authenticated = await options.authenticate({
          signature,
          url: webhookUrl,
          form: form.data,
        })
        await options.onAuthenticated?.(authenticated)
        return reply.code(204).send()
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
    }
  )
}
