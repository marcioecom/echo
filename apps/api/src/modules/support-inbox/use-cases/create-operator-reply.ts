import { createLoggerWithContext } from "@workspace/logger"

import { err, ok, Result } from "@/common/result"
import { capture } from "@/lib/analytics"
import { jobs } from "@/lib/jobs-client"

import { publishSupportConversationUpdated } from "../events/publish-support-conversation-updated"
import { supportInboxRepository } from "../repositories/support-inbox-repository"

export type CreateOperatorReplyResult = { type: "created"; messageId: string }

export type CreateOperatorReplyError =
  | { type: "queue_unavailable"; messageId: string }
  | { type: "not_found" }
  | { type: "resolved" }

const logger = createLoggerWithContext("api:support-inbox:operator-reply")

export async function createOperatorReply(input: {
  organizationId: string
  conversationId: string
  operatorUserId: string
  operatorRole: string
  body: string
}): Promise<Result<CreateOperatorReplyResult, CreateOperatorReplyError>> {
  const created = await supportInboxRepository.createOperatorReply({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    operatorUserId: input.operatorUserId,
    body: input.body,
    occurredAt: new Date(),
  })

  if (created.type !== "created") return err(created)

  capture("operator_reply_sent", {
    organizationId: input.organizationId,
    distinctId: input.operatorUserId,
    properties: { role: input.operatorRole },
  })

  try {
    await jobs.enqueue("send-outbound-message", {
      organizationId: input.organizationId,
      channelConnectionId: created.channelConnectionId,
      supportConversationId: created.supportConversationId,
      messageId: created.messageId,
    })
  } catch {
    return err({ type: "queue_unavailable", messageId: created.messageId })
  }

  await publishSupportConversationUpdated({
    organizationId: input.organizationId,
    conversationId: created.supportConversationId,
  }).catch((error: unknown) => {
    logger.warn("Support Inbox update could not be published", {
      err: error,
      eventType: "support_conversation.update_notification_failed",
      organizationId: input.organizationId,
      conversationId: created.supportConversationId,
      messageId: created.messageId,
    })
  })

  return ok({ type: "created", messageId: created.messageId })
}
