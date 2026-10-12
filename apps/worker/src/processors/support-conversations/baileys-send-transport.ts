import { waGatewayJobNames, waGatewayQueueName } from "@workspace/jobs"
import type { BaileysSendTransport, SendResult } from "@workspace/messaging"
import { Queue, QueueEvents } from "bullmq"
import type { Redis } from "ioredis"

const waitTimeoutMs = 30_000

export function createBaileysSendTransport(redis: Redis): BaileysSendTransport {
  let queue: Queue | undefined
  let events: QueueEvents | undefined

  return {
    async send(command) {
      queue ??= new Queue(waGatewayQueueName, { connection: redis })
      events ??= new QueueEvents(waGatewayQueueName, { connection: redis })
      try {
        const job = await queue.add(waGatewayJobNames.send, command, {
          jobId: `wa-send--${command.outboundMessageId}--${Date.now()}`,
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
