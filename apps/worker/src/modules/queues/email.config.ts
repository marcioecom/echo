import type { QueueOptions, WorkerOptions } from "bullmq";
import { redisConnection, workerRedisConnection } from "../../lib/redis";
import { QueueConfig } from "../../types/queue-config";

const emailQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 4,
    backoff: {
      type: "exponential",
      delay: 5 * 60 * 1000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 100,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
      count: 500
    }
  }
}

const emailWorkerOptions: WorkerOptions = {
  connection: workerRedisConnection,
  concurrency: 10,
  lockDuration: 60_000,
  stalledInterval: 10 * 60 * 1000,
  maxStalledCount: 1
}

export const emailQueueConfig: QueueConfig = {
  name: "email",
  queueOptions: emailQueueOptions,
  workerOptions: emailWorkerOptions,
  eventHandlers: {},
  jobTimeouts: {}
}
