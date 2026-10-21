import type { WaMediaJob, WaMediaResult } from "@workspace/jobs"
import type { Redis } from "ioredis"

import {
  waConnectionQueueName,
  waGatewayJobNames,
  waMediaDownloadResultSchema,
  waMediaJobSchema,
} from "@workspace/jobs"
import { Queue, QueueEvents } from "bullmq"

const waitTimeoutMs = 30_000

export type BaileysMediaFetchResult =
  | { ok: true; media: WaMediaResult }
  | { ok: false; retryable: boolean; code: string }

export interface BaileysMediaTransport {
  fetchMedia(command: WaMediaJob): Promise<BaileysMediaFetchResult>
}

export function createBaileysMediaTransport(
  redis: Redis
): BaileysMediaTransport {
  return {
    async fetchMedia(command) {
      const payload = waMediaJobSchema.parse(command)
      const queueName = waConnectionQueueName(payload.channelConnectionId)
      const queue = new Queue(queueName, { connection: redis })
      const events = new QueueEvents(queueName, { connection: redis })
      try {
        const job = await queue.add(waGatewayJobNames.media, payload, {
          jobId: `wa-media--${payload.externalMessageId}--${Date.now()}`,
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
        })
        const result = await job.waitUntilFinished(events, waitTimeoutMs)
        const parsed = waMediaDownloadResultSchema.safeParse(result)
        if (!parsed.success) {
          return { ok: false, retryable: true, code: "gateway_unavailable" }
        }
        return parsed.data
      } catch {
        return { ok: false, retryable: true, code: "gateway_unavailable" }
      } finally {
        await Promise.all([events.close(), queue.close()])
      }
    },
  }
}
