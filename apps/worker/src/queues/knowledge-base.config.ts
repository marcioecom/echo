import {
  knowledgeBaseQueueDefinition,
  knowledgeBaseQueueName,
} from "@workspace/jobs"
import { createLoggerWithContext } from "@workspace/logger"
import type { QueueOptions, WorkerOptions } from "bullmq"

import { env } from "../config/env"
import { redisConnection } from "../lib/redis"
import type { QueueConfig } from "../types/queue-config"

const logger = createLoggerWithContext("worker:queue:knowledge-base")

const queueOptions: QueueOptions = {
  connection: { url: env.REDIS_URL },
  defaultJobOptions: knowledgeBaseQueueDefinition.defaultJobOptions,
}

const workerOptions: WorkerOptions = {
  connection: redisConnection,
  concurrency: 1,
}

export const knowledgeBaseQueueConfig: QueueConfig = {
  name: knowledgeBaseQueueName,
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
        documentId: job?.data?.documentId,
        error: error.message,
      })
    },
  },
}
