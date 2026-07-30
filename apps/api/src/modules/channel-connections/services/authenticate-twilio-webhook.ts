import twilio from "twilio"

import type { ChannelCredentialsCipher } from "../adapters/channel-credentials-cipher"
import type { ChannelConnectionsRepository } from "../repositories/channel-connections-repository"
import { twilioWebhookRoutingSchema } from "../schemas"

export type TwilioWebhookRejectionReason =
  | "unknown_connection"
  | "invalid_signature"

export class TwilioWebhookRejectedError extends Error {
  constructor(readonly reason: TwilioWebhookRejectionReason) {
    super("Twilio webhook rejected")
    this.name = "TwilioWebhookRejectedError"
  }
}

export function createAuthenticateTwilioWebhook(dependencies: {
  repository: ChannelConnectionsRepository
  credentialsCipher: ChannelCredentialsCipher
  validateRequest?: typeof twilio.validateRequest
}) {
  const validateRequest = dependencies.validateRequest ?? twilio.validateRequest

  return async (input: {
    signature: string
    url: string
    form: Record<string, string>
  }) => {
    const routing = twilioWebhookRoutingSchema.safeParse(input.form)
    if (!routing.success) {
      throw new TwilioWebhookRejectedError("unknown_connection")
    }

    const binding = await dependencies.repository.findActiveTwilioBinding({
      accountSid: routing.data.AccountSid,
      address: routing.data.To,
    })
    if (!binding) {
      throw new TwilioWebhookRejectedError("unknown_connection")
    }

    const authToken = dependencies.credentialsCipher.decrypt(
      binding.encryptedCredentials,
      {
        organizationId: binding.organizationId,
        channelConnectionId: binding.channelConnectionId,
        provider: "twilio",
      }
    )
    if (!validateRequest(authToken, input.signature, input.url, input.form)) {
      await dependencies.repository.recordInvalidSignature({
        organizationId: binding.organizationId,
        channelConnectionId: binding.channelConnectionId,
      })
      throw new TwilioWebhookRejectedError("invalid_signature")
    }

    return {
      organizationId: binding.organizationId,
      channelConnectionId: binding.channelConnectionId,
      channelType: "whatsapp" as const,
      address: binding.address,
      form: input.form,
    }
  }
}
