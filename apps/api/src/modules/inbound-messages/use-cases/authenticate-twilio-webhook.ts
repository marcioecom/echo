import { err, ok, type Result } from "../../../common/result"
import { credentialsCipher } from "../adapters/channel-credentials-cipher"
import { validateTwilioWebhook } from "../adapters/twilio-webhook-validator"
import { channelConnectionsRepository } from "../repositories/channel-connections-repository"
import { twilioWebhookRoutingSchema } from "../schemas"
import type { AuthenticatedTwilioWebhook } from "../types"

export type TwilioWebhookRejectionReason =
  | "unknown_connection"
  | "invalid_signature"
  | "malformed_event"

export async function authenticateTwilioWebhook(input: {
  signature: string
  url: string
  form: Record<string, string>
}): Promise<Result<AuthenticatedTwilioWebhook, TwilioWebhookRejectionReason>> {
  const routing = twilioWebhookRoutingSchema.safeParse(input.form)
  if (!routing.success) return err("unknown_connection")

  const binding = await channelConnectionsRepository.findActiveTwilioBinding({
    accountSid: routing.data.AccountSid,
    address: routing.data.To,
  })
  if (!binding) return err("unknown_connection")

  const authToken = credentialsCipher.decrypt(binding.encryptedCredentials, {
    organizationId: binding.organizationId,
    channelConnectionId: binding.channelConnectionId,
    provider: "twilio",
  })
  if (
    !validateTwilioWebhook(authToken, input.signature, input.url, input.form)
  ) {
    await channelConnectionsRepository.recordInvalidSignature({
      organizationId: binding.organizationId,
      channelConnectionId: binding.channelConnectionId,
    })
    return err("invalid_signature")
  }

  return ok({
    organizationId: binding.organizationId,
    channelConnectionId: binding.channelConnectionId,
    channelType: "whatsapp",
    address: binding.address,
    form: input.form,
  })
}
