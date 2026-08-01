import {
  supportConversationsQueueDefinition,
  supportConversationsQueueName,
} from "@workspace/jobs"
import { createLoggerWithContext } from "@workspace/logger"
import type { QueueOptions, WorkerOptions } from "bullmq"

import { env } from "../config/env"
import { redisConnection } from "../lib/redis"
import type { QueueConfig } from "../types/queue-config"

const logger = createLoggerWithContext("worker:queue:support-conversations")

const queueOptions: QueueOptions = {
  connection: { url: env.REDIS_URL },
  defaultJobOptions: supportConversationsQueueDefinition.defaultJobOptions,
}

const workerOptions: WorkerOptions = {
  connection: redisConnection,
  concurrency: 5,
  limiter: {
    max: 5,
    duration: 1000,
  },
}

export const supportConversationsQueueConfig: QueueConfig = {
  name: supportConversationsQueueName,
  queueOptions,
  workerOptions,
  eventHandlers: {
    onCompleted: (job) => {
      logger.info("Job completed", { jobName: job.name, jobId: job.id })
    },
    onFailed: (job, error) => {
      logger.error("Job failed", {
        jobName: job?.name,
        jobId: job?.id,
        organizationId: job?.data?.organizationId,
        channelIdentityId: job?.data?.channelIdentityId,
        conversationId: job?.data?.supportConversationId,
        messageId: job?.data?.messageId,
        error: error.message,
      })
    },
  },
}
