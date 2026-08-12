import { createLoggerWithContext } from "@workspace/logger"

import { err, ok, type Result } from "@/common/result"
import { credentialsCipher } from "../adapters/channel-credentials-cipher"
import {
  normalizeTwilioInboundMessage,
  parseTwilioWebhookRouting,
  verifyTwilioWebhook,
} from "../adapters/twilio-webhook"
import { channelConnectionsRepository } from "../repositories/channel-connections-repository"
import type { IngestedInboundMessage } from "../types"
import {
  ingestInboundMessage,
  type IngestInboundMessageError,
} from "./ingest-inbound-message"

const logger = createLoggerWithContext("api:channel-messaging:twilio-inbound")

export type TwilioWebhookRejectionReason =
  | "unknown_connection"
  | "invalid_signature"
  | "malformed_event"

export type ProcessTwilioInboundMessageError =
  | { type: "rejected"; reason: TwilioWebhookRejectionReason }
  | IngestInboundMessageError

export async function processTwilioInboundMessage(input: {
  signature: string
  url: string
  form: Record<string, string>
  receivedAt: Date
}): Promise<
  Result<
    IngestedInboundMessage & { jobId: string },
    ProcessTwilioInboundMessageError
  >
> {
  const verified = await resolveAndVerifyTwilioWebhook(input)
  if (!verified.ok) {
    logger.warn("Twilio webhook rejected", {
      eventType: "twilio.webhook.rejected",
      reason: verified.error,
    })
    return err({ type: "rejected", reason: verified.error })
  }

  const normalized = normalizeTwilioInboundMessage({
    ...verified.value,
    form: input.form,
    receivedAt: input.receivedAt,
  })
  if (!normalized.ok) {
    logger.warn("Twilio webhook rejected", {
      eventType: "twilio.webhook.rejected",
      reason: normalized.error,
    })
    return err({ type: "rejected", reason: "malformed_event" })
  }

  return ingestInboundMessage(normalized.value)
}

export async function resolveAndVerifyTwilioWebhook(input: {
  signature: string
  url: string
  form: Record<string, string>
  routing?: Result<{ accountSid: string; address: string }, "unknown_connection">
}): Promise<
  Result<
    { organizationId: string; channelConnectionId: string },
    Exclude<TwilioWebhookRejectionReason, "malformed_event">
  >
> {
  const routing = input.routing ?? parseTwilioWebhookRouting(input.form)
  if (!routing.ok) return routing

  const binding = await channelConnectionsRepository.findActiveTwilioBinding({
    accountSid: routing.value.accountSid,
    address: routing.value.address,
  })
  if (!binding) return err("unknown_connection")

  const authToken = credentialsCipher.decrypt(binding.encryptedCredentials, {
    organizationId: binding.organizationId,
    channelConnectionId: binding.channelConnectionId,
    provider: "twilio",
  })
  if (!verifyTwilioWebhook({ authToken, ...input })) {
    await channelConnectionsRepository.recordInvalidSignature({
      organizationId: binding.organizationId,
      channelConnectionId: binding.channelConnectionId,
    })
    return err("invalid_signature")
  }

  return ok({
    organizationId: binding.organizationId,
    channelConnectionId: binding.channelConnectionId,
  })
}
