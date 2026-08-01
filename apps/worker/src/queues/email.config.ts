import { emailQueueDefinition, emailQueueName } from "@workspace/jobs"
import { createLoggerWithContext } from "@workspace/logger"
import type { QueueOptions, WorkerOptions } from "bullmq"

import { env } from "../config/env"
import { redisConnection } from "../lib/redis"
import type { QueueConfig } from "../types/queue-config"

const logger = createLoggerWithContext("worker:queue:email")

const emailQueueOptions: QueueOptions = {
  connection: { url: env.REDIS_URL },
  defaultJobOptions: emailQueueDefinition.defaultJobOptions,
}

const emailWorkerOptions: WorkerOptions = {
  connection: redisConnection,
  concurrency: 5,
  lockDuration: 30_000, // 30 seconds - notifications are quick
  stalledInterval: 60_000, // 1 minute
  limiter: {
    max: 5, // 5 notifications per second
    duration: 1000,
  },
}

export const emailQueueConfig: QueueConfig = {
  name: emailQueueName,
  queueOptions: emailQueueOptions,
  workerOptions: emailWorkerOptions,
  eventHandlers: {
    onCompleted: (job) => {
      logger.info("Job completed", { jobName: job.name, jobId: job.id })
    },
    onFailed: (job, err) => {
      logger.error("Job failed", {
        jobName: job?.name,
        jobId: job?.id,
        error: err.message,
      })
    },
  },
}
