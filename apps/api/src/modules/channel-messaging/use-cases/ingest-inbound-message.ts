import type { NormalizedInboundMessage } from "@workspace/domain"
import { createLoggerWithContext } from "@workspace/logger"

import { err, ok, type Result } from "../../../common/result"
import { jobs } from "../../../lib/jobs-client"
import { inboundMessageRepository } from "../repositories/inbound-message-repository"
import type { IngestedInboundMessage } from "../types"

const logger = createLoggerWithContext("api:channel-messaging:inbound-message")

export type IngestInboundMessageError = {
  type: "queue_unavailable"
  ingested: IngestedInboundMessage
  cause: unknown
}

export async function ingestInboundMessage(
  input: NormalizedInboundMessage
): Promise<
  Result<IngestedInboundMessage & { jobId: string }, IngestInboundMessageError>
> {
  const ingested = await inboundMessageRepository.ingest(input)

  try {
    const job = await jobs.enqueue("process-inbound-message", {
      organizationId: ingested.organizationId,
      channelIdentityId: ingested.channelIdentityId,
      supportConversationId: ingested.supportConversationId,
      messageId: ingested.messageId,
    })
    const result = { ...ingested, jobId: job.id }
    logger.info("Inbound Message ingested", {
      eventType: "inbound_message.ingested",
      organizationId: result.organizationId,
      channelConnectionId: result.channelConnectionId,
      channelIdentityId: result.channelIdentityId,
      conversationId: result.supportConversationId,
      messageId: result.messageId,
      jobId: result.jobId,
    })
    return ok(result)
  } catch (cause) {
    logger.error("Inbound Message processing failed", {
      err: cause,
      eventType: "inbound_message.processing_failed",
      organizationId: ingested.organizationId,
      channelConnectionId: ingested.channelConnectionId,
      channelIdentityId: ingested.channelIdentityId,
      conversationId: ingested.supportConversationId,
      messageId: ingested.messageId,
    })
    return err({ type: "queue_unavailable", ingested, cause })
  }
}
