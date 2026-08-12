import { err, ok, type Result } from "@/common/result"
import { publishSupportConversationUpdated } from "@/modules/support-inbox/events/publish-support-conversation-updated"
import {
  parseTwilioStatusWebhookRouting,
  twilioStatusWebhookSchema,
} from "../adapters/twilio-webhook"
import { resolveAndVerifyTwilioWebhook } from "./process-twilio-inbound-message"
import { outboundMessageRepository } from "../repositories/outbound-message-repository"

type StatusRejection = "unknown_connection" | "invalid_signature" | "malformed_event"

export async function processTwilioMessageStatus(input: {
  signature: string
  url: string
  form: Record<string, string>
}): Promise<Result<void, StatusRejection>> {
  const routing = parseTwilioStatusWebhookRouting(input.form)
  if (!routing.ok) return routing

  const verified = await resolveAndVerifyTwilioWebhook({
    ...input,
    routing,
  })
  if (!verified.ok) return verified

  const status = twilioStatusWebhookSchema.safeParse(input.form)
  if (!status.success) return err("malformed_event")

  const nextStatus =
    status.data.MessageStatus === "queued"
      ? "pending"
      : status.data.MessageStatus === "undelivered"
        ? "failed"
        : status.data.MessageStatus
  const updated = await outboundMessageRepository.applyDeliveryStatus({
    organizationId: verified.value.organizationId,
    channelConnectionId: verified.value.channelConnectionId,
    externalMessageId: status.data.MessageSid,
    status: nextStatus,
  })
  if (updated?.changed) {
    await publishSupportConversationUpdated({
      organizationId: verified.value.organizationId,
      conversationId: updated.conversationId,
    })
  }

  return ok(undefined)
}
