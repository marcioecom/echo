import {
  waConnectionQueueName,
  waGatewayJobNames,
  waSendJobSchema,
} from "@workspace/jobs"
import type { BaileysSendTransport, SendResult } from "@workspace/messaging"
import { Queue, QueueEvents } from "bullmq"
import type { Redis } from "ioredis"

const waitTimeoutMs = 30_000

export function createBaileysSendTransport(redis: Redis): BaileysSendTransport {
  return {
    async send(command) {
      const payload = waSendJobSchema.parse(command)
      const queueName = waConnectionQueueName(payload.channelConnectionId)
      const queue = new Queue(queueName, { connection: redis })
      const events = new QueueEvents(queueName, { connection: redis })
      try {
        const job = await queue.add(waGatewayJobNames.send, payload, {
          jobId: `wa-send--${payload.outboundMessageId}--${Date.now()}`,
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
        })
        const result = await job.waitUntilFinished(events, waitTimeoutMs)
        if (!isSendResult(result)) {
          return { ok: false, retryable: true, code: "gateway_unavailable" }
        }
        return result
      } catch {
        return { ok: false, retryable: true, code: "gateway_unavailable" }
      } finally {
        await Promise.all([events.close(), queue.close()])
      }
    },
  }
}

function isSendResult(value: unknown): value is SendResult {
  if (typeof value !== "object" || value === null) return false
  if (!("ok" in value)) return false
  if (value.ok === true) {
    return (
      "externalMessageId" in value &&
      typeof value.externalMessageId === "string"
    )
  }
  if (value.ok === false) {
    return (
      "retryable" in value &&
      typeof value.retryable === "boolean" &&
      "code" in value &&
      typeof value.code === "string"
    )
  }
  return false
}
