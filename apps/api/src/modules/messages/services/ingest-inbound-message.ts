import { normalizedInboundMessageSchema } from "@workspace/domain"

import { jobs } from "../../../lib/jobs-client"
import { persistInboundMessage } from "../repositories/inbound-message-repository"
import type { InboundChannelMessage, IngestedInboundMessage } from "../types"

export class InboundMessageEnqueueError extends Error {
  constructor(
    readonly ingested: IngestedInboundMessage,
    options: ErrorOptions
  ) {
    super("Failed to enqueue inbound Message", options)
    this.name = "InboundMessageEnqueueError"
  }
}

export async function ingestInboundMessage(input: InboundChannelMessage) {
  const result = await persistInboundMessage(
    normalizedInboundMessageSchema.parse(input)
  )
  let job: { id: string }
  try {
    job = await jobs.enqueue("process-inbound-message", {
      organizationId: result.organizationId,
      channelIdentityId: result.channelIdentityId,
      supportConversationId: result.supportConversationId,
      messageId: result.messageId,
    })
  } catch (error) {
    throw new InboundMessageEnqueueError(result, { cause: error })
  }

  return { ...result, jobId: job.id }
}
