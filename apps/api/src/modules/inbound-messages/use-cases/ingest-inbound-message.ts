import { normalizedInboundMessageSchema } from "@workspace/domain"

import { err, ok, type Result } from "../../../common/result"
import { jobs } from "../../../lib/jobs-client"
import { inboundMessageRepository } from "../repositories/inbound-message-repository"
import type { InboundChannelMessage, IngestedInboundMessage } from "../types"

export type IngestInboundMessageError = {
  type: "queue_unavailable"
  ingested: IngestedInboundMessage
}

export async function ingestInboundMessage(
  input: InboundChannelMessage
): Promise<
  Result<IngestedInboundMessage & { jobId: string }, IngestInboundMessageError>
> {
  const ingested = await inboundMessageRepository.persist(
    normalizedInboundMessageSchema.parse(input)
  )

  try {
    const job = await jobs.enqueue("process-inbound-message", {
      organizationId: ingested.organizationId,
      channelIdentityId: ingested.channelIdentityId,
      supportConversationId: ingested.supportConversationId,
      messageId: ingested.messageId,
    })
    return ok({ ...ingested, jobId: job.id })
  } catch {
    return err({ type: "queue_unavailable", ingested })
  }
}
