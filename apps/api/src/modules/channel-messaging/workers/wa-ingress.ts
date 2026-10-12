// Consumed in the API process: inbound persistence lives next to the Twilio
// webhook, and the worker must not import this app.
import {
  waInboundJobSchema,
  waIngressJobNames,
  waIngressQueueName,
  waStatusJobSchema,
} from "@workspace/jobs"
import { createLoggerWithContext } from "@workspace/logger"
import { UnrecoverableError, Worker, type Job } from "bullmq"

import { redisConnection } from "@/lib/redis"
import { publishSupportConversationUpdated } from "@/modules/support-inbox/events/publish-support-conversation-updated"

import { outboundMessageRepository } from "../repositories/outbound-message-repository"
import { ingestInboundMessage } from "../use-cases/ingest-inbound-message"

const logger = createLoggerWithContext("api:wa-ingress")

export async function handleWaIngressJob(
  job: Pick<Job, "name" | "data">
): Promise<void> {
  if (job.name === waIngressJobNames.inbound) {
    const payload = waInboundJobSchema.parse(job.data)
    const result = await ingestInboundMessage({
      organizationId: payload.organizationId,
      channelConnectionId: payload.channelConnectionId,
      channelType: "whatsapp",
      senderAddress: payload.senderAddress,
      senderDisplayName: payload.senderDisplayName,
      externalMessageId: payload.externalMessageId,
      content: payload.content,
      receivedAt: new Date(payload.receivedAt),
    })
    if (!result.ok) throw result.error.cause
    return
  }

  if (job.name === waIngressJobNames.status) {
    const payload = waStatusJobSchema.parse(job.data)
    const updated = await outboundMessageRepository.applyDeliveryStatus({
      organizationId: payload.organizationId,
      channelConnectionId: payload.channelConnectionId,
      externalMessageId: payload.externalMessageId,
      status: payload.status,
    })
    if (updated?.changed) {
      await publishSupportConversationUpdated({
        organizationId: payload.organizationId,
        conversationId: updated.conversationId,
      })
    }
    return
  }

  throw new UnrecoverableError("unknown_job")
}

export function startWaIngressWorker(): { close: () => Promise<void> } {
  const connection = redisConnection.duplicate({
    commandTimeout: undefined,
    maxRetriesPerRequest: null,
  })
  const worker = new Worker(waIngressQueueName, handleWaIngressJob, {
    connection,
    concurrency: 4,
  })
  worker.on("failed", (job, error) => {
    logger.error("wa-ingress job failed", {
      jobId: job?.id,
      jobName: job?.name,
      error: error.message,
    })
  })

  return {
    async close() {
      await worker.close()
      connection.disconnect()
    },
  }
}
